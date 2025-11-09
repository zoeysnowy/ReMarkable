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
import { createEditor, Descendant, Editor, Transforms, Range, Point, Node, Element as SlateElement } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import { EventLineNode, ParagraphNode, TagNode, DateMentionNode, TextNode, CustomEditor } from './types';
import { EventLineElement } from './EventLineElement';
import { TagElementComponent } from '../SlateEditor/elements/TagElement';
import { DateMentionElementComponent } from '../SlateEditor/elements/DateMentionElement';
import { SlateErrorBoundary } from './ErrorBoundary';
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
  const { isInline, isVoid } = editor;

  editor.isInline = element => {
    const e = element as any;
    return (e.type === 'tag' || e.type === 'dateMention') ? true : isInline(element);
  };

  editor.isVoid = element => {
    const e = element as any;
    return (e.type === 'tag' || e.type === 'dateMention') ? true : isVoid(element);
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
  
  // 🆕 用 ref 存储上次的 items，避免无限循环
  const prevItemsRef = React.useRef<any[]>(items);
  
  // 🆕 标记是否正在内部更新（避免循环）
  const isInternalUpdateRef = React.useRef(false);
  
  // 🆕 DOM 变化监控
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isDebugEnabled() || !editorContainerRef.current) return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
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
    
    observer.observe(editorContainerRef.current, {
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
  
  // 🆕 v1.8: 监听 items 变化，自动更新 value（保持 placeholder 行）
  useEffect(() => {
    if (!isInitializedRef.current) return; // 跳过初始化阶段
    
    if (!isInternalUpdateRef.current) {
      logOperation('外部 items 变化，更新 value', { itemCount: items.length });
      setValue(enhancedValue);
    }
  }, [enhancedValue]);
  
  // 通知编辑器就绪（传递带 syncFromExternal 方法的对象）
  useEffect(() => {
    // 暴露调试接口到全局
    if (isDebugEnabled() && typeof window !== 'undefined') {
      (window as any).slateEditorSnapshot = () => logEditorSnapshot(editor);
      console.log('%c💡 调试命令可用: window.slateEditorSnapshot()', 'color: #4CAF50; font-weight: bold;');
    }
    
    if (onEditorReady) {
      onEditorReady({
        syncFromExternal: (newItems: any[]) => {
          logOperation('外部显式同步', { itemCount: newItems.length });
          
          isInternalUpdateRef.current = true;
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
          setValue(newNodes);
          setEditorKey(prev => prev + 1);
          
          requestAnimationFrame(() => {
            isInternalUpdateRef.current = false;
          });
        },
        getEditor: () => editor,
      });
    }
  }, [editor, onEditorReady]);
  
  // ==================== 内容变化处理 ====================
  
  const handleEditorChange = useCallback((newValue: Descendant[]) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    
    // 🎯 修复防抖失效：跳过内部更新触发的 onChange
    if (isInternalUpdateRef.current) {
      if (isDebugEnabled()) {
        window.console.log(`%c[⏭️ ${timestamp}] 跳过内部更新的 onChange`, 'color: #9E9E9E;');
      }
      return;
    }
    
    // 使用增强的调试工具记录变化
    logValueChange(value, newValue as unknown as EventLineNode[]);
    
    setValue(newValue as unknown as EventLineNode[]);
    
    // 🆕 v1.8: 过滤掉 placeholder 行再转换为 PlanItem
    const filteredNodes = (newValue as unknown as EventLineNode[]).filter(node => {
      return !(node.metadata as any)?.isPlaceholder && node.eventId !== '__placeholder__';
    });
    
    // 转换为 PlanItem 并通知外部
    const planItems = slateNodesToPlanItems(filteredNodes);
    
    // 🆕 检测 description 行删除，清空 item.description
    planItems.forEach(item => {
      const hasDescriptionNode = filteredNodes.some(node => {
        const eventLine = node as EventLineNode;
        return (eventLine.eventId === item.eventId || eventLine.lineId.startsWith(item.id)) 
               && eventLine.mode === 'description';
      });
      
      if (!hasDescriptionNode && item.description) {
        item.description = ''; // 清空 description
        if (isDebugEnabled()) {
          console.log(`🧹 清空 description (节点已删除):`, { 
            itemId: item.id.slice(-10) + '...',
            oldDescription: item.description.slice(0, 20) + '...'
          });
        }
      }
    });
    
    if (isDebugEnabled()) {
      console.log('📤 转换后的 PlanItems:', {
        itemCount: planItems.length,
        items: planItems.map(item => ({
          id: item.id.slice(-10) + '...',
          title: item.title ? `"${item.title}"` : '(空)',
          description: item.description ? `"${item.description}"` : null,
          isCompleted: item.isCompleted,
        })),
      });
    }
    
    onChange(planItems);
    
    // 通知焦点变化（用于 FloatingBar 插入位置跟踪）
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
