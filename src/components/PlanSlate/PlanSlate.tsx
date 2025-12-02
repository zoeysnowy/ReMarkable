/**
 * PlanSlate - 统一的单实例 Slate 编辑器
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
 * localStorage.setItem('SLATE_VERBOSE_LOG', 'true') // 开启详细日志
 * localStorage.removeItem('SLATE_VERBOSE_LOG') // 关闭详细日志
 * ```
 * 然后刷新页面或在编辑器中输入内容，查看详细的调试日志
 */

// 🔧 日志控制开关 - 可在控制台动态调整
const ENABLE_VERBOSE_LOG = typeof window !== 'undefined' && localStorage.getItem('SLATE_VERBOSE_LOG') === 'true';
const vlog = ENABLE_VERBOSE_LOG ? console.log.bind(console) : () => {};

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { createEditor, Descendant, Editor, Transforms, Range, Point, Node, Element as SlateElement, Text as SlateText, Path } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import { EventLineNode, ParagraphNode, TagNode, DateMentionNode, TextNode, CustomEditor } from './types';
import { EventLineElement } from './EventLineElement';

// ✅ 从 SlateCore 导入共享元素组件
import { TagElementComponent } from '../SlateCore/elements/TagElement';
import DateMentionElement from '../SlateCore/elements/DateMentionElement';
import { TimestampDividerElement } from '../SlateCore/elements/TimestampDividerElement';
import { EventMentionElement } from '../SlateCore/elements/EventMentionElement';

// ✅ 从 SlateCore 导入共享服务
import { EventLogTimestampService } from '../SlateCore/services/timestampService';

// ✅ 从 SlateCore 导入共享操作工具（备用，后续可能使用）
import {
  moveParagraphUp as slateMoveParagraphUp,
  moveParagraphDown as slateMoveParagraphDown,
} from '../SlateCore/operations/paragraphOperations';

import {
  handleBulletBackspace,
  handleBulletEnter,
  detectBulletTrigger,
  applyBulletAutoConvert,
  getBulletChar,
} from '../SlateCore/operations/bulletOperations';

import {
  extractBulletItems,
  generateClipboardData,
  parsePlainTextBullets,
  parseHTMLBullets,
} from '../SlateCore/operations/clipboardHelpers';

import UnifiedDateTimePicker from '../FloatingToolbar/pickers/UnifiedDateTimePicker';
import { UnifiedMentionMenu } from '../UnifiedMentionMenu';
import { SlateErrorBoundary } from './ErrorBoundary';
import { EventService } from '../../services/EventService';
import { parseNaturalLanguage } from '../../utils/naturalLanguageTimeDictionary';
import {
  planItemsToSlateNodes,
  slateNodesToPlanItems,
  createEmptyEventLine,
  slateNodesToRichHtml,
  parseExternalHtml,
} from './serialization';
import { insertDateMention, insertEventMention } from './helpers';
import { formatTimeForStorage } from '../../utils/timeUtils';
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
import './PlanSlate.css';

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

export interface PlanSlateProps {
  items: any[];  // PlanItem[]
  onChange: (items: any[]) => void;
  onFocus?: (lineId: string) => void;
  onEditorReady?: (editor: any) => void;  // 🆕 改为接收 editor 实例（含 syncFromExternal 方法）
  onDeleteRequest?: (lineId: string) => void;  // 🆕 删除请求回调（通知外部删除）
  onSave?: (eventId: string, updates: any) => void;  // 🆕 保存事件回调
  onTimeClick?: (eventId: string, anchor: HTMLElement) => void;  // 🆕 时间点击回调
  onMoreClick?: (eventId: string) => void;  // 🆕 More 图标点击回调
  getEventStatus?: (eventId: string, metadata?: any) => 'new' | 'updated' | 'done' | 'missed' | 'deleted' | undefined; // 🆕 获取事件状态
  eventId?: string;  // 🆕 当前编辑的事件ID（用于 timestamp 功能）
  enableTimestamp?: boolean;  // 🆕 是否启用 timestamp 自动插入
  className?: string;
}

// 🆕 暴露给外部的编辑器接口
export interface PlanSlateHandle {
  syncFromExternal: (items: any[]) => void;  // 从外部同步内容
  getEditor: () => Editor;  // 获取 Slate Editor 实例
  insertTag: (tagId: string, tagName: string, color: string, emoji: string) => boolean; // 🆕 插入标签命令
  insertEmoji: (emoji: string) => boolean; // 🆕 插入Emoji命令
  insertDateMention: (startTime: string, endTime?: string, displayText?: string) => boolean; // 🆕 插入DateMention命令
  flushPendingChanges: () => void; // 🆕 立即保存待处理的变更
}

// 自定义编辑器配置
const withCustom = (editor: CustomEditor) => {
  const { isInline, isVoid, normalizeNode, insertBreak } = editor;

  editor.isInline = element => {
    const e = element as any;
    return (e.type === 'tag' || e.type === 'dateMention' || e.type === 'event-mention') ? true : isInline(element);
  };

  editor.isVoid = element => {
    const e = element as any;
    return (e.type === 'tag' || e.type === 'dateMention' || e.type === 'event-mention' || e.type === 'timestamp-divider') ? true : isVoid(element);
  };

  // 🆕 拦截 insertBreak（Enter 键）以继承 bullet 属性
  editor.insertBreak = () => {
    const { selection } = editor;
    
    if (selection) {
      // 查找当前段落节点
      const [paragraphNode] = Editor.nodes(editor, {
        match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'paragraph',
      });
      
      if (paragraphNode) {
        const [node] = paragraphNode;
        const para = node as any;
        
        // 如果当前段落有 bullet 属性，在分割后继承
        if (para.bullet) {
          const bulletLevel = para.bulletLevel || 0;
          
          // 执行默认的分割操作
          insertBreak();
          
          // 为新段落设置 bullet 属性
          const [newParagraphNode] = Editor.nodes(editor, {
            match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'paragraph',
          });
          
          if (newParagraphNode) {
            Transforms.setNodes(editor, { 
              bullet: true, 
              bulletLevel: bulletLevel 
            } as any);
          }
          
          return;
        }
      }
    }
    
    // 默认行为
    insertBreak();
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

    // 🆕 v1.8.4: Bullet 层级规范化 - 确保层级连续
    // 注意：这个检查在删除操作后也会自动触发
    if (SlateElement.isElement(node) && node.type === 'event-line') {
      const eventLine = node as EventLineNode;
      
      // 只处理 eventlog 模式的 bullet 行
      if (eventLine.mode === 'eventlog') {
        const paragraphs = eventLine.children || [];
        const paragraph = paragraphs[0] as any;
        
        if (paragraph?.bullet) {
          const currentLevel = eventLine.level || 0;
          
          // 查找前面最近的 bullet 行
          const allLines = Array.from(Editor.nodes(editor, {
            at: [],
            match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'event-line',
          }));
          
          const currentIndex = allLines.findIndex(([, p]) => Path.equals(p, path));
          let previousLevel = -1;
          
          for (let i = currentIndex - 1; i >= 0; i--) {
            const [prevNode] = allLines[i];
            const prevLine = prevNode as EventLineNode;
            if (prevLine.mode === 'eventlog') {
              const prevParas = prevLine.children || [];
              const prevPara = prevParas[0] as any;
              if (prevPara?.bullet) {
                previousLevel = prevLine.level || 0;
                break;
              }
            }
          }
          
          // 规则 1: 第一个 bullet 行必须是 level 0
          if (previousLevel === -1 && currentLevel > 0) {
            console.log('%c[normalizeNode] 🔧 第一个 bullet 行降级为 level 0', 'background: #FF9800; color: white;', {
              currentLevel,
            });
            
            Transforms.setNodes(editor, { level: 0 }, { at: path });
            Transforms.setNodes(editor, { bulletLevel: 0 } as any, { at: [...path, 0] });
            return; // 修复一个问题后返回
          }
          
          // 规则 2: 当前层级不能比前一个层级高出 1 以上
          if (previousLevel >= 0 && currentLevel > previousLevel + 1) {
            const normalizedLevel = previousLevel + 1;
            
            console.log('%c[normalizeNode] 🔧 修正 bullet 层级跳跃', 'background: #FF9800; color: white;', {
              currentLevel,
              previousLevel,
              normalizedLevel,
            });
            
            Transforms.setNodes(editor, { level: normalizedLevel }, { at: path });
            Transforms.setNodes(editor, { bulletLevel: normalizedLevel } as any, { at: [...path, 0] });
            return; // 修复一个问题后返回
          }
        }
      }
    }

    // 对于其他节点，执行默认的 normalize
    normalizeNode(entry);
  };

  return editor;
};

/**
 * 🆕 v1.8.4: 删除行后自动调整后续 bullet 行的层级
 * 规则：按 eventId 分组，每个 event 内部独立检查
 * 1. 每个 event 的第一个 bullet 行必须是 level 0
 * 2. 当前层级不能比前一个层级高出 1 以上
 */
function adjustBulletLevelsAfterDelete(editor: CustomEditor) {
  // 延迟执行，确保删除操作完成
  setTimeout(() => {
    console.log('%c[删除后调整] 开始检查 bullet 层级', 'background: #9C27B0; color: white;');
    
    const allLines = Array.from(Editor.nodes(editor, {
      at: [],
      match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'event-line',
    }));
    
    // 按 eventId 分组收集 bullet 行
    const eventGroups = new Map<string, Array<{
      lineNode: EventLineNode;
      linePath: number[];
      currentLevel: number;
      currentBulletLevel: number;
    }>>();
    
    for (const [lineNode, linePath] of allLines) {
      const line = lineNode as EventLineNode;
      
      // 只处理 eventlog 模式的 bullet 行
      if (line.mode !== 'eventlog') continue;
      
      const paragraphs = line.children || [];
      const paragraph = paragraphs[0] as any;
      if (!paragraph?.bullet) continue;
      
      const eventId = line.eventId;
      if (!eventGroups.has(eventId)) {
        eventGroups.set(eventId, []);
      }
      
      eventGroups.get(eventId)!.push({
        lineNode: line,
        linePath: linePath as number[],
        currentLevel: line.level || 0,
        currentBulletLevel: paragraph.bulletLevel || 0,
      });
    }
    
    console.log('%c[删除后调整] 按 event 分组', 'background: #2196F3; color: white;', {
      eventCount: eventGroups.size,
      groups: Array.from(eventGroups.entries()).map(([eventId, lines]) => ({
        eventId: eventId.slice(-10),
        bulletCount: lines.length,
        levels: lines.map(l => l.currentLevel),
      })),
    });
    
    let totalAdjustments = 0;
    
    // 对每个 event 的 bullet 行独立检查
    for (const [eventId, bulletLines] of eventGroups) {
      if (bulletLines.length === 0) continue;
      
      let needsAdjustment = false;
      
      for (let i = 0; i < bulletLines.length; i++) {
        const current = bulletLines[i];
        const previous = i > 0 ? bulletLines[i - 1] : null;
        
        let newLevel: number | null = null;
        
        // 规则 1: 每个 event 的第一个 bullet 行必须是 level 0
        if (i === 0 && current.currentLevel > 0) {
          newLevel = 0;
          console.log('%c[删除后调整] Event 第一行降级为 level 0', 'background: #FF9800; color: white;', {
            eventId: eventId.slice(-10),
            bulletIndex: i,
            oldLevel: current.currentLevel,
          });
        }
        // 规则 2: 当前层级不能比前一个层级高出 1 以上
        else if (previous && current.currentLevel > previous.currentLevel + 1) {
          newLevel = previous.currentLevel + 1;
          console.log('%c[删除后调整] 修正层级跳跃', 'background: #FF9800; color: white;', {
            eventId: eventId.slice(-10),
            bulletIndex: i,
            oldLevel: current.currentLevel,
            previousLevel: previous.currentLevel,
            newLevel,
          });
        }
        
        // 执行调整
        if (newLevel !== null) {
          needsAdjustment = true;
          totalAdjustments++;
          
          // 同时更新 EventLine.level 和 paragraph.bulletLevel
          Transforms.setNodes(editor, { level: newLevel }, { at: current.linePath });
          Transforms.setNodes(editor, { bulletLevel: newLevel } as any, { at: [...current.linePath, 0] });
          
          // 更新当前记录，供后续行参考
          current.currentLevel = newLevel;
        }
      }
    }
    
    if (totalAdjustments > 0) {
      console.log('%c[删除后调整] ✅ Bullet 层级已修正', 'background: #4CAF50; color: white;', {
        调整次数: totalAdjustments,
      });
    } else {
      console.log('%c[删除后调整] ℹ️ 无需调整', 'background: #607D8B; color: white;');
    }
  }, 0);
}

export const PlanSlate: React.FC<PlanSlateProps> = ({
  items,
  onChange,
  onFocus,
  onEditorReady,
  onDeleteRequest,  // 🆕 删除请求回调
  onSave,  // 🆕 保存回调
  onTimeClick,  // 🆕 时间点击回调
  onMoreClick,  // 🆕 More 图标点击回调
  getEventStatus,  // 🆕 获取事件状态
  eventId,  // 🆕 当前事件ID
  enableTimestamp = false,  // 🆕 是否启用 timestamp
  className = '',
}) => {
  // 🔍 版本标记 - 用于验证代码是否被加载
  console.log('%c[PlanSlate v2.15] 组件加载 - 包含 itemsHash 详细日志', 'background: #4ECDC4; color: white; font-weight: bold; padding: 4px 8px;');
  
  // 🆕 Debug: 检查 timestamp 相关的 props
  console.log('[PlanSlate] 初始化参数:', {
    eventId,
    enableTimestamp,
    hasItems: !!items,
    itemsLength: items?.length || 0,
    eventIdType: typeof eventId,
    enableTimestampType: typeof enableTimestamp
  });
  
  // 🆕 Debug: 监听 eventId 和 enableTimestamp 的变化
  React.useEffect(() => {
    console.log('[PlanSlate] Props 变化:', { eventId, enableTimestamp });
  }, [eventId, enableTimestamp]);
  // 🔍 组件挂载日志
  React.useEffect(() => {
    if (isDebugEnabled()) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
      window.console.log(`%c[🚀 ${timestamp}] PlanSlate - 调试模式已开启`, 
        'background: #4CAF50; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;');
      window.console.log(`%c关闭调试: localStorage.removeItem('SLATE_DEBUG') 然后刷新`, 
        'color: #9E9E9E; font-style: italic;');
    } else {
      window.console.log('%c💡 开启调试: 在控制台运行 window.SLATE_DEBUG = true 然后刷新（会自动保存）', 
        'color: #9E9E9E; font-style: italic;');
      window.console.log('%c💡 开启 useEventTime 调试: window.USE_EVENT_TIME_DEBUG = true', 
        'color: #9E9E9E; font-style: italic;');
    }
    
    return () => {
      if (isDebugEnabled()) {
        window.console.log(`%c[👋 ${new Date().toISOString().split('T')[1].slice(0, 12)}] PlanSlate unmounted`, 
          'background: #f44336; color: white; padding: 4px 8px; border-radius: 3px;');
      }
    };
  }, [items.length]);
  
  // 创建编辑器实例
  const editor = useMemo(() => withCustom(withHistory(withReact(createEditor() as CustomEditor))), []);
  
  // 🆕 v2.3: 暴露编辑器实例到全局（供 DateMentionElement 使用）
  useEffect(() => {
    (window as any).__slateEditor = editor;
    return () => {
      delete (window as any).__slateEditor;
    };
  }, [editor]);
  
  // 🆕 增强的 value：始终在末尾添加一个 placeholder 提示行
  // 🛡️ PERFORMANCE FIX: 添加深度比较避免不必要的重计算
  const itemsHash = useMemo(() => {
    const hash = items.map((item, index) => {
      // 🔧 修复：正确处理 EventTitle 对象
      const titleStr = typeof item.title === 'string' 
        ? item.title 
        : (item.title?.simpleTitle || item.title?.colorTitle || '');
      
      // 🔧 包含更多字段，确保 eventlog、tags、时间 变化也能触发更新
      const tagsStr = (item.tags || []).join(',');
      
      // 🔍 诊断：详细记录 eventlog 处理
      const eventlog = (item as any).eventlog;
      const eventlogType = typeof eventlog;
      const isObject = eventlogType === 'object' && eventlog !== null;
      const plainText = isObject ? eventlog.plainText : undefined;
      const eventlogStr = isObject 
        ? (plainText?.substring(0, 50) || '')
        : (eventlog?.substring(0, 50) || '');
      
      if (index < 5) {  // 只记录前5个事件
        console.log(`[itemsHash] Event[${index}] ${titleStr}:`, {
          eventlogType,
          isObject,
          hasPlainText: !!plainText,
          plainTextLength: plainText?.length || 0,
          plainTextPreview: plainText?.substring(0, 30) || 'N/A',
          eventlogStr,
          eventlogStrLength: eventlogStr.length
        });
      }
      
      // 🔧 包含时间字段：startTime、endTime、dueDate、isAllDay
      const timeStr = `${item.startTime || ''}-${item.endTime || ''}-${item.dueDate || ''}-${item.isAllDay ? '1' : '0'}`;
      
      const itemHash = `${item.id}-${titleStr}-${tagsStr}-${eventlogStr}-${timeStr}-${item.updatedAt}`;
      
      // 🔍 记录 Event[3] 的完整 hash
      if (index === 3) {
        console.log('%c[itemsHash] Event[3] 完整 hash:', 'background: #FF6B6B; color: white; padding: 2px 6px;', {
          itemHash,
          id: item.id.slice(-10),
          titleStr,
          tagsStr,
          eventlogStr: `[${eventlogStr.length}] ${eventlogStr}`,
          timeStr,
          updatedAt: item.updatedAt
        });
      }
      
      return itemHash;
    }).join('|');
    
    console.log('%c[🔍 itemsHash 重新计算]', 'background: #9C27B0; color: white; padding: 2px 6px;', {
      itemsLength: items.length,
      hashLength: hash.length,
      hashPreview: hash.substring(0, 100) + '...',
      event3Position: hash.indexOf('line-1764340875831-0.9592671205692446')
    });
    
    return hash;
  }, [items]);
  
  const enhancedValue = useMemo(() => {
    // 🚨 DIAGNOSIS: 记录 enhancedValue 计算过程
    vlog('🔍 [诊断] enhancedValue 重新计算:', {
      items数量: items.length,
      itemsHash: itemsHash.substring(0, 50) + '...',
      时间戳: new Date().toISOString()
    });
    
    const baseNodes = planItemsToSlateNodes(items);
    
    // 🚨 DIAGNOSIS: 检测 planItemsToSlateNodes 返回空数组
    if (baseNodes.length === 0 && items.length > 0) {
      vlog('🔴 [诊断] planItemsToSlateNodes 返回空数组！', {
        items数量: items.length,
        items示例: items.slice(0, 3).map(i => ({ id: i.id, title: i.title?.simpleTitle?.substring(0, 20) || '' }))
      });
    }
    
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
    
    const result = [...baseNodes, placeholderLine];
    
    // 🚨 DIAGNOSIS: 记录 enhancedValue 最终结果
    vlog('📊 [诊断] enhancedValue 计算完成:', {
      baseNodes数量: baseNodes.length,
      最终数量: result.length,
      items数量: items.length
    });
    
    return result;
  }, [itemsHash]); // 使用itemsHash代替items直接依赖
  
  // 初始化内容
  const [value, setValue] = useState<EventLineNode[]>(() => {
    console.log('%c[🎯 useState 初始化] 使用 enhancedValue', 'background: #4CAF50; color: white; padding: 2px 6px;', {
      enhancedValueLength: enhancedValue.length,
      hasPlaceholder: enhancedValue.some(n => n.eventId === '__placeholder__')
    });
    return enhancedValue;
  });
  
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
  
  // 🔧 不需要单独的初始化逻辑，直接通过 useState 和后续的 enhancedValue useEffect 处理
  const isInitializedRef = React.useRef(false);
  
  // 🔥 智能增量更新：逐个比较 items，只更新变化的 Events
  
  // 🆕 监听 enhancedValue 变化，同步更新 value
  useEffect(() => {
    console.log('%c[🔍 enhancedValue useEffect 触发]', 'background: #E91E63; color: white; padding: 2px 6px;', {
      isInitialized: isInitializedRef.current,
      enhancedValueLength: enhancedValue.length,
      valueLength: value.length
    });
    
    // 🔥 首次初始化：标记为已初始化（value 已在 useState 时设置）
    if (!isInitializedRef.current) {
      console.log('%c[🎉 首次初始化] 标记为已初始化', 'background: #4CAF50; color: white; padding: 2px 6px;', {
        enhancedValueLength: enhancedValue.length,
        valueLength: value.length
      });
      isInitializedRef.current = true;
      
      // 🔧 如果 enhancedValue 有内容但 value 为空，同步一次
      if (enhancedValue.length > 0 && value.length === 0) {
        console.log('%c[⚠️ 修正] value 为空，使用 enhancedValue', 'background: #FF9800; color: white;');
        setValue(enhancedValue);
      }
      return; // ✅ 首次初始化完成，直接返回，不再同步
    }
    
    // 🔥 后续更新：检查用户是否正在编辑
    
    const hasSelection = !!editor.selection;
    const hasPendingChanges = !!pendingChangesRef.current;
    
    if (!hasSelection && !hasPendingChanges) {
      // 🔄 用户未在编辑，直接替换整个 value
      console.log('%c[🔄 同步 enhancedValue] 用户未编辑，全量更新', 'background: #4CAF50; color: white; padding: 2px 6px;', {
        oldLength: value.length,
        newLength: enhancedValue.length,
        enhancedValue: enhancedValue.map((n, i) => ({ 
          index: i,
          eventId: n.eventId?.slice(-10), 
          type: n.type,
          hasChildren: !!n.children,
          childrenCount: n.children?.length || 0,
          firstChild: n.children?.[0]?.type
        }))
      });
      
      // 🔧 安全检查：确保 enhancedValue 不为空，且与当前 value 不同
      if (enhancedValue.length > 0) {
        // 🔍 对比 enhancedValue 和 value 是否真的不同
        const isDifferent = enhancedValue.length !== value.length || 
          !enhancedValue.every((node, i) => node.eventId === value[i]?.eventId);
        
        if (!isDifferent) {
          console.log('%c[⏭️ 同步跳过] enhancedValue 与 value 相同，无需更新', 'background: #2196F3; color: white; padding: 2px 6px;');
          return;
        }
        
        skipNextOnChangeRef.current = true;
        
        // 🔥 使用 Slate Transforms API 直接更新内容（而不是重新挂载编辑器）
        Editor.withoutNormalizing(editor, () => {
          // 删除所有旧内容
          editor.children.splice(0, editor.children.length);
          // 插入新内容
          editor.children.push(...enhancedValue);
          // 触发编辑器更新
          editor.onChange();
        });
        
        // 同时更新 React state（保持一致性）
        setValue(enhancedValue);
        
        console.log('%c[✅ 同步完成] Transforms.replace 已调用', 'background: #4CAF50; color: white; padding: 2px 6px;', {
          newLength: enhancedValue.length,
          skipNextOnChange: skipNextOnChangeRef.current,
          method: 'Transforms API (高性能)'
        });
      } else {
        console.warn('%c[⚠️ 同步跳过] enhancedValue 为空，保持当前 value', 'background: #FF9800; color: white;');
      }
    } else {
      // 🔧 用户正在编辑时，不做任何更新，避免干扰编辑
      // 原因：增量更新逻辑复杂且容易出错，用户保存时会触发 eventsUpdated 事件
      console.log('%c[🔄 同步跳过] 用户正在编辑，延迟更新', 'background: #FF9800; color: white; padding: 2px 6px;', {
        hasSelection,
        hasPendingChanges
      });
    }
  }, [enhancedValue, editor]); // 依赖 enhancedValue，items 变化时重新计算
  
  // 🔥 订阅 window.eventsUpdated 事件，接收增量更新通知
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    const handleEventUpdated = (e: any) => {
      const { eventId, isDeleted, isNewEvent } = e.detail || {};
      
      console.log('%c[📡 eventsUpdated] 收到事件', 'background: #9C27B0; color: white; padding: 2px 6px;', {
        eventId, isDeleted, isNewEvent
      });
      
      // 🆕 循环更新防护：跳过本组件相关的更新
      const { updateId, isLocalUpdate, originComponent } = e.detail || {};
      
      // 🚫 多重检查避免循环
      if (isLocalUpdate || 
          originComponent === 'PlanManager' || 
          recentlySavedEventsRef.current.has(eventId) ||
          (updateId && EventService.isLocalUpdate(eventId, updateId))) {
        console.log('%c[🔄 跳过] 本组件相关的更新，避免循环', 'background: #FF9800; color: white;', {
          eventId: eventId?.slice(-10),
          isLocalUpdate,
          originComponent,
          hasRecentlySaved: recentlySavedEventsRef.current.has(eventId),
        });
        return;
      }
      
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
          
          // 🆕 v1.8.4: 外部同步删除后，自动调整 bullet 层级
          adjustBulletLevelsAfterDelete(editor);
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
            isCompleted: updatedEvent.isCompleted,
            isTask: updatedEvent.isTask,
            type: updatedEvent.type,
            checkType: updatedEvent.checkType || 'once', // 🔧 FIX: 添加 checkType 字段
            checked: updatedEvent.checked, // 🔧 FIX: 同步 checked 数组
            unchecked: updatedEvent.unchecked, // 🔧 FIX: 同步 unchecked 数组
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
          console.log('%c[✏️ 更新 Slate metadata]', 'background: #2196F3; color: white; padding: 2px 6px;', {
            eventId: eventId?.slice(-10),
            checked: newMetadata.checked,
            unchecked: newMetadata.unchecked,
            oldChecked: currentNode.metadata?.checked,
            oldUnchecked: currentNode.metadata?.unchecked,
          });
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
                
                // 🔥 移除自动同步逻辑：不再自动更新 DateMention 的时间
                // DateMention 应该保持原始时间，让用户通过 hover popover 手动选择是否更新
                // 只有用户点击"更新"按钮时，才同步到 TimeHub 的最新时间
                
                // if (dateMentionNode.eventId === eventId) {
                //   const dateMentionPath = [index, paragraphIndex, childIndex];
                //   const newDateMention = {
                //     startDate: updatedEvent.startTime || dateMentionNode.startDate,
                //     endDate: updatedEvent.endTime || dateMentionNode.endDate,
                //   };
                //   
                //   console.log(`%c[📅 更新 DateMention]`, 'background: #4CAF50; color: white; padding: 2px 6px;', {
                //     path: dateMentionPath,
                //     旧startDate: dateMentionNode.startDate,
                //     新startDate: newDateMention.startDate,
                //     旧endDate: dateMentionNode.endDate,
                //     新endDate: newDateMention.endDate,
                //   });
                //   
                //   Transforms.setNodes(
                //     editor,
                //     newDateMention as any,
                //     { at: dateMentionPath }
                //   );
                // }
              }
            });
          });
        });
      });
      
      console.log('%c[🔄 强制重新渲染]', 'background: #FF5722; color: white; padding: 2px 6px;', {
        eventId: eventId?.slice(-10),
        skipNextOnChange: true,
        editorChildrenCount: editor.children.length
      });
      skipNextOnChangeRef.current = true;
      setValue([...editor.children] as unknown as EventLineNode[]);
    };
    
    window.addEventListener('eventsUpdated', handleEventUpdated);
    return () => window.removeEventListener('eventsUpdated', handleEventUpdated);
  }, [items, value, editor, enhancedValue]);
  
  // ==================== 内容变化处理 ====================
  
  // 🆕 自动保存定时器
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = React.useRef<Descendant[] | null>(null);
  
  // 🆕 @提及状态
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionText, setMentionText] = useState('');
  const mentionAnchorRef = useRef<HTMLElement | null>(null);
  const [mentionInitialStart, setMentionInitialStart] = useState<Date | undefined>();
  const [mentionInitialEnd, setMentionInitialEnd] = useState<Date | undefined>();
  
  // 🔍 Unified Mention 状态（事件/标签/AI搜索）
  const [mentionType, setMentionType] = useState<'time' | 'search' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  
  // 🆕 v1.8: 跟踪最近保存的事件ID，避免增量更新覆盖
  const recentlySavedEventsRef = React.useRef<Set<string>>(new Set());
  
  // 🕐 Timestamp 服务
  const timestampServiceRef = useRef(new EventLogTimestampService());
  
  // 🧪 Manual timestamp insertion for testing (expose to window for debugging)
  useEffect(() => {
    if (isDebugEnabled() && typeof window !== 'undefined') {
      (window as any).insertTimestamp = (eventId: string) => {
        try {
          timestampServiceRef.current.insertTimestamp(editor, eventId);
        } catch (error) {
          console.error('[Timestamp Debug] 插入失败:', error);
        }
      };
      console.log('%c💡 调试命令可用: window.insertTimestamp("test-event-id")', 'color: #FF9800; font-weight: bold;');
    }
  }, [editor]);
  
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
    
    // 🆕 v1.8.4: 检测是否有删除节点操作
    const hasRemoveNode = editor.operations.some(op => op.type === 'remove_node');
    
    if (hasRemoveNode) {
      console.log('%c[🔍 检测到删除操作]', 'background: #FF5722; color: white;', {
        operations: editor.operations.filter(op => op.type === 'remove_node'),
      });
      
      // 删除后自动调整 bullet 层级
      adjustBulletLevelsAfterDelete(editor);
    }
    
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
    // 🚨 DIAGNOSIS: 检测 setValue 被调用时的异常
    const newValueAsNodes = newValue as unknown as EventLineNode[];
    const hasRealContent = newValueAsNodes.some(node => node.eventId !== '__placeholder__');
    
    if (!hasRealContent && value.some(node => node.eventId !== '__placeholder__')) {
      console.error('🔴 [诊断] setValue 即将清空编辑器！', {
        当前value有内容: value.filter(n => n.eventId !== '__placeholder__').length,
        新value只有placeholder: !hasRealContent,
        newValue数量: newValueAsNodes.length,
        调用栈: new Error().stack?.split('\n').slice(0, 10)
      });
    }
    
    setValue(newValueAsNodes);
    
    // 🆕 检测@提及触发
    if (editor.selection && Range.isCollapsed(editor.selection)) {
      try {
        const { anchor } = editor.selection;
        const [node] = Editor.node(editor, anchor.path);
        
        if (SlateText.isText(node)) {
          const textBeforeCursor = node.text.slice(0, anchor.offset);
          const atMatch = textBeforeCursor.match(/@([^\s]*)$/);
          
          if (atMatch) {
            const text = atMatch[1];
            console.log('[@ Mention] 检测到@输入:', text);
            
            // 🔍 优先级1: 尝试时间解析（只在有输入时）
            if (text.length > 0) {
              const parsed = parseNaturalLanguage(text);
              console.log('[@ Mention] 解析结果:', { 
                text, 
                parsed,
                hasDaterRange: !!parsed?.dateRange,
                hasTimePeriod: !!parsed?.timePeriod,
                hasPointInTime: !!parsed?.pointInTime,
              });
              
              if (parsed && parsed.matched) {
                // ✅ 时间解析成功 → 显示时间选择器
                console.log('[@ Mention] 时间解析成功 - 详细信息:', {
                  dateRange: parsed.dateRange,
                  timePeriod: parsed.timePeriod,
                  pointInTime: parsed.pointInTime,
                });
                
                setMentionType('time');
                setShowSearchMenu(false);
                
                // 提取开始和结束时间
                let startTime: Date | undefined;
                let endTime: Date | undefined;
                
                // 优先检查复合解析结果（日期+时间段组合）
                if (parsed.dateRange && parsed.timePeriod) {
                  // 情况1: "下周二下午3点" - dateRange提供日期，timePeriod提供时间
                  const baseDate = parsed.dateRange.start.toDate();
                  startTime = new Date(baseDate);
                  startTime.setHours(parsed.timePeriod.startHour, parsed.timePeriod.startMinute, 0, 0);
                  
                  if (parsed.timePeriod.endHour > 0 || parsed.timePeriod.endMinute > 0) {
                    endTime = new Date(baseDate);
                    endTime.setHours(parsed.timePeriod.endHour, parsed.timePeriod.endMinute, 0, 0);
                  }
                  console.log('[@ Mention] 日期+时间段组合:', { baseDate, startTime, endTime });
                } else if (parsed.dateRange) {
                  // 情况2: 纯日期范围 "下周"
                  startTime = parsed.dateRange.start.toDate();
                  endTime = parsed.dateRange.end?.toDate();
                } else if (parsed.pointInTime) {
                  // 情况3: 精确时间点 "明天10点"
                  startTime = parsed.pointInTime.date.toDate();
                } else if (parsed.timePeriod) {
                  // 情况4: 纯时间段 "下午3点"（今天）
                  const period = parsed.timePeriod;
                  const baseDate = new Date();
                  baseDate.setHours(period.startHour, period.startMinute, 0, 0);
                  startTime = baseDate;
                  
                  if (period.endHour > 0 || period.endMinute > 0) {
                    const endDate = new Date();
                    endDate.setHours(period.endHour, period.endMinute, 0, 0);
                    endTime = endDate;
                  }
                }
                
                if (startTime) {
                  // 创建虚拟 anchor 元素用于 Tippy 定位
                  const domRange = ReactEditor.toDOMRange(editor, editor.selection);
                  const rect = domRange.getBoundingClientRect();
                  
                  if (!mentionAnchorRef.current) {
                    const anchor = document.createElement('span');
                    anchor.style.position = 'absolute';
                    anchor.style.width = '1px';
                    anchor.style.height = '1px';
                    document.body.appendChild(anchor);
                    mentionAnchorRef.current = anchor;
                  }
                  
                  mentionAnchorRef.current.style.top = `${rect.bottom}px`;
                  mentionAnchorRef.current.style.left = `${rect.left}px`;
                  
                  setMentionText(text);
                  setMentionInitialStart(startTime);
                  setMentionInitialEnd(endTime);
                  setShowMentionPicker(true);
                } else {
                  setShowMentionPicker(false);
                }
              } else if (text.length >= 0) {
                // 🔍 优先级2: 时间解析失败 → 显示搜索菜单（包括空查询 @）
                console.log('[@ Mention] 时间解析失败，触发搜索菜单:', text);
                console.log('[@ Mention] 准备显示搜索菜单，状态:', {
                  mentionType: 'search',
                  searchQuery: text,
                  showSearchMenu: true
                });
                
                setMentionType('search');
                setSearchQuery(text);
                setShowMentionPicker(false);
                setShowSearchMenu(true);
                
                // 创建虚拟 anchor 元素用于 Tippy 定位
                const domRange = ReactEditor.toDOMRange(editor, editor.selection);
                const rect = domRange.getBoundingClientRect();
                
                if (!mentionAnchorRef.current) {
                  const anchor = document.createElement('span');
                  anchor.style.position = 'absolute';
                  anchor.style.width = '1px';
                  anchor.style.height = '1px';
                  document.body.appendChild(anchor);
                  mentionAnchorRef.current = anchor;
                }
                
                mentionAnchorRef.current.style.top = `${rect.bottom}px`;
                mentionAnchorRef.current.style.left = `${rect.left}px`;
              }
            } else {
              // 空输入（只输入 @），显示搜索菜单
              console.log('[@ Mention] 空输入，显示搜索菜单');
              
              setMentionType('search');
              setSearchQuery('');
              setShowMentionPicker(false);
              setShowSearchMenu(true);
              
              // 创建虚拟 anchor 元素用于 Tippy 定位
              const domRange = ReactEditor.toDOMRange(editor, editor.selection);
              const rect = domRange.getBoundingClientRect();
              
              if (!mentionAnchorRef.current) {
                const anchor = document.createElement('span');
                anchor.style.position = 'absolute';
                anchor.style.width = '1px';
                anchor.style.height = '1px';
                document.body.appendChild(anchor);
                mentionAnchorRef.current = anchor;
              }
              
              mentionAnchorRef.current.style.top = `${rect.bottom}px`;
              mentionAnchorRef.current.style.left = `${rect.left}px`;
            }
          } else {
            // 没有检测到 @，关闭所有菜单
            setShowMentionPicker(false);
            setShowSearchMenu(false);
          }
        } else {
          // 不是文本节点
          if (showMentionPicker || showSearchMenu) {
            console.log('[@ Mention] 不在文本节点，清除状态');
            setShowMentionPicker(false);
            setShowSearchMenu(false);
          }
        }
      } catch (err) {
        console.error('[@ Mention] 检测失败:', err);
      }
    }
    
    // 🔥 缓存待保存的变化，但不立即调用 onChange
    pendingChangesRef.current = newValue;
    
    // 🔥 清除之前的自动保存定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // 🆕 v2.10.1: 当用户正在输入 @ 提及时，不触发自动保存
    // 等用户确认 DateMention 后，会调用 flushPendingChanges() 手动保存
    if (showMentionPicker) {
      if (isDebugEnabled()) {
        console.log(`%c[⏸️ ${timestamp}] @ 提及输入中，暂停自动保存`, 
          'background: #FF9800; color: white; padding: 2px 6px; border-radius: 2px;');
      }
      return;
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
        
        // 🚨 DIAGNOSIS: 检测序列化返回空数组
        if (filteredNodes.length === 0) {
          console.error('🔴 [诊断] 自动保存 - filteredNodes 为空！', {
            pendingChanges数量: (pendingChangesRef.current as any[])?.length,
            调用栈: new Error().stack?.split('\n').slice(0, 10)
          });
        }
        
        const planItems = slateNodesToPlanItems(filteredNodes);
        
        // 🚨 DIAGNOSIS: 检测序列化返回空数组
        if (planItems.length === 0 && filteredNodes.length > 0) {
          console.error('🔴 [诊断] slateNodesToPlanItems 返回空数组！', {
            filteredNodes数量: filteredNodes.length,
            planItems数量: planItems.length,
            filteredNodes示例: filteredNodes.slice(0, 3).map(n => ({
              eventId: n.eventId,
              lineId: n.lineId,
              mode: n.mode,
              children数量: n.children.length
            }))
          });
        }
        
        // 🚨 DIAGNOSIS: 检测序列化返回空数组
        if (planItems.length === 0 && filteredNodes.length > 0) {
          console.error('🔴 [诊断] slateNodesToPlanItems 返回空数组！', {
            filteredNodes数量: filteredNodes.length,
            planItems数量: planItems.length,
            filteredNodes示例: filteredNodes.slice(0, 3).map(n => ({
              eventId: n.eventId,
              lineId: n.lineId,
              mode: n.mode,
              children数量: n.children.length
            }))
          });
        }
        
        // 检测 eventlog 行删除
        planItems.forEach(item => {
          const hasDescriptionNode = filteredNodes.some(node => {
            const eventLine = node as EventLineNode;
            return (eventLine.eventId === item.eventId || eventLine.lineId.startsWith(item.id)) 
                   && eventLine.mode === 'eventlog';
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
      
      // 检测 eventlog 行删除
      planItems.forEach(item => {
        const hasDescriptionNode = filteredNodes.some(node => {
          const eventLine = node as EventLineNode;
          return (eventLine.eventId === item.eventId || eventLine.lineId.startsWith(item.id)) 
                 && eventLine.mode === 'eventlog';
        });
        
        if (!hasDescriptionNode && item.description) {
          item.description = '';
        }
      });
      
      // 🆕 v1.8.4: 记录保存的事件ID，避免增量更新覆盖
      // 延长保护时间窗口到 3 秒，确保外部同步返回时不会覆盖
      planItems.forEach(item => {
        recentlySavedEventsRef.current.add(item.id);
        console.log('%c[🛡️ 保护] 标记事件为刚保存', 'background: #4CAF50; color: white;', {
          eventId: item.id.slice(-10),
          保护时长: '3秒',
        });
      });
      // 3秒后清除（给外部同步足够时间）
      setTimeout(() => {
        planItems.forEach(item => {
          recentlySavedEventsRef.current.delete(item.id);
          console.log('%c[🛡️ 解除] 移除事件保护', 'background: #9E9E9E; color: white;', {
            eventId: item.id.slice(-10),
          });
        });
      }, 3000);
      
      onChange(planItems);
      pendingChangesRef.current = null;
    }
    
    // 🕐 Timestamp 自动插入检测
    const hasTextInsertion = editor.operations.some(op => 
      op.type === 'insert_text' && (op as any).text.trim().length > 0
    );
    
    console.log('[Timestamp Debug] 操作检测:', {
      operations: editor.operations.map(op => ({ type: op.type, text: op.type === 'insert_text' ? (op as any).text : undefined })),
      hasTextInsertion,
      hasSelection: !!editor.selection,
      enableTimestamp,
      eventId
    });
    
    // 🆕 逐一检查所有条件
    console.log('[Timestamp Debug] 条件检查:', {
      hasTextInsertion,
      enableTimestamp,
      eventId,
      eventIdTruthy: !!eventId,
      allConditionsMet: hasTextInsertion && enableTimestamp && eventId
    });

    if (hasTextInsertion && enableTimestamp && eventId) {
      console.log('[Timestamp Debug] 所有条件满足，进行 eventId 检查:', {
        eventId,
        isPlaceholder: eventId === '__placeholder__',
        shouldInsert: timestampServiceRef.current.shouldInsertTimestamp(eventId)
      });
      
      if (eventId !== '__placeholder__' && timestampServiceRef.current.shouldInsertTimestamp(eventId)) {
        console.log('[Timestamp] 需要插入时间戳', { eventId: eventId.slice(-8) });
        
        // 延迟插入以避免与当前操作冲突
        setTimeout(() => {
          try {
            timestampServiceRef.current.insertTimestamp(editor, eventId);
          } catch (error) {
            console.error('[Timestamp] 插入失败:', error);
          }
        }, 100);
      } else {
        console.log('[Timestamp Debug] 跳过插入:', {
          isPlaceholder: eventId === '__placeholder__',
          shouldInsert: timestampServiceRef.current.shouldInsertTimestamp(eventId)
        });
      }
    } else {
      console.log('[Timestamp Debug] 条件不满足，跳过时间戳检测');
    }
    
  }, [onChange]);
  
  // 通知编辑器就绪（传递带 syncFromExternal 和 flushPendingChanges 方法的对象）
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
        
        // 🆕 暴露 flushPendingChanges 到外部
        flushPendingChanges,
      });
    }
  }, [editor, onEditorReady, flushPendingChanges]);
  
  // ==================== 焦点变化处理 ====================
  
  // 🆕 @提及搜索框变化回调（实时更新解析结果）
  const handleMentionSearchChange = useCallback((text: string, parsed: { start?: Date; end?: Date } | null) => {
    setMentionText(text);
    if (parsed && parsed.start) {
      setMentionInitialStart(parsed.start);
      setMentionInitialEnd(parsed.end);
    }
  }, []);
  
  // 🆕 @提及选择时间
  const handleMentionSelect = useCallback(async (startStr: string, endStr?: string, allDay?: boolean, userInputText?: string) => {
    if (!editor.selection) return;
    
    try {
      // 🔧 使用 UnifiedDateTimePicker 传递的完整文本，回退到 mentionText
      const finalUserText = userInputText || mentionText || '';
      console.log('[@ Mention] 确认插入:', { startStr, endStr, mentionText, userInputText, finalUserText });
      
      // 找到@符号的位置
      const { anchor } = editor.selection;
      const [node, path] = Editor.node(editor, anchor.path);
      
      if (SlateText.isText(node)) {
        const textBeforeCursor = node.text.slice(0, anchor.offset);
        const atMatch = textBeforeCursor.match(/@([^\s]*)$/);
        
        if (atMatch) {
          const atStartOffset = anchor.offset - atMatch[0].length;
          // 🔧 不再使用 atMatch[1]，因为它只是 @ 后的文本，可能不完整
          // const userInputText = atMatch[1]; // 旧代码
          
          // 删除整个 @xxx 文本（包括 @ 符号和用户输入）
          Transforms.delete(editor, {
            at: {
              anchor: { path, offset: atStartOffset },
              focus: { path, offset: anchor.offset }, // 删除到光标位置
            },
          });
          
          // 不需要移动光标，删除后光标已经在正确位置
          
          // 获取当前事件ID
          const match = Editor.above(editor, {
            match: n => (n as any).type === 'event-line',
          });
          
          let eventId: string | undefined;
          if (match) {
            const [eventLineNode] = match;
            eventId = (eventLineNode as EventLineNode).eventId;
            console.log('[@ Mention] 找到父 event-line', { eventId });
          } else {
            console.warn('[@ Mention] 未找到父 event-line，eventId 为 undefined', {
              selection: editor.selection,
              currentPath: editor.selection ? Path.parent(editor.selection.anchor.path) : null,
            });
          }
          
          // 🔧 [架构修复] 新事件创建时，不调用 TimeHub.setEventTime()
          // 原因：
          // 1. 事件还不存在于 EventService，TimeHub.setEventTime() 会失败
          // 2. serialization.ts 会从 DateMention 节点读取时间，传递给 EventService.createEvent()
          // 3. EventService 创建成功后触发 eventsUpdated，TimeHub 自动更新缓存
          
          // 只有已存在的事件才需要调用 TimeHub.setEventTime()
          if (eventId) {
            const { EventService } = await import('../../services/EventService');
            const existing = EventService.getEventById(eventId);
            
            if (existing) {
              // 已存在的事件：通过 TimeHub 更新时间
              const { TimeHub } = await import('../../services/TimeHub');
              await TimeHub.setEventTime(eventId, {
                start: startStr,
                end: endStr,
                kind: endStr ? 'range' : 'fixed',
                source: 'picker',
                rawText: finalUserText, // 🔧 使用完整的用户输入文本
              });
              console.log('[@ Mention] 已存在事件，TimeHub 写入成功:', { eventId, startStr, endStr });
            } else {
              // 新事件：由 serialization.ts 从 DateMention 读取时间
              console.log('[@ Mention] 新事件，时间将由 DateMention 节点提供:', { eventId, startStr, endStr });
            }
          }
          
          // Step 2: 插入 DateMention UI 节点
          insertDateMention(editor, startStr, endStr, false, eventId, finalUserText); // 🔧 使用完整文本
          
          console.log('[@ Mention] 插入成功, displayHint:', finalUserText);
          
          // 🔥 立即保存，触发事件创建/更新
          flushPendingChanges();
        }
      }
      
      // 清除状态
      setShowMentionPicker(false);
    } catch (err) {
      console.error('[@ Mention] 插入失败:', err);
      setShowMentionPicker(false);
    }
  }, [editor, mentionText, flushPendingChanges]);
  
  // 🆕 @提及关闭
  const handleMentionClose = useCallback(() => {
    console.log('[@ Mention] 关闭');
    setShowMentionPicker(false);
    
    // 🆕 v2.10.1: 关闭 Picker 时，删除 @xxx 文本（用户取消输入）
    if (editor.selection && Range.isCollapsed(editor.selection)) {
      try {
        const { anchor } = editor.selection;
        const [node, path] = Editor.node(editor, anchor.path);
        
        if (SlateText.isText(node)) {
          const textBeforeCursor = node.text.slice(0, anchor.offset);
          const atMatch = textBeforeCursor.match(/@([^\s]*)$/);
          
          if (atMatch) {
            const atStartOffset = anchor.offset - atMatch[0].length;
            
            // 删除整个 @xxx 文本
            Transforms.delete(editor, {
              at: {
                anchor: { path, offset: atStartOffset },
                focus: { path, offset: anchor.offset },
              },
            });
            
            console.log('[@ Mention] 已删除未确认的 @xxx 文本');
          }
        }
      } catch (err) {
        console.error('[@ Mention] 清理文本失败:', err);
      }
    }
  }, [editor]);
  
  // 🔍 Unified Mention 搜索结果选择
  const handleSearchSelect = useCallback(async (item: any) => {
    if (!editor.selection) return;
    
    try {
      console.log('[Unified Mention] 选中项:', item);
      
      // 找到 @xxx 文本的位置并删除
      const { anchor } = editor.selection;
      const [node, path] = Editor.node(editor, anchor.path);
      
      if (SlateText.isText(node)) {
        const textBeforeCursor = node.text.slice(0, anchor.offset);
        const atMatch = textBeforeCursor.match(/@([^\s]*)$/);
        
        if (atMatch) {
          const atStartOffset = anchor.offset - atMatch[0].length;
          
          // 删除 @xxx 文本
          Transforms.delete(editor, {
            at: {
              anchor: { path, offset: atStartOffset },
              focus: { path, offset: anchor.offset },
            },
          });
          
          // 获取当前事件ID
          const match = Editor.above(editor, {
            match: n => (n as any).type === 'event-line',
          });
          
          let eventId: string | undefined;
          if (match) {
            const [eventLineNode] = match;
            eventId = (eventLineNode as EventLineNode).eventId;
          }
          
          // 根据不同类型插入不同的节点
          console.log('[Unified Mention] 处理类型:', item.type, '数据:', item);
          
          switch (item.type) {
            case 'event':
              // 插入事件提及元素
              console.log('[Unified Mention] 插入事件:', item.id, item.title);
              insertEventMention(editor, item.id, item.title);
              break;
              
            case 'tag':
              // 插入标签节点
              const tagName = item.id.startsWith('#') ? item.id.slice(1) : item.id;
              console.log('[Unified Mention] 插入标签:', tagName);
              const tagNode: TagNode = {
                type: 'tag',
                tag: tagName,
                children: [{ text: '' }],
              };
              Transforms.insertNodes(editor, tagNode as any);
              Transforms.insertText(editor, ' ');
              break;
              
            case 'time':
              // 插入时间提及
              if (item.metadata?.pointInTime?.date) {
                // 有精确时间点
                const startDate = item.metadata.pointInTime.date.format('YYYY-MM-DD HH:mm:ss');
                insertDateMention(editor, startDate, undefined, false, eventId, item.title);
              } else if (item.id) {
                // 时间预设（今天、明天等）
                const now = new Date();
                let targetDate: Date;
                
                switch (item.id) {
                  case 'today':
                    targetDate = now;
                    break;
                  case 'tomorrow':
                    targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                    break;
                  case 'nextWeek':
                    targetDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    break;
                  default:
                    targetDate = now;
                }
                
                const startDate = targetDate.toISOString().slice(0, 19).replace('T', ' ');
                insertDateMention(editor, startDate, undefined, false, eventId, item.title);
              }
              break;
              
            case 'ai':
              // TODO: 触发 AI 助手
              Transforms.insertText(editor, `🤖 ${item.title}`);
              console.log('[Unified Mention] AI 助手触发:', item.metadata?.prompt);
              break;
              
            case 'new':
              // 创建新页面
              Transforms.insertText(editor, item.title);
              console.log('[Unified Mention] 创建新页面:', item.title);
              break;
          }
          
          // 立即保存
          flushPendingChanges();
        }
      }
      
      // 关闭搜索菜单
      setShowSearchMenu(false);
    } catch (err) {
      console.error('[Unified Mention] 插入失败:', err);
      setShowSearchMenu(false);
    }
  }, [editor, flushPendingChanges]);
  
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
  
  // ==================== 段落移动功能 ====================
  
  /**
   * 移动标题行及其所有关联的 eventlog 段落
   * @param editor Slate 编辑器实例
   * @param titleLineIndex 标题行的索引
   * @param direction 移动方向 ('up' | 'down')
   */
  const moveTitleWithEventlogs = (editor: Editor, titleLineIndex: number, direction: 'up' | 'down') => {
    const nodes = Array.from(Editor.nodes(editor, { at: [] }));
    const eventLines = nodes
      .filter(([node]) => (node as any).type === 'event-line')
      .map(([node, path]) => ({ node: node as unknown as EventLineNode, path: path as number[] }));
    
    const titleLine = eventLines[titleLineIndex];
    if (!titleLine || titleLine.node.mode !== 'title') {
      console.warn('[moveTitleWithEventlogs] 当前不是标题行');
      return;
    }
    
    const titleEventId = titleLine.node.eventId;
    
    // 找到该标题的所有 eventlog 行（相同 eventId 且 mode='eventlog'）
    const relatedEventlogs: number[] = [];
    for (let i = titleLineIndex + 1; i < eventLines.length; i++) {
      const line = eventLines[i].node;
      if (line.eventId === titleEventId && line.mode === 'eventlog') {
        relatedEventlogs.push(i);
      } else {
        break; // 遇到其他事件，停止查找
      }
    }
    
    const eventGroupIndices = [titleLineIndex, ...relatedEventlogs];
    const eventGroupSize = eventGroupIndices.length;
    
    // 边界检查
    if (direction === 'up') {
      if (titleLineIndex === 0) {
        console.log('[moveTitleWithEventlogs] 已在第一行，无法上移');
        return;
      }
      
      // 找到上一个标题行的起始位置
      let targetIndex = titleLineIndex - 1;
      
      // 跳过上一个事件的 eventlog 行，找到它的标题行
      while (targetIndex > 0 && eventLines[targetIndex].node.mode === 'eventlog') {
        targetIndex--;
      }
      
      // 移动整个事件组到目标位置
      Editor.withoutNormalizing(editor, () => {
        // 1. 提取所有节点
        const nodesToMove = eventGroupIndices.map(idx => eventLines[idx].node);
        
        // 2. 删除原位置的节点（从后往前删除，避免索引变化）
        for (let i = eventGroupIndices.length - 1; i >= 0; i--) {
          Transforms.removeNodes(editor, { at: [eventGroupIndices[i]] });
        }
        
        // 3. 插入到目标位置
        nodesToMove.forEach((node, offset) => {
          Transforms.insertNodes(editor, node as unknown as Node, {
            at: [targetIndex + offset],
          });
        });
        
        // 4. 恢复光标到移动后的标题行
        setTimeout(() => {
          Transforms.select(editor, {
            anchor: { path: [targetIndex, 0, 0], offset: 0 },
            focus: { path: [targetIndex, 0, 0], offset: 0 },
          });
        }, 10);
      });
      
      console.log(`[moveTitleWithEventlogs] 上移事件组 (${eventGroupSize} 行): ${titleLineIndex} → ${targetIndex}`);
    } else {
      // 向下移动
      const lastEventlogIndex = relatedEventlogs.length > 0 ? relatedEventlogs[relatedEventlogs.length - 1] : titleLineIndex;
      
      // 检查是否是最后一个事件
      if (lastEventlogIndex >= eventLines.length - 1) {
        console.log('[moveTitleWithEventlogs] 已在最后，无法下移');
        return;
      }
      
      // 找到下一个事件的所有行（标题 + eventlog）
      let nextTitleIndex = lastEventlogIndex + 1;
      
      // 跳过 placeholder
      if (eventLines[nextTitleIndex].node.eventId === '__placeholder__') {
        console.log('[moveTitleWithEventlogs] 无法移动到 placeholder 后');
        return;
      }
      
      // 找到下一个事件的所有 eventlog 行
      const nextEventId = eventLines[nextTitleIndex].node.eventId;
      let nextEventEndIndex = nextTitleIndex;
      
      for (let i = nextTitleIndex + 1; i < eventLines.length; i++) {
        const line = eventLines[i].node;
        if (line.eventId === nextEventId && line.mode === 'eventlog') {
          nextEventEndIndex = i;
        } else {
          break;
        }
      }
      
      const nextEventSize = nextEventEndIndex - nextTitleIndex + 1;
      const targetIndex = titleLineIndex + nextEventSize;
      
      // 移动整个事件组到目标位置
      Editor.withoutNormalizing(editor, () => {
        // 1. 提取所有节点
        const nodesToMove = eventGroupIndices.map(idx => eventLines[idx].node);
        
        // 2. 删除原位置的节点（从后往前删除）
        for (let i = eventGroupIndices.length - 1; i >= 0; i--) {
          Transforms.removeNodes(editor, { at: [eventGroupIndices[i]] });
        }
        
        // 3. 插入到目标位置
        nodesToMove.forEach((node, offset) => {
          Transforms.insertNodes(editor, node as unknown as Node, {
            at: [targetIndex + offset],
          });
        });
        
        // 4. 恢复光标到移动后的标题行
        setTimeout(() => {
          Transforms.select(editor, {
            anchor: { path: [targetIndex, 0, 0], offset: 0 },
            focus: { path: [targetIndex, 0, 0], offset: 0 },
          });
        }, 10);
      });
      
      console.log(`[moveTitleWithEventlogs] 下移事件组 (${eventGroupSize} 行): ${titleLineIndex} → ${targetIndex}`);
    }
  };
  
  /**
   * 移动 eventlog 段落（不移动标题行）
   * @param editor Slate 编辑器实例
   * @param eventlogLineIndex eventlog 行的索引
   * @param direction 移动方向 ('up' | 'down')
   */
  const moveEventlogParagraph = (editor: Editor, eventlogLineIndex: number, direction: 'up' | 'down') => {
    const nodes = Array.from(Editor.nodes(editor, { at: [] }));
    const eventLines = nodes
      .filter(([node]) => (node as any).type === 'event-line')
      .map(([node, path]) => ({ node: node as unknown as EventLineNode, path: path as number[] }));
    
    const currentLine = eventLines[eventlogLineIndex];
    if (!currentLine || currentLine.node.mode !== 'eventlog') {
      console.warn('[moveEventlogParagraph] 当前不是 eventlog 行');
      return;
    }
    
    // 边界检查
    if (direction === 'up') {
      if (eventlogLineIndex === 0) {
        console.log('[moveEventlogParagraph] 已在第一行，无法上移');
        return;
      }
      
      const targetIndex = eventlogLineIndex - 1;
      const targetLine = eventLines[targetIndex].node;
      
      // 不能移动到标题行之前
      if (targetLine.mode === 'title') {
        console.log('[moveEventlogParagraph] 无法移动到标题行之前');
        return;
      }
      
      // 交换节点
      Editor.withoutNormalizing(editor, () => {
        const currentNode = currentLine.node;
        const targetNode = targetLine;
        
        // 1. 删除当前节点
        Transforms.removeNodes(editor, { at: [eventlogLineIndex] });
        
        // 2. 删除目标节点
        Transforms.removeNodes(editor, { at: [targetIndex] });
        
        // 3. 插入当前节点到目标位置
        Transforms.insertNodes(editor, currentNode as unknown as Node, { at: [targetIndex] });
        
        // 4. 插入目标节点到原位置
        Transforms.insertNodes(editor, targetNode as unknown as Node, { at: [eventlogLineIndex] });
        
        // 5. 恢复光标
        setTimeout(() => {
          Transforms.select(editor, {
            anchor: { path: [targetIndex, 0, 0], offset: 0 },
            focus: { path: [targetIndex, 0, 0], offset: 0 },
          });
        }, 10);
      });
      
      console.log(`[moveEventlogParagraph] 上移段落: ${eventlogLineIndex} ↔ ${targetIndex}`);
    } else {
      // 向下移动
      if (eventlogLineIndex >= eventLines.length - 1) {
        console.log('[moveEventlogParagraph] 已在最后一行，无法下移');
        return;
      }
      
      const targetIndex = eventlogLineIndex + 1;
      const targetLine = eventLines[targetIndex].node;
      
      // 跳过 placeholder
      if (targetLine.eventId === '__placeholder__') {
        console.log('[moveEventlogParagraph] 无法移动到 placeholder 后');
        return;
      }
      
      // 不能移动到其他事件的标题行
      if (targetLine.mode === 'title') {
        console.log('[moveEventlogParagraph] 无法移动到其他事件的标题行后');
        return;
      }
      
      // 交换节点
      Editor.withoutNormalizing(editor, () => {
        const currentNode = currentLine.node;
        const targetNode = targetLine;
        
        // 1. 删除目标节点
        Transforms.removeNodes(editor, { at: [targetIndex] });
        
        // 2. 删除当前节点
        Transforms.removeNodes(editor, { at: [eventlogLineIndex] });
        
        // 3. 插入目标节点到原位置
        Transforms.insertNodes(editor, targetNode as unknown as Node, { at: [eventlogLineIndex] });
        
        // 4. 插入当前节点到目标位置
        Transforms.insertNodes(editor, currentNode as unknown as Node, { at: [targetIndex] });
        
        // 5. 恢复光标
        setTimeout(() => {
          Transforms.select(editor, {
            anchor: { path: [targetIndex, 0, 0], offset: 0 },
            focus: { path: [targetIndex, 0, 0], offset: 0 },
          });
        }, 10);
      });
      
      console.log(`[moveEventlogParagraph] 下移段落: ${eventlogLineIndex} ↔ ${targetIndex}`);
    }
  };
  
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
    
    // 🎯 空格键触发 Bullet 自动检测
    if (event.key === ' ') {
      setTimeout(() => {
        const trigger = detectBulletTrigger(editor);
        if (trigger) {
          console.log('[PlanSlate] 🎯 检测到 Bullet 触发字符:', trigger);
          applyBulletAutoConvert(editor, trigger);
        }
      }, 0);
    }
    
    // 🆕 @提及激活时，拦截 Enter 和 Escape 键
    console.log('[@ Mention DEBUG] handleKeyDown:', { 
      key: event.key, 
      showMentionPicker,
      mentionInitialStart: mentionInitialStart ? formatTimeForStorage(mentionInitialStart) : undefined,
      mentionInitialEnd: mentionInitialEnd ? formatTimeForStorage(mentionInitialEnd) : undefined
    });
    
    if (showMentionPicker) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        console.log('[@ Mention] Enter 键被拦截，触发选择');
        // 直接调用 handleMentionSelect，使用当前解析的时间
        if (mentionInitialStart) {
          handleMentionSelect(
            formatTimeForStorage(mentionInitialStart),
            mentionInitialEnd ? formatTimeForStorage(mentionInitialEnd) : undefined
          );
        }
        return;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handleMentionClose();
        return;
      }
      // 其他键让用户继续输入，实时更新解析结果
    }
    
    // 🆕 让数字键 1-9 和 Escape 冒泡到外层（用于 FloatingBar 交互）
    // 不 preventDefault，让这些键传递到 document 层的监听器
    if (/^[1-9]$/.test(event.key) || event.key === 'Escape') {
      return; // 不处理，让事件冒泡
    }
    
    // 🆕 Shift+Alt+↑/↓ - 移动标题或 eventlog 段落
    if (event.shiftKey && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      
      const match = Editor.above(editor, {
        match: n => (n as any).type === 'event-line',
      });
      
      if (!match) return;
      const [currentNode, currentPath] = match;
      const eventLine = currentNode as unknown as EventLineNode;
      
      const direction = event.key === 'ArrowUp' ? 'up' : 'down';
      
      // 根据 mode 决定移动逻辑
      if (eventLine.mode === 'title') {
        // 标题行：移动整个事件（标题 + 所有 eventlog）
        moveTitleWithEventlogs(editor, currentPath[0], direction);
      } else {
        // Eventlog 行：只移动当前段落
        moveEventlogParagraph(editor, currentPath[0], direction);
      }
      
      return;
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
    
    // 🆕 Backspace 键 - 在空的 bullet 段落删除 bullet
    if (event.key === 'Backspace') {
      try {
        const [paragraphNode] = Editor.nodes(editor, {
          match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'paragraph',
        });
        
        if (paragraphNode) {
          const [node, path] = paragraphNode;
          const para = node as any;
          
          // 如果段落有 bullet 且内容为空（只有一个空文本节点）
          if (para.bullet && para.children.length === 1) {
            const textNode = para.children[0];
            if (textNode.text === '' || (selection?.anchor.offset === 0 && selection?.focus.offset === 0)) {
              event.preventDefault();
              // 移除 bullet 属性
              Transforms.setNodes(editor, { bullet: undefined, bulletLevel: undefined } as any, {
                at: path,
              });
              return;
            }
          }
        }
      } catch (e) {
        // 忽略错误，继续默认行为
      }
    }
    
    // Enter 键 - 创建新的 EventLine 或 Eventlog 行
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      
      // 🔥 立即保存当前内容
      flushPendingChanges();
      
      let insertIndex = currentPath[0] + 1;
      let newLine: EventLineNode;
      
      // 🆕 如果当前是 eventlog 行，继续创建 eventlog 行（同一个 eventId）
      if (eventLine.mode === 'eventlog') {
        // 🆕 检查当前段落是否有 bullet 属性
        let paragraphProps: any = {};
        try {
          const [paragraphNode] = Editor.nodes(editor, {
            match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'paragraph',
          });
          if (paragraphNode) {
            const para = paragraphNode[0] as any;
            if (para.bullet) {
              paragraphProps = { bullet: true, bulletLevel: para.bulletLevel || 0 };
            }
          }
        } catch (e) {
          // 忽略错误
        }
        
        newLine = {
          type: 'event-line',
          eventId: eventLine.eventId, // 🔧 共享同一个 eventId
          lineId: `${eventLine.lineId}-${Date.now()}`, // 生成唯一 lineId
          level: eventLine.level,
          mode: 'eventlog',
          children: [{ type: 'paragraph', ...paragraphProps, children: [{ text: '' }] }],
          metadata: eventLine.metadata, // 继承 metadata
        };
        
        logOperation('Enter (eventlog) - 创建新 eventlog 行', {
          currentLine: currentPath[0],
          eventId: eventLine.eventId,
          newLineId: newLine.lineId.slice(-10) + '...',
        }, 'background: #9C27B0; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;');
      } else {
        // Title 行：查找所有属于同一个 eventId 的 eventlog 行，在最后一个之后插入
        const baseEventId = eventLine.eventId;
        
        // 查找所有 eventlog 行（lineId 包含 '-desc' 的都是同一个 event 的 eventlog）
        let lastEventlogIndex = currentPath[0];
        try {
          for (let i = currentPath[0] + 1; i < value.length; i++) {
            const nextNode = value[i];
            if (nextNode.type === 'event-line') {
              // 检查是否属于同一个 event 的 eventlog 行
              // eventlog 行的 eventId 格式: "abc" 或 lineId 格式: "abc-desc", "abc-desc-1234"
              const isEventlogOfSameEvent = 
                nextNode.mode === 'eventlog' && 
                (nextNode.eventId === baseEventId || 
                 nextNode.lineId?.startsWith(`${baseEventId}-desc`));
              
              if (isEventlogOfSameEvent) {
                // 找到属于同一个 event 的 eventlog 行
                lastEventlogIndex = i;
              } else {
                // 遇到其他 event 的行，停止查找
                break;
              }
            }
          }
        } catch (e) {
          console.warn('[Enter] 查找 eventlog 行失败:', e);
        }
        
        // 新行插入在最后一个 eventlog 行之后
        insertIndex = lastEventlogIndex + 1;
        
        logOperation('Enter (title) - 创建新 event', {
          currentLine: currentPath[0],
          lastEventlogIndex,
          insertIndex,
          eventId: baseEventId,
        }, 'background: #2196F3; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;');
        
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
    
    // Shift+Enter - 切换 Eventlog 模式
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      
      if (eventLine.mode === 'title') {
        // 创建 Eventlog 行
        const descLine: EventLineNode = {
          type: 'event-line',
          eventId: eventLine.eventId,
          lineId: `${eventLine.lineId}-desc`,
          level: eventLine.level,
          mode: 'eventlog',
          children: [{ type: 'paragraph', children: [{ text: '' }] }],
        };
        
        Transforms.insertNodes(editor, descLine as unknown as Node, {
          at: [currentPath[0] + 1],
        });
        
        // 聚焦新创建的 Eventlog 行（使用安全方法）
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
      
      // 🔧 检查当前段落是否是 bullet
      const [paragraphNode] = Editor.nodes(editor, {
        match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'paragraph',
      });
      
      if (paragraphNode) {
        const [para] = paragraphNode;
        const paragraph = para as any;
        
        // 如果是 bullet 段落，增加 bulletLevel 并同步 EventLine level
        if (paragraph.bullet) {
          const currentBulletLevel = paragraph.bulletLevel || 0;
          const newBulletLevel = Math.min(currentBulletLevel + 1, 4); // 最多 5 层 (0-4)
          
          // 🔥 同时更新 paragraph 的 bulletLevel 和 EventLine 的 level
          Editor.withoutNormalizing(editor, () => {
            // 更新 paragraph
            Transforms.setNodes(editor, { bulletLevel: newBulletLevel } as any, {
              match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'paragraph',
            });
            
            // 更新 EventLine 的 level（用于缩进）
            const newEventLineLevel = eventLine.level + 1;
            Transforms.setNodes(
              editor,
              { level: newEventLineLevel } as unknown as Partial<Node>,
              { at: currentPath }
            );
          });
          
          return;
        }
      }
      
      // 否则增加 EventLine 的缩进
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
    
    // Shift+Tab - 减少缩进 / 退出 Eventlog 模式
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      
      // 🔧 检查当前段落是否是 bullet
      const [paragraphNode] = Editor.nodes(editor, {
        match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'paragraph',
      });
      
      if (paragraphNode) {
        const [para] = paragraphNode;
        const paragraph = para as any;
        
        // 如果是 bullet 段落，减少 bulletLevel 并同步 EventLine level
        if (paragraph.bullet) {
          const currentBulletLevel = paragraph.bulletLevel || 0;
          
          if (currentBulletLevel > 0) {
            // 🔥 同时更新 paragraph 和 EventLine
            Editor.withoutNormalizing(editor, () => {
              Transforms.setNodes(editor, { bulletLevel: currentBulletLevel - 1 } as any, {
                match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'paragraph',
              });
              
              const newEventLineLevel = Math.max(eventLine.level - 1, 0);
              Transforms.setNodes(
                editor,
                { level: newEventLineLevel } as unknown as Partial<Node>,
                { at: currentPath }
              );
            });
          } else {
            // Level 0 再按 Shift+Tab 就取消 bullet
            Transforms.setNodes(editor, { bullet: undefined, bulletLevel: undefined } as any, {
              match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === 'paragraph',
            });
          }
          
          return;
        }
      }
      
      // 🆕 如果是 eventlog 行，Shift+Tab 转换为 title 行
      if (eventLine.mode === 'eventlog') {
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
            
            // 🆕 v1.8.4: 删除后自动调整后续 bullet 层级
            adjustBulletLevelsAfterDelete(editor);
            
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
  }, [editor, value, handleMentionSelect, handleMentionClose]);
  
  // ==================== 复制粘贴增强 ====================
  
  const handleCopy = useCallback((event: React.ClipboardEvent) => {
    const { selection } = editor;
    if (!selection) return;
    
    event.preventDefault();
    
    // 获取选中的节点
    const fragment = Editor.fragment(editor, selection);
    
    // 🆕 使用 SlateCore 的 Bullet 剪贴板增强
    const bulletItems = extractBulletItems(editor, fragment);
    if (bulletItems.length > 0) {
      // 如果包含 Bullet 项，使用增强的剪贴板数据
      const clipboardData = generateClipboardData(bulletItems);
      event.clipboardData.setData('text/html', clipboardData.html);
      event.clipboardData.setData('text/plain', clipboardData.plain);
      console.log('📋 复制 Bullet 列表:', bulletItems.length, '个项目');
    } else {
      // 回退到原有逻辑（EventLine 富文本）
      const richHtml = slateNodesToRichHtml(fragment as unknown as EventLineNode[]);
      event.clipboardData.setData('text/html', richHtml);
      event.clipboardData.setData('text/plain', Editor.string(editor, selection));
    }
  }, [editor]);
  
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    event.preventDefault();
    
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    
    // 🆕 优先尝试解析 Bullet 格式
    let bulletItems = null;
    if (html) {
      bulletItems = parseHTMLBullets(html);
    }
    if (!bulletItems && text) {
      bulletItems = parsePlainTextBullets(text);
    }
    
    if (bulletItems && bulletItems.length > 0) {
      // 插入 Bullet 节点
      const bulletNodes = bulletItems.map(item => ({
        type: 'paragraph',
        bullet: true,
        bulletLevel: item.level,
        children: [{ text: item.text, ...item.marks }],
      }));
      
      const { selection } = editor;
      if (selection) {
        Transforms.insertNodes(editor, bulletNodes as any);
        console.log('📋 粘贴 Bullet 列表:', bulletItems.length, '个项目');
      }
    } else if (html) {
      // 回退到原有逻辑（EventLine HTML）
      const nodes = parseExternalHtml(html);
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
        const eventLineElement = element as EventLineNode;
        const eventStatus = getEventStatus && eventLineElement.eventId 
          ? getEventStatus(eventLineElement.eventId, eventLineElement.metadata) 
          : undefined;
        return (
          <EventLineElement
            {...props}
            element={eventLineElement}
            onSave={onSave}
            onTimeClick={onTimeClick}
            onMoreClick={onMoreClick}
            onPlaceholderClick={handlePlaceholderClick}
            eventStatus={eventStatus}
          />
        );
      case 'paragraph':
        const para = element as any;
        if (para.bullet) {
          const level = para.bulletLevel || 0;
          // Bullet paragraph rendering - 使用 CSS ::before 伪元素渲染符号
          return (
            <div className="slate-bullet-paragraph" data-level={level} {...props.attributes}>
              {props.children}
            </div>
          );
        }
        return <div {...props.attributes}>{props.children}</div>;
      case 'tag':
        return <TagElementComponent {...props} />;
      case 'dateMention':
        return <DateMentionElement {...props} />;
      case 'event-mention':
        return (
          <EventMentionElement 
            {...props} 
            element={element}
            onMentionClick={(eventId) => {
              console.log('[PlanSlate] 点击事件 Mention:', eventId);
              // TODO: 实现跳转逻辑（例如滚动到事件位置）
            }}
          />
        );
      case 'timestamp-divider':
        return <TimestampDividerElement {...props} />;
      default:
        return <div {...props.attributes}>{props.children}</div>;
    }
  }, [onSave, onTimeClick, onMoreClick, handlePlaceholderClick, getEventStatus]);
  
  const renderLeaf = useCallback((props: RenderLeafProps) => {
    let { children } = props;
    const leaf = props.leaf as TextNode;
    
    // 🆕 检查是否是 @ 提及文本（高亮显示）
    if (showMentionPicker && editor.selection) {
      try {
        const { anchor } = editor.selection;
        const [node] = Editor.node(editor, anchor.path);
        
        if (SlateText.isText(node) && node === leaf) {
          const textBeforeCursor = node.text.slice(0, anchor.offset);
          const atMatch = textBeforeCursor.match(/@([^\s]*)$/);
          
          if (atMatch) {
            // 高亮 @ 和后面的文本
            const atStart = anchor.offset - atMatch[0].length;
            const atEnd = anchor.offset;
            const leafText = (leaf as any).text || '';
            
            // 如果当前 leaf 包含 @ 提及部分
            if (atStart >= 0 && atEnd <= leafText.length) {
              const before = leafText.slice(0, atStart);
              const mention = leafText.slice(atStart, atEnd);
              const after = leafText.slice(atEnd);
              
              children = (
                <>
                  {before}
                  <span style={{ 
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    fontWeight: 500,
                    borderRadius: '2px',
                    padding: '0 2px',
                  }}>
                    {mention}
                  </span>
                  {after}
                </>
              );
            }
          }
        }
      } catch (err) {
        // 忽略错误，使用默认渲染
      }
    }
    
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
    
    // 🆕 文字颜色和背景色
    const hasColorStyle = leaf.color || leaf.backgroundColor;
    if (hasColorStyle) {
      const style: React.CSSProperties = {};
      if (leaf.color) style.color = leaf.color;
      if (leaf.backgroundColor) style.backgroundColor = leaf.backgroundColor;
      children = <span style={style}>{children}</span>;
    }
    
    return <span {...props.attributes}>{children}</span>;
  }, [showMentionPicker, editor]);
  
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
        
        {/* 🔧 始终渲染编辑器（至少有 placeholder） */}
        {value.length > 0 ? (
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
            
            {/* 🆕 @提及选择器 - 直接使用 UnifiedDateTimePicker（绝对定位） */}
            {showMentionPicker && mentionType === 'time' && mentionAnchorRef.current && (
              <div
                style={{
                  position: 'fixed',
                  top: `${mentionAnchorRef.current.style.top}`,
                  left: `${mentionAnchorRef.current.style.left}`,
                  zIndex: 10000,
                }}
              >
                <UnifiedDateTimePicker
                  useTimeHub={true} // 🔧 启用 TimeHub 模式，确保使用 onApplied 回调
                  initialStart={mentionInitialStart}
                  initialEnd={mentionInitialEnd}
                  initialText={mentionText} // 🔧 传递用户在 @ 后输入的初始文本
                  onSearchChange={handleMentionSearchChange} // 🆕 实时更新解析结果
                  onApplied={handleMentionSelect}
                  onClose={handleMentionClose}
                />
              </div>
            )}
            
            {/* 🔍 Unified Mention 搜索菜单（事件/标签/AI搜索） */}
            {showSearchMenu && mentionType === 'search' && mentionAnchorRef.current && (
              <div
                style={{
                  position: 'fixed',
                  top: `${mentionAnchorRef.current.style.top}`,
                  left: `${mentionAnchorRef.current.style.left}`,
                  zIndex: 10000,
                }}
              >
                <UnifiedMentionMenu
                  query={searchQuery}
                  onSelect={handleSearchSelect}
                  onClose={() => setShowSearchMenu(false)}
                  context="editor"
                />
              </div>
            )}
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
