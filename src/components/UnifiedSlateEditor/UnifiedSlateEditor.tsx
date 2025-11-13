/**
 * UnifiedSlateEditor - 统一的单实例 Slate 编辑器
 * 
 * 核心特性：
 * 1. 单个 Slate 实例，支持跨行文字选择
 * 2. 智能键盘事件处理（Enter、Tab、Shift+Enter 等）
 * 3. 富文本复制粘贴，保留缩进和格式
 * 4. 与 PlanManager 完全兼容
 * 
 * 🔍 调试模式：在浏览器控制台运行以下命令开启详细日志
 * ```javascript
 * window.SLATE_DEBUG = true
 * ```
 * 然后刷新页面或在编辑器中输入内容，查看详细的调试日志
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { createEditor, Descendant, Editor, Transforms, Range, Point, Node, Element as SlateElement, Text as SlateText, Path } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import { EventLineNode, ParagraphNode, TagNode, DateMentionNode, TextNode, CustomEditor } from './types';
import { EventLineElement } from './EventLineElement';
import { TagElementComponent } from './elements/TagElement';
import { DateMentionElementComponent } from './elements/DateMentionElement';
import { SlateErrorBoundary } from './ErrorBoundary';
import { EventService } from '../../services/EventService';
import {
  planItemsToSlateNodes,
  slateNodesToPlanItems,
  createEmptyEventLine,
  slateNodesToRichHtml,
  parseExternalHtml,
} from './serialization';
import {
  initDebug,
  isDebugEnabled,
  logKeyDown,
  logSelection,
  logDOMChange,
  logValueChange,
  logOperation,
  logError,
  logFocus,
  logEditorSnapshot,
  startPerformanceMark,
  endPerformanceMark,
} from './debugLogger';
import './UnifiedSlateEditor.css';

// 🔍 初始化调试系统
initDebug();

/**
 * 安全地设置编辑器焦点和选区
 * 
 * 防止在空节点上调用 Editor.start() 导致的错误：
 * "Cannot get the start point in the node at path [] because it has no start text node."
 */
const safeFocusEditor = (editor: Editor, path?: number[]) => {
  try {
    // 先聚焦编辑器
    ReactEditor.focus(editor);
    
    // 如果没有指定路径，或编辑器为空，直接返回
    if (!path || editor.children.length === 0) {
      return;
    }
    
    // 检查节点是否存在
    const [nodeIndex] = path;
    if (nodeIndex >= editor.children.length) {
      console.warn('[safeFocusEditor] Invalid path:', path);
      return;
    }
    
    const node = editor.children[nodeIndex];
    
    // 检查节点是否有文本内容
    const hasText = (n: any): boolean => {
      if (!n) return false;
      if (typeof n === 'string') return n.length > 0;
      if ('text' in n) return typeof n.text === 'string';
      if ('children' in n && Array.isArray(n.children)) {
        return n.children.some((child: any) => hasText(child));
      }
      return false;
    };
    
    if (!hasText(node)) {
      console.warn('[safeFocusEditor] Node at path has no text:', path);
      return;
    }
    
    // 设置选区
    const start = Editor.start(editor, path);
    Transforms.select(editor, {
      anchor: start,
      focus: start,
    });
  } catch (err) {
    console.error('[safeFocusEditor] Failed to focus editor:', err);
  }
};

export interface UnifiedSlateEditorProps {
  items: any[];  // PlanItem[]
  onChange: (items: any[]) => void;
  onFocus?: (lineId: string) => void;
  onEditorReady?: (editor: any) => void;  // 🆕 改为接收 editor 实例（含 syncFromExternal 方法）
  onDeleteRequest?: (lineId: string) => void;  // 🆕 删除请求回调（通知外部删除）
  renderLinePrefix?: (element: EventLineNode) => React.ReactNode;
  renderLineSuffix?: (element: EventLineNode) => React.ReactNode;
  className?: string;
}

// 🆕 暴露给外部的编辑器接口
export interface UnifiedSlateEditorHandle {
  syncFromExternal: (items: any[]) => void;  // 从外部同步内容
  getEditor: () => Editor;  // 获取 Slate Editor 实例
}

// 自定义编辑器配置
const withCustom = (editor: CustomEditor) => {
  const { isInline, isVoid, normalizeNode } = editor;

  editor.isInline = element => {
    const e = element as any;
    return (e.type === 'tag' || e.type === 'dateMention') ? true : isInline(element);
  };

  editor.isVoid = element => {
    const e = element as any;
    return (e.type === 'tag' || e.type === 'dateMention') ? true : isVoid(element);
  };

  // 🔥 normalizeNode 确保 void inline 元素后面总有空格
  editor.normalizeNode = entry => {
    const [node, path] = entry;

    // 检查 tag 或 dateMention 元素
    if (SlateElement.isElement(node) && (node.type === 'tag' || node.type === 'dateMention')) {
      const tagInfo = node.type === 'tag' ? (node as any).tagName : 'dateMention';
      console.log('%c[normalizeNode] 检查 void 元素', 'background: #673AB7; color: white;', {
        type: (node as any).type,
        tagName: tagInfo,
        path: JSON.stringify(path),
      });
      
      // 获取父节点和当前节点在父节点中的索引
      const parentPath = Path.parent(path);
      const parent = Node.get(editor, parentPath);
      const nodeIndex = path[path.length - 1];
      
      if (!SlateElement.isElement(parent)) {
        console.log('%c[normalizeNode] 父节点不是元素', 'background: #FFC107; color: black;');
        normalizeNode(entry);
        return;
      }
      
      // 检查下一个兄弟节点
      const nextSiblingIndex = nodeIndex + 1;
      const nextSibling = nextSiblingIndex < parent.children.length 
        ? parent.children[nextSiblingIndex] 
        : null;
      
      console.log('%c[normalizeNode] 下一个兄弟节点信息', 'background: #2196F3; color: white;', {
        nodeIndex,
        nextSiblingIndex,
        hasNextSibling: !!nextSibling,
        isText: nextSibling ? SlateText.isText(nextSibling) : false,
        text: nextSibling && SlateText.isText(nextSibling) ? nextSibling.text : 'N/A',
        startsWithSpace: nextSibling && SlateText.isText(nextSibling) ? nextSibling.text.startsWith(' ') : false,
      });

      // 如果后面没有节点，或者下一个节点不是文本节点，或者不以空格开头
      const needsSpace = !nextSibling || 
                        !SlateText.isText(nextSibling) || 
                        !nextSibling.text.startsWith(' ');
      
      if (needsSpace) {
        console.log('%c[normalizeNode] ⚠️ 检测到 void 元素后缺少空格，准备修复', 'background: #FF5722; color: white;', {
          type: (node as any).type,
          path: JSON.stringify(path),
          reason: !nextSibling ? 'no-next-sibling' : 
                  !SlateText.isText(nextSibling) ? 'not-text' : 
                  'no-space',
        });

        // 💾 保存当前光标位置
        const currentSelection = editor.selection;
        
        //  在 void 元素之后插入空格文本节点
        Editor.withoutNormalizing(editor, () => {
          const insertPath = [...parentPath, nextSiblingIndex];
          
          console.log('%c[normalizeNode] 插入空格文本节点', 'background: #4CAF50; color: white;', {
            insertPath: JSON.stringify(insertPath),
            hasSelection: !!currentSelection,
            currentSelectionPath: currentSelection?.anchor.path,
            currentSelectionOffset: currentSelection?.anchor.offset,
          });
          
          // 如果下一个节点是文本但不以空格开头，在文本开头插入空格
          if (nextSibling && SlateText.isText(nextSibling)) {
            Transforms.insertText(editor, ' ', { 
              at: { path: insertPath, offset: 0 } 
            });
            
            // 🔧 只在光标原本在文本节点开头时才调整偏移
            // ⚠️ 不要在其他情况下移动光标！
            if (currentSelection && 
                Range.isCollapsed(currentSelection) &&
                currentSelection.anchor.path.join(',') === insertPath.join(',') &&
                currentSelection.anchor.offset === 0) {
              Transforms.select(editor, {
                anchor: { path: insertPath, offset: 1 },
                focus: { path: insertPath, offset: 1 },
              });
              console.log('%c[normalizeNode] 光标原本在文本开头，已调整 offset +1', 'background: #4CAF50; color: white;');
            } else {
              console.log('%c[normalizeNode] 光标不在插入位置，保持不变', 'background: #2196F3; color: white;');
            }
          } else {
            // 否则插入新的空格文本节点
            Transforms.insertNodes(
              editor,
              { text: ' ' },
              { at: insertPath }
            );
            
            // 🔧 不移动光标！让 Slate 自动处理
            // insertTag 已经通过 Transforms.insertText(' ') 将光标定位到正确位置
            console.log('%c[normalizeNode] 插入新空格节点，光标位置由 Slate 自动处理', 'background: #2196F3; color: white;');
          }
        });
        
        console.log('%c[normalizeNode] ✅ 空格已插入', 'background: #4CAF50; color: white;');
        
        // 由于修改了树，立即返回让 Slate 重新 normalize
        return;
      }
      
      console.log('%c[normalizeNode] ✅ void 元素后已有空格，无需修复', 'background: #4CAF50; color: white;');
    }

    // 对于其他节点，执行默认的 normalize
    normalizeNode(entry);
  };

  return editor;
};

export const UnifiedSlateEditor: React.FC<UnifiedSlateEditorProps> = ({
  items,
  onChange,
  onFocus,
  onEditorReady,
  onDeleteRequest,  // 🆕 删除请求回调
  renderLinePrefix,
  renderLineSuffix,
  className = '',
}) => {
  // 🔍 组件挂载日志
  React.useEffect(() => {
    if (isDebugEnabled()) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
      window.console.log(`%c[🚀 ${timestamp}] UnifiedSlateEditor - 调试模式已开启`, 
        'background: #4CAF50; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;');
      window.console.log(`%c关闭调试: localStorage.removeItem('SLATE_DEBUG') 然后刷新`, 
        'color: #9E9E9E; font-style: italic;');
    } else {
      window.console.log('%c💡 开启调试: 在控制台运行 window.SLATE_DEBUG = true 然后刷新（会自动保存）', 
        'color: #9E9E9E; font-style: italic;');
    }
    
    return () => {
      if (isDebugEnabled()) {
        window.console.log(`%c[👋 ${new Date().toISOString().split('T')[1].slice(0, 12)}] UnifiedSlateEditor unmounted`, 
          'background: #f44336; color: white; padding: 4px 8px; border-radius: 3px;');
      }
    };
  }, [items.length]);
  
  // 创建编辑器实例
  const editor = useMemo(() => withCustom(withHistory(withReact(createEditor() as CustomEditor))), []);
  
  // 🆕 增强的 value：始终在末尾添加一个 placeholder 提示行
  const enhancedValue = useMemo(() => {
    const baseNodes = planItemsToSlateNodes(items);
    
    // 🎯 v1.8: 在末尾添加一个特殊的 placeholder 行（第 i+1 行）
    // 这一行不可编辑，只显示提示文字，点击时会在它之前插入新行
    const placeholderLine: EventLineNode = {
      type: 'event-line',
      eventId: '__placeholder__',
      lineId: '__placeholder__',
      level: 0,
      mode: 'title',
      children: [
        {
          type: 'paragraph',
          children: [{ text: '' }], // 内容为空
        },
      ],
      metadata: {
        isPlaceholder: true, // 🔧 标记为 placeholder
      } as any,
    };
    
    return [...baseNodes, placeholderLine];
  }, [items]);
  
  // 初始化内容
  const [value, setValue] = useState<EventLineNode[]>(() => enhancedValue);
  
  // 🆕 生成编辑器 key，用于强制重新渲染
  const [editorKey, setEditorKey] = useState(0);
  
  // 🆕 v1.8: 移除 shouldShowPlaceholder，改为在 renderLinePrefix 中渲染
  
  // 🔥 标志位：跳过 syncFromExternal 触发的 onChange（因为是外部同步，不需要回调）
  const skipNextOnChangeRef = React.useRef(false);
  
  // 🆕 DOM 变化监控
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isDebugEnabled() || !editorContainerRef.current) return;
    
    // 🔧 只监听 Slate 编辑器区域（[contenteditable="true"]），过滤掉 checkbox 等元素
    const slateEditable = editorContainerRef.current.querySelector('[contenteditable="true"]');
    if (!slateEditable) {
      console.warn('[MutationObserver] 未找到 Slate 编辑器区域');
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // 🔧 过滤掉 checkbox 的变化（target 是 input 元素）
        if (mutation.target instanceof HTMLInputElement) {
          return; // 跳过 checkbox
        }
        
        if (mutation.type === 'childList') {
          logDOMChange('子节点变化', {
            addedNodes: mutation.addedNodes.length,
            removedNodes: mutation.removedNodes.length,
            target: mutation.target.nodeName,
          });
        } else if (mutation.type === 'characterData') {
          logDOMChange('文本内容变化', {
            oldValue: mutation.oldValue,
            newValue: mutation.target.textContent,
          });
        } else if (mutation.type === 'attributes') {
          logDOMChange('属性变化', {
            attributeName: mutation.attributeName,
            oldValue: mutation.oldValue,
          });
        }
      });
    });
    
    // ✅ 只监听 Slate 编辑器的 contenteditable 区域
    observer.observe(slateEditable, {
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      attributes: true,
      attributeOldValue: true,
      subtree: true,
    });
    
    return () => observer.disconnect();
  }, []);
  
  // 🔧 仅在初始化时同步一次
  const isInitializedRef = React.useRef(false);
  useEffect(() => {
    if (!isInitializedRef.current && items.length > 0) {
      logOperation('初始化编辑器内容', { itemCount: items.length });
      
      setValue(enhancedValue);
      isInitializedRef.current = true;
    }
  }, []); // ✅ 空依赖，只执行一次
  
  // 🔥 智能增量更新：逐个比较 items，只更新变化的 Events
  
  // 🔥 订阅 window.eventsUpdated 事件，接收增量更新通知
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    const handleEventUpdated = (e: any) => {
      const { eventId, isDeleted, isNewEvent } = e.detail || {};
      
      console.log('%c[📡 eventsUpdated] 收到事件', 'background: #9C27B0; color: white; padding: 2px 6px;', {
        eventId, isDeleted, isNewEvent
      });
      
      // 🔥 增量处理新增/删除事件
      if (isDeleted) {
        console.log('[📡 eventsUpdated] 删除事件，增量移除节点');
        
        // 找到所有匹配的节点索引
        const nodesToDelete: number[] = [];
        value.forEach((node, index) => {
          const eventLine = node as EventLineNode;
          if (eventLine.eventId === eventId) {
            nodesToDelete.push(index);
          }
        });
        
        if (nodesToDelete.length > 0) {
          skipNextOnChangeRef.current = true;
          Editor.withoutNormalizing(editor, () => {
            // 从后往前删除（避免索引变化）
            nodesToDelete.reverse().forEach(index => {
              Transforms.removeNodes(editor, { at: [index] });
            });
          });
        }
        
        return;
      }
      
      if (isNewEvent) {
        console.log('[📡 eventsUpdated] 新增事件，增量插入节点');
        
        // 从 items 中找到新事件
        const newItem = items.find(item => item.id === eventId);
        if (!newItem) {
          console.warn('[📡 eventsUpdated] 找不到新事件:', eventId);
          return;
        }
        
        // 转换为 Slate 节点
        const newNodes = planItemsToSlateNodes([newItem]);
        if (newNodes.length === 0) return;
        
        // 在 placeholder 之前插入（placeholder 总是最后一个节点）
        const insertIndex = value.length - 1; // placeholder 的索引
        
        skipNextOnChangeRef.current = true;
        Editor.withoutNormalizing(editor, () => {
          Transforms.insertNodes(editor, newNodes as any, { at: [insertIndex] });
        });
        
        return;
      }
      
      // 🔥 增量更新：检测用户是否正在编辑这个 Event
      if (pendingChangesRef.current && editor.selection) {
        const currentPath = editor.selection.anchor.path[0];
        const currentNode = value[currentPath] as EventLineNode;
        
        console.log(`%c[🔍 增量更新检查]`, 'background: #FFC107; color: black; padding: 2px 6px;', {
          hasPendingChanges: !!pendingChangesRef.current,
          hasSelection: !!editor.selection,
          currentPath,
          currentEventId: currentNode?.eventId,
          incomingEventId: eventId,
          willSkip: currentNode?.eventId === eventId
        });
        
        if (currentNode?.eventId === eventId) {
          console.log(`%c[⏭️ 跳过 Slate 更新] 用户正在编辑 Event: ${eventId}`, 'color: #FF9800;');
          console.log(`%c[ℹ️ UI 应该通过 useEventTime hook 自动更新]`, 'color: #2196F3;');
          return;
        }
      }
      
      // 查找需要更新的节点
      const nodesToUpdate: number[] = [];
      value.forEach((node, index) => {
        const eventLine = node as EventLineNode;
        if (eventLine.eventId === eventId) {
          nodesToUpdate.push(index);
        }
      });
      
      console.log(`%c[🔍 查找节点]`, 'background: #E91E63; color: white; padding: 2px 6px;', {
        eventId,
        totalNodes: value.length,
        nodesToUpdate,
        nodesToUpdateCount: nodesToUpdate.length,
      });

      if (nodesToUpdate.length === 0) return;
      
      // 🔥 直接从 EventService 获取最新数据
      const updatedEvent = EventService.getEventById(eventId);
      if (!updatedEvent) return;
      
      console.log(`%c[📝 增量更新] Event: ${eventId}`, 'background: #2196F3; color: white; padding: 2px 6px;');
      
      // 🔧 只更新 metadata 字段，不覆盖 children（避免破坏光标）
      // 🆕 同时更新 children 中的 DateMentionNode
      Editor.withoutNormalizing(editor, () => {
        nodesToUpdate.forEach(index => {
          const currentNode = value[index] as EventLineNode;
          
          // 构建新的 metadata（从 EventService 获取）
          const newMetadata = {
            startTime: updatedEvent.startTime,
            endTime: updatedEvent.endTime,
            dueDate: updatedEvent.dueDate,
            isAllDay: updatedEvent.isAllDay,
            timeSpec: updatedEvent.timeSpec,
            emoji: updatedEvent.emoji,
            color: updatedEvent.color,
            priority: updatedEvent.priority,
            category: updatedEvent.category,
            isCompleted: updatedEvent.isCompleted,
            isTask: updatedEvent.isTask,
            type: updatedEvent.type,
            isPlan: updatedEvent.isPlan,
            isTimeCalendar: updatedEvent.isTimeCalendar,
            calendarIds: updatedEvent.calendarIds,
            source: updatedEvent.source,
            syncStatus: updatedEvent.syncStatus,
            externalId: updatedEvent.externalId,
            remarkableSource: updatedEvent.remarkableSource,
            createdAt: updatedEvent.createdAt,
            updatedAt: updatedEvent.updatedAt,
          };
          
          // 只更新 metadata，保持 children 不变
          Transforms.setNodes(editor, { metadata: newMetadata } as any, { at: [index] });
          
          // 🆕 更新 children 中的 DateMentionNode
          // 遍历所有 paragraph 节点，找到 dateMention 节点并更新
          console.log(`%c[🔍 检查 DateMention]`, 'background: #FF9800; color: white; padding: 2px 6px;', {
            eventId,
            paragraphsCount: currentNode.children.length,
            children: currentNode.children,
          });
          
          currentNode.children.forEach((paragraph, paragraphIndex) => {
            console.log(`%c[🔍 Paragraph ${paragraphIndex}]`, 'background: #FFC107; color: black; padding: 2px 6px;', {
              childrenCount: paragraph.children.length,
              children: paragraph.children,
            });
            
            paragraph.children.forEach((child, childIndex) => {
              console.log(`%c[🔍 Child ${childIndex}]`, 'background: #FFEB3B; color: black; padding: 2px 6px;', {
                hasType: 'type' in child,
                type: 'type' in child ? child.type : 'no-type',
                child,
              });
              
              // 类型守卫：检查是否是 DateMentionNode
              if ('type' in child && child.type === 'dateMention') {
                const dateMentionNode = child as DateMentionNode;
                console.log(`%c[📅 找到 DateMention]`, 'background: #8BC34A; color: white; padding: 2px 6px;', {
                  eventId: dateMentionNode.eventId,
                  matchesEventId: dateMentionNode.eventId === eventId,
                  startDate: dateMentionNode.startDate,
                  endDate: dateMentionNode.endDate,
                });
                
                if (dateMentionNode.eventId === eventId) {
                  const dateMentionPath = [index, paragraphIndex, childIndex];
                  const newDateMention = {
                    startDate: updatedEvent.startTime || dateMentionNode.startDate,
                    endDate: updatedEvent.endTime || dateMentionNode.endDate,
                  };
                  
                  console.log(`%c[📅 更新 DateMention]`, 'background: #4CAF50; color: white; padding: 2px 6px;', {
                    path: dateMentionPath,
                    旧startDate: dateMentionNode.startDate,
                    新startDate: newDateMention.startDate,
                    旧endDate: dateMentionNode.endDate,
                    新endDate: newDateMention.endDate,
                  });
                  
                  Transforms.setNodes(
                    editor,
                    newDateMention as any,
                    { at: dateMentionPath }
                  );
                }
              }
            });
          });
        });
      });
      
      skipNextOnChangeRef.current = true;
      setValue([...editor.children] as unknown as EventLineNode[]);
    };
    
    window.addEventListener('eventsUpdated', handleEventUpdated);
    return () => window.removeEventListener('eventsUpdated', handleEventUpdated);
  }, [items, value, editor, enhancedValue]);
  
  // 通知编辑器就绪（传递带 syncFromExternal 方法的对象）
  useEffect(() => {
    // 暴露调试接口到全局
    if (isDebugEnabled() && typeof window !== 'undefined') {
      (window as any).slateEditorSnapshot = () => logEditorSnapshot(editor);
      console.log('%c💡 调试命令可用: window.slateEditorSnapshot()', 'color: #4CAF50; font-weight: bold;');
    }
    
    if (onEditorReady) {
      onEditorReady({
        // 🔥 全量替换（用于初始化或重置）
        syncFromExternal: (newItems: any[]) => {
          logOperation('外部全量同步', { itemCount: newItems.length });
          
          const baseNodes = planItemsToSlateNodes(newItems);
          
          // 🆕 v1.8: 添加 placeholder 行到末尾
          const placeholderLine: EventLineNode = {
            type: 'event-line',
            eventId: '__placeholder__',
            lineId: '__placeholder__',
            level: 0,
            mode: 'title',
            children: [
              {
                type: 'paragraph',
                children: [{ text: '' }],
              },
            ],
            metadata: {
              isPlaceholder: true,
            } as any,
          };
          
          const newNodes = [...baseNodes, placeholderLine];
          
          // 🔥 设置标志位，跳过 onChange
          skipNextOnChangeRef.current = true;
          setValue(newNodes);
          setEditorKey(prev => prev + 1);
        },
        
        getEditor: () => editor,
      });
    }
  }, [editor, onEditorReady]);
  
  // ==================== 内容变化处理 ====================
  
  // 🆕 自动保存定时器
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = React.useRef<Descendant[] | null>(null);
  
  // 🆕 v1.8: 跟踪最近保存的事件ID，避免增量更新覆盖
  const recentlySavedEventsRef = React.useRef<Set<string>>(new Set());
  
  const handleEditorChange = useCallback((newValue: Descendant[]) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    
    // 🔥 调试：记录每次 onChange 的选区状态
    console.log('%c[🔄 onChange]', 'background: #2196F3; color: white; padding: 2px 6px;', {
      timestamp,
      hasSelection: !!editor.selection,
      selection: editor.selection ? {
        anchor: editor.selection.anchor,
        focus: editor.selection.focus
      } : null,
      operations: editor.operations.map(op => op.type)
    });
    
    // 🎯 跳过外部同步触发的 onChange
    if (skipNextOnChangeRef.current) {
      skipNextOnChangeRef.current = false;
      if (isDebugEnabled()) {
        window.console.log(`%c[⏭️ ${timestamp}] 跳过外部同步的 onChange`, 'color: #9E9E9E;');
      }
      return;
    }
    
    // 🔥 检测是否只是选区变化（光标移动），而非内容变化
    const isOnlySelectionChange = editor.operations.every(
      op => op.type === 'set_selection'
    );
    
    if (isOnlySelectionChange) {
      if (isDebugEnabled()) {
        window.console.log(`%c[⏭️ ${timestamp}] 跳过纯选区变化`, 'color: #9E9E9E;');
      }
      return;
    }
    
    // 使用增强的调试工具记录变化
    logValueChange(value, newValue as unknown as EventLineNode[]);
    
    // 🔥 立即更新 UI（Slate 内部状态）
    setValue(newValue as unknown as EventLineNode[]);
    
    // 🔥 缓存待保存的变化，但不立即调用 onChange
    pendingChangesRef.current = newValue;
    
    // 🔥 清除之前的自动保存定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // 🔥 设置新的自动保存定时器（2秒后保存）
    autoSaveTimerRef.current = setTimeout(() => {
      if (pendingChangesRef.current) {
        if (isDebugEnabled()) {
          console.log(`%c[💾 ${new Date().toISOString().split('T')[1].slice(0, 12)}] 自动保存触发`, 
            'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 2px;');
        }
        
        const filteredNodes = (pendingChangesRef.current as unknown as EventLineNode[]).filter(node => {
          return !(node.metadata as any)?.isPlaceholder && node.eventId !== '__placeholder__';
        });
        
        const planItems = slateNodesToPlanItems(filteredNodes);
        
        // 检测 description 行删除
        planItems.forEach(item => {
          const hasDescriptionNode = filteredNodes.some(node => {
            const eventLine = node as EventLineNode;
            return (eventLine.eventId === item.eventId || eventLine.lineId.startsWith(item.id)) 
                   && eventLine.mode === 'description';
          });
          
          if (!hasDescriptionNode && item.description) {
            item.description = '';
          }
        });
        
        onChange(planItems);
        pendingChangesRef.current = null;
      }
    }, 2000); // 2秒后自动保存
    
    // 🔥 但是要立即通知焦点变化（用于 FloatingBar 和 TagPicker）
    if (onFocus && editor.selection) {
      try {
        const match = Editor.above(editor, {
          match: n => (n as any).type === 'event-line',
        });
        
        if (match) {
          const [node] = match;
          const eventLine = node as unknown as EventLineNode;
          onFocus(eventLine.lineId);
        }
      } catch (err) {
        // 忽略错误
      }
    }
  }, [onChange, onFocus, editor]);
  
  // 🆕 立即保存函数（用于 Enter 和失焦）
  const flushPendingChanges = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    
    if (pendingChangesRef.current) {
      if (isDebugEnabled()) {
        console.log(`%c[💾 立即保存] 触发`, 
          'background: #FF9800; color: white; padding: 2px 6px; border-radius: 2px;');
      }
      
      const filteredNodes = (pendingChangesRef.current as unknown as EventLineNode[]).filter(node => {
        return !(node.metadata as any)?.isPlaceholder && node.eventId !== '__placeholder__';
      });
      
      const planItems = slateNodesToPlanItems(filteredNodes);
      
      // 检测 description 行删除
      planItems.forEach(item => {
        const hasDescriptionNode = filteredNodes.some(node => {
          const eventLine = node as EventLineNode;
          return (eventLine.eventId === item.eventId || eventLine.lineId.startsWith(item.id)) 
                 && eventLine.mode === 'description';
        });
        
        if (!hasDescriptionNode && item.description) {
          item.description = '';
        }
      });
      
      // 🆕 v1.8: 记录保存的事件ID，避免增量更新覆盖
      planItems.forEach(item => {
        recentlySavedEventsRef.current.add(item.id);
      });
      // 1秒后清除（给 eventsUpdated 足够时间处理）
      setTimeout(() => {
        planItems.forEach(item => {
          recentlySavedEventsRef.current.delete(item.id);
        });
      }, 1000);
      
      onChange(planItems);
      pendingChangesRef.current = null;
    }
  }, [onChange]);
  
  // ==================== 焦点变化处理 ====================
  
  const handleClick = useCallback((event: React.MouseEvent) => {
    // 🔧 防止在编辑器为空时处理点击
    try {
      if (!editor.children || editor.children.length === 0) {
        event.preventDefault();
        return;
      }
      
      // 记录点击事件
      logFocus('click', editor, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      
      // 通知焦点变化
      if (onFocus && editor.selection) {
        const match = Editor.above(editor, {
          match: n => (n as any).type === 'event-line',
        });
        
        if (match) {
          const [node] = match;
          const eventLine = node as unknown as EventLineNode;
          
          // 跳过 placeholder 行
          if (!((eventLine.metadata as any)?.isPlaceholder || eventLine.eventId === '__placeholder__')) {
            onFocus(eventLine.lineId);
          }
        }
      }
    } catch (err) {
      // 忽略选区错误
      logError('handleClick', err);
      event.preventDefault();
    }
  }, [onFocus, editor]);
  
  // ==================== 键盘事件处理 ====================
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { selection } = editor;
    
    // 🔍 记录所有键盘事件
    if (!event.nativeEvent?.isComposing) {
      logKeyDown(event, editor);
    }
    
    if (!selection) return;
    
    // IME 组字中，不处理快捷键
    if (event.nativeEvent?.isComposing) return;
    
    // 🆕 让数字键 1-9 和 Escape 冒泡到外层（用于 FloatingBar 交互）
    // 不 preventDefault，让这些键传递到 document 层的监听器
    if (/^[1-9]$/.test(event.key) || event.key === 'Escape') {
      return; // 不处理，让事件冒泡
    }
    
    // 获取当前 event-line 节点和路径
    const match = Editor.above(editor, {
      match: n => (n as any).type === 'event-line',
    });
    
    if (!match) return;
    const [currentNode, currentPath] = match;
    const eventLine = currentNode as unknown as EventLineNode;
    
    // 🆕 v1.8: 如果在 placeholder 行，拦截所有输入，在它之前创建新行
    if ((eventLine.metadata as any)?.isPlaceholder || eventLine.eventId === '__placeholder__') {
      // 允许导航键
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.key)) {
        return;
      }
      
      event.preventDefault();
      
      // 任何输入都在 placeholder 之前创建新行
      const newLine = createEmptyEventLine(0);
      const insertPath = [currentPath[0]];
      
      Transforms.insertNodes(editor, newLine as any, { at: insertPath });
      
      // 聚焦到新行并插入输入的字符
      setTimeout(() => {
        safeFocusEditor(editor, insertPath);
        
        // 如果是可打印字符，插入它
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          Transforms.insertText(editor, event.key);
        }
      }, 50);
      
      logOperation('Type on placeholder - 创建新行', { key: event.key });
      return;
    }
    
    // Enter 键 - 创建新的 EventLine 或 Description 行
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      
      // 🔥 立即保存当前内容
      flushPendingChanges();
      
      let insertIndex = currentPath[0] + 1;
      let newLine: EventLineNode;
      
      // 🆕 如果当前是 description 行，继续创建 description 行（同一个 eventId）
      if (eventLine.mode === 'description') {
        newLine = {
          type: 'event-line',
          eventId: eventLine.eventId, // 🔧 共享同一个 eventId
          lineId: `${eventLine.lineId}-${Date.now()}`, // 生成唯一 lineId
          level: eventLine.level,
          mode: 'description',
          children: [{ type: 'paragraph', children: [{ text: '' }] }],
          metadata: eventLine.metadata, // 继承 metadata
        };
        
        logOperation('Enter (description) - 创建新 description 行', {
          currentLine: currentPath[0],
          eventId: eventLine.eventId,
          newLineId: newLine.lineId.slice(-10) + '...',
        }, 'background: #9C27B0; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;');
      } else {
        // Title 行：检查是否有 description 行，如果有则在其后插入
        const baseLineId = eventLine.lineId.replace('-desc', '');
        const descLineId = `${baseLineId}-desc`;
        
        // 查找 description 行
        try {
          for (let i = currentPath[0] + 1; i < value.length; i++) {
            const nextNode = value[i];
            if (nextNode.type === 'event-line' && nextNode.lineId === descLineId) {
              // 找到 description 行，新行应该插入在 description 行之后
              insertIndex = i + 1;
              break;
            }
            // 如果遇到其他 event 的 title 行，说明没有 description
            if (nextNode.type === 'event-line' && nextNode.mode === 'title') {
              break;
            }
          }
        } catch (e) {
          // 忽略错误
        }
        
        // 创建新的 title 行（新 event）
        newLine = createEmptyEventLine(eventLine.level);
        
        logOperation('Enter (title) - 创建新 title 行', {
          currentLine: currentPath[0],
          insertIndex,
          newLineId: newLine.lineId.slice(-10) + '...',
        }, 'background: #4CAF50; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;');
      }
      
      if (isDebugEnabled()) {
        window.console.log('创建新行:', {
          insertIndex,
          newLineId: newLine.lineId.slice(-10),
          inheritedLevel: newLine.level,
          mode: newLine.mode,
        });
      }
      
      Transforms.insertNodes(editor, newLine as unknown as Node, {
        at: [insertIndex],
      });
      
      // 🔧 直接选中新行的开始位置，不使用 safeFocusEditor
      try {
        if (isDebugEnabled()) {
          window.console.log('设置光标到新行:', { path: [insertIndex, 0, 0] });
        }
        
        Transforms.select(editor, {
          anchor: { path: [insertIndex, 0, 0], offset: 0 },
          focus: { path: [insertIndex, 0, 0], offset: 0 },
        });
        
        if (isDebugEnabled()) {
          window.console.log('光标设置后位置:', editor.selection);
          window.console.groupEnd();
        }
      } catch (err) {
        if (isDebugEnabled()) {
          window.console.error('设置光标失败:', err);
          window.console.groupEnd();
        }
      }
      
      return;
    }
    
    // Shift+Enter - 切换 Description 模式
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      
      if (eventLine.mode === 'title') {
        // 创建 Description 行
        const descLine: EventLineNode = {
          type: 'event-line',
          eventId: eventLine.eventId,
          lineId: `${eventLine.lineId}-desc`,
          level: eventLine.level,
          mode: 'description',
          children: [{ type: 'paragraph', children: [{ text: '' }] }],
        };
        
        Transforms.insertNodes(editor, descLine as unknown as Node, {
          at: [currentPath[0] + 1],
        });
        
        // 聚焦新创建的 Description 行（使用安全方法）
        safeFocusEditor(editor, [currentPath[0] + 1, 0, 0]);
      } else {
        // Description -> Title: 转换当前行
        Transforms.setNodes(
          editor,
          { mode: 'title' } as unknown as Partial<Node>,
          { at: currentPath }
        );
      }
      return;
    }
    
    // Tab 键 - 增加缩进
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      
      // 计算最大允许缩进（上一行 level + 1）
      let maxLevel = 5; // 默认最大层级
      
      if (currentPath[0] > 0) {
        try {
          const [prevNode] = Editor.node(editor, [currentPath[0] - 1]);
          const prevLine = prevNode as unknown as EventLineNode;
          if (prevLine.type === 'event-line') {
            maxLevel = prevLine.level + 1;
          }
        } catch (e) {
          // 上一个节点不存在
        }
      }
      
      const newLevel = Math.min(eventLine.level + 1, maxLevel);
      
      Transforms.setNodes(
        editor,
        { level: newLevel } as unknown as Partial<Node>,
        { at: currentPath }
      );
      
      return;
    }
    
    // Shift+Tab - 减少缩进 / 退出 Description 模式
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      
      // 🆕 如果是 description 行，Shift+Tab 转换为 title 行
      if (eventLine.mode === 'description') {
        const newLineId = eventLine.lineId.replace('-desc', ''); // 移除 -desc 后缀
        
        Transforms.setNodes(
          editor,
          { 
            mode: 'title',
            lineId: newLineId, // 🔧 修复：更新 lineId，避免数据写入错误字段
          } as unknown as Partial<Node>,
          { at: currentPath }
        );
        
        return;
      }
      
      // Title 行：减少缩进
      const newLevel = Math.max(eventLine.level - 1, 0);
      
      Transforms.setNodes(
        editor,
        { level: newLevel } as unknown as Partial<Node>,
        { at: currentPath }
      );
      
      return;
    }
    
    // Delete/Backspace - 在行首时删除当前行
    if ((event.key === 'Backspace' || event.key === 'Delete') && Range.isCollapsed(selection)) {
      // 安全检查：确保节点有效
      try {
        const paragraph = eventLine.children[0];
        if (!paragraph) return;
        
        const text = Node.string(paragraph as unknown as Node);
        const startPoint = Editor.start(editor, currentPath);
        
        // 如果内容为空且在行首，删除当前行
        if (!text && Point.equals(selection.anchor, startPoint)) {
          event.preventDefault();
          
          logOperation('Backspace - 删除空行', {
            totalLines: value.length,
            currentLine: currentPath[0],
            lineId: eventLine.lineId.slice(-10) + '...',
            isLastLine: currentPath[0] === value.length - 1,
          }, 'background: #f44336; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;');
          
          // 🆕 v1.8: 检查是否是倒数第二行（下一行是 placeholder）
          const isSecondToLast = currentPath[0] === value.length - 2;
          const nextNode = isSecondToLast ? value[currentPath[0] + 1] : null;
          const nextIsPlaceholder = nextNode && 
            ((nextNode.metadata as any)?.isPlaceholder || nextNode.eventId === '__placeholder__');
          
          // 🔧 如果只剩下当前行和 placeholder，清空当前行而不删除
          if (value.length === 2 && nextIsPlaceholder) {
            if (isDebugEnabled()) {
              window.console.log('操作: 清空倒数第二行（最后一个真实行）');
            }
            // 重置为空行
            Transforms.delete(editor, {
              at: {
                anchor: startPoint,
                focus: Editor.end(editor, currentPath),
              },
            });
            return;
          }
          
          // 🔧 修复：如果是最后一行（placeholder），不允许删除
          if ((eventLine.metadata as any)?.isPlaceholder || eventLine.eventId === '__placeholder__') {
            if (isDebugEnabled()) {
              window.console.log('操作: 阻止删除 placeholder 行');
            }
            return;
          }
        
          // 多行时删除当前行
          if (value.length > 2 || (value.length > 1 && !nextIsPlaceholder)) {
            if (isDebugEnabled()) {
              window.console.log('操作: 删除当前行');
              window.console.log('删除前光标:', editor.selection);
            }
            
            Transforms.removeNodes(editor, { at: currentPath });
            
            // 🆕 v1.8: 如果删除后光标在 placeholder 行，移动到上一行
            setTimeout(() => {
              if (editor.selection) {
                const match = Editor.above(editor, {
                  match: n => (n as any).type === 'event-line',
                });
                
                if (match) {
                  const [node, path] = match;
                  const line = node as unknown as EventLineNode;
                  
                  if ((line.metadata as any)?.isPlaceholder || line.eventId === '__placeholder__') {
                    // 光标在 placeholder，移动到上一行末尾
                    if (path[0] > 0) {
                      const prevPath = [path[0] - 1];
                      const prevEnd = Editor.end(editor, prevPath);
                      Transforms.select(editor, prevEnd);
                      
                      if (isDebugEnabled()) {
                        window.console.log('光标从 placeholder 移动到上一行末尾');
                      }
                    }
                  }
                }
              }
            }, 10);
            
            if (isDebugEnabled()) {
              window.console.log('删除后光标:', editor.selection);
              window.console.log('删除后总行数:', value.length - 1);
              window.console.groupEnd();
            }
          }
          return;
        }
      } catch (err) {
        // 如果路径无效，忽略错误
        if (isDebugEnabled()) {
          window.console.warn('Editor.start() 失败，节点可能为空:', err);
        }
      }
    }
    
    // 格式化快捷键
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault();
          Editor.addMark(editor, 'bold', true);
          return;
        case 'i':
          event.preventDefault();
          Editor.addMark(editor, 'italic', true);
          return;
        case 'u':
          event.preventDefault();
          Editor.addMark(editor, 'underline', true);
          return;
      }
    }
    
    // 🆕 v1.8: ArrowDown - 防止进入 placeholder 行
    if (event.key === 'ArrowDown') {
      // 检查下一行是否是 placeholder
      if (currentPath[0] === value.length - 2) {
        const nextNode = value[currentPath[0] + 1];
        if (nextNode && ((nextNode.metadata as any)?.isPlaceholder || nextNode.eventId === '__placeholder__')) {
          event.preventDefault();
          // 移动到当前行末尾
          const endPoint = Editor.end(editor, currentPath);
          Transforms.select(editor, endPoint);
          return;
        }
      }
    }
  }, [editor, value]);
  
  // ==================== 复制粘贴增强 ====================
  
  const handleCopy = useCallback((event: React.ClipboardEvent) => {
    const { selection } = editor;
    if (!selection) return;
    
    event.preventDefault();
    
    // 获取选中的节点
    const fragment = Editor.fragment(editor, selection);
    const richHtml = slateNodesToRichHtml(fragment as unknown as EventLineNode[]);
    
    // 设置富文本和纯文本
    event.clipboardData.setData('text/html', richHtml);
    event.clipboardData.setData('text/plain', Editor.string(editor, selection));
  }, [editor]);
  
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    event.preventDefault();
    
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    
    if (html) {
      // 解析 HTML，智能创建 EventLine
      const nodes = parseExternalHtml(html);
      
      // 插入解析的节点
      const { selection } = editor;
      if (selection) {
        Transforms.insertNodes(editor, nodes as unknown as Node);
      }
    } else if (text) {
      // 纯文本插入
      Transforms.insertText(editor, text);
    }
  }, [editor]);
  
  // ==================== 渲染函数 ====================
  
  // 🆕 v1.8: Placeholder 点击处理 - 在它之前创建新行
  const handlePlaceholderClick = useCallback(() => {
    try {
      // 找到 placeholder 行的路径
      const placeholderPath = editor.children.findIndex(
        (node: any) => node.eventId === '__placeholder__' || node.metadata?.isPlaceholder
      );
      
      if (placeholderPath === -1) return;
      
      // 在 placeholder 之前插入新行
      const newLine = createEmptyEventLine(0);
      const insertPath = [placeholderPath];
      
      Transforms.insertNodes(editor, newLine as any, { at: insertPath });
      
      // 聚焦到新行
      setTimeout(() => {
        safeFocusEditor(editor, insertPath);
      }, 50);
      
      logOperation('Placeholder clicked - 创建新行', { insertPath });
    } catch (err) {
      logError('handlePlaceholderClick', err);
    }
  }, [editor]);
  
  const renderElement = useCallback((props: RenderElementProps) => {
    const element = props.element as any;
    
    switch (element.type) {
      case 'event-line':
        return (
          <EventLineElement
            {...props}
            element={element as EventLineNode}
            renderPrefix={renderLinePrefix}
            renderSuffix={renderLineSuffix}
            onPlaceholderClick={handlePlaceholderClick}
          />
        );
      case 'paragraph':
        return <div {...props.attributes}>{props.children}</div>;
      case 'tag':
        return <TagElementComponent {...props} />;
      case 'dateMention':
        return <DateMentionElementComponent {...props} />;
      default:
        return <div {...props.attributes}>{props.children}</div>;
    }
  }, [renderLinePrefix, renderLineSuffix, handlePlaceholderClick]);
  
  const renderLeaf = useCallback((props: RenderLeafProps) => {
    let { children } = props;
    const leaf = props.leaf as TextNode;
    
    if (leaf.bold) {
      children = <strong>{children}</strong>;
    }
    if (leaf.italic) {
      children = <em>{children}</em>;
    }
    if (leaf.underline) {
      children = <u>{children}</u>;
    }
    if (leaf.strikethrough) {
      children = <s>{children}</s>;
    }
    if (leaf.color) {
      children = <span style={{ color: leaf.color }}>{children}</span>;
    }
    
    return <span {...props.attributes}>{children}</span>;
  }, []);
  
  // ==================== 渲染 ====================
  
  // 🆕 Gray text placeholder 点击处理
  const handleGrayTextClick = useCallback(() => {
    try {
      // 🔧 确保编辑器有内容
      if (!editor.children || editor.children.length === 0) {
        console.warn('[handleGrayTextClick] Editor is empty');
        return;
      }
      
      // 延迟聚焦，确保 DOM 已更新
      setTimeout(() => {
        // 使用安全的焦点设置方法
        safeFocusEditor(editor, [0, 0, 0]);
      }, 50);
    } catch (err) {
      console.error('[handleGrayTextClick] Error:', err);
    }
  }, [editor]);
  
  return (
    <SlateErrorBoundary>
      <div 
        ref={editorContainerRef}
        className={`unified-slate-editor ${className}`} 
        style={{ position: 'relative' }}
      >
        {/* 🔧 v1.8: 移除绝对定位的 placeholder，改用最后一行的 renderLinePrefix */}
        
        {/* 🔧 确保编辑器始终有内容 */}
        {value && value.length > 0 ? (
          <Slate 
            key={editorKey} 
            editor={editor} 
            initialValue={value as unknown as Descendant[]} 
            onChange={handleEditorChange}
          >
            <Editable
              renderElement={renderElement}
              renderLeaf={renderLeaf}
              onKeyDown={handleKeyDown}
              onClick={handleClick}
              onCopy={handleCopy}
              onPaste={handlePaste}
              onBlur={() => {
                // 🔥 失焦时立即保存
                flushPendingChanges();
              }}
              placeholder=""
              spellCheck={false}
              className="unified-editable"
            />
          </Slate>
        ) : (
          <div style={{ padding: '8px 16px', color: '#9ca3af' }}>
            加载中...
          </div>
        )}
      </div>
    </SlateErrorBoundary>
  );
};
