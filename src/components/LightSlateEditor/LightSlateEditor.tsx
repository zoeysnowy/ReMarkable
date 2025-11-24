/**
 * LightSlateEditor - 轻量化的 Slate 编辑器
 * 
 * 设计目标：
 * - 为 EventEditModal 等单事件编辑场景优化
 * - 移除 PlanManager 特定功能（event-line、多事件管理）
 * - 保留核心编辑功能（FloatingToolbar、timestamp插入、inline elements）
 * - 简化数据流：content string ↔ Slate nodes
 * 
 * 架构差异：
 * UnifiedSlateEditor: Event[] → PlanItem[] → event-line nodes (多事件管理)
 * LightSlateEditor:  content string → paragraph nodes (单内容编辑)
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { 
  createEditor, 
  Descendant, 
  Editor, 
  Transforms, 
  Text,
  Node as SlateNode,
  Element as SlateElement
} from 'slate';
import { 
  Slate, 
  Editable, 
  withReact, 
  ReactEditor,
  RenderElementProps, 
  RenderLeafProps 
} from 'slate-react';
import { withHistory } from 'slate-history';

// 复用 UnifiedSlateEditor 的类型定义和组件
import type { 
  CustomElement, 
  CustomText,
  ParagraphNode,
  TimestampDividerElement as TimestampDividerType
} from '../UnifiedSlateEditor/types';

// 复用现有的元素组件
import { TagElementComponent } from '../UnifiedSlateEditor/elements/TagElement';
import DateMentionElement from '../UnifiedSlateEditor/elements/DateMentionElement';
import { TimestampDividerElement } from '../UnifiedSlateEditor/elements/TimestampDividerElement';

// 暂时移除 FloatingToolbar，避免复杂依赖
// import { FloatingToolbar } from '../UnifiedSlateEditor/FloatingToolbar/FloatingToolbar';

// 导入 timestamp 服务
import { EventLogTimestampService } from '../UnifiedSlateEditor/timestampService';

// 导入 EventHistoryService 获取创建时间
import { EventHistoryService } from '../../services/EventHistoryService';

// 导入序列化工具
import { jsonToSlateNodes, slateNodesToJson } from './serialization';

// 样式复用 UnifiedSlateEditor 的样式
import './LightSlateEditor.css';

/**
 * 格式化日期时间为 "YYYY-MM-DD HH:mm:ss" 格式
 */
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export interface LightSlateEditorProps {
  /** Slate JSON 内容 (来自 event.eventlog) */
  content: string;
  
  /** 父事件 ID (用于 timestamp 上下文) */
  parentEventId: string;
  
  /** 内容变化回调 - 返回 Slate JSON 字符串 */
  onChange: (slateJson: string) => void;
  
  /** 是否启用 timestamp 自动插入 */
  enableTimestamp?: boolean;
  
  /** 占位符文本 */
  placeholder?: string;
  
  /** CSS 类名 */
  className?: string;
  
  /** 是否只读 */
  readOnly?: boolean;
}

// 转换函数现在从 serialization.ts 导入

/**
 * 创建 timestamp divider 节点
 */
const createTimestampDivider = (timestamp: Date): TimestampDividerType => {
  return {
    type: 'timestamp-divider',
    timestamp: timestamp.toISOString(),
    displayText: timestamp.toLocaleString(),
    children: [{ text: '' }]
  };
};

export const LightSlateEditor: React.FC<LightSlateEditorProps> = ({
  content,
  parentEventId,
  onChange,
  enableTimestamp = false,
  placeholder = '开始编写...',
  className = '',
  readOnly = false
}) => {
  // 创建 Slate 编辑器实例
  const editor = useMemo(() => {
    const editorInstance = withHistory(withReact(createEditor()));
    console.log('[LightSlateEditor] 创建编辑器实例');
    return editorInstance;
  }, []);
  
  // 记录已添加 timestamp 的 content (必须在 initialValue 之前定义)
  const timestampAddedForContentRef = useRef<string | null>(null);
  
  // 将 Slate JSON 字符串转换为 Slate nodes
  const initialValue = useMemo(() => {
    let nodes = jsonToSlateNodes(content);
    console.log('[LightSlateEditor] 解析内容为节点:', { content, nodes });
    
    // 如果启用 timestamp 且这个 content 还没添加过 timestamp
    if (enableTimestamp && parentEventId && timestampAddedForContentRef.current !== content) {
      const hasActualContent = nodes.some((node: any) => {
        if (node.type === 'paragraph') {
          return node.children?.some((child: any) => child.text?.trim());
        }
        return node.type !== 'paragraph';
      });
      
      const hasTimestamp = nodes.some((node: any) => node.type === 'timestamp-divider');
      
      if (hasActualContent && !hasTimestamp) {
        // 从 EventHistoryService 获取创建时间
        const createLog = EventHistoryService.queryHistory({
          eventId: parentEventId,
          operations: ['create'],
          limit: 1
        })[0];
        
        if (createLog) {
          const createTime = new Date(createLog.timestamp);
          console.log('[LightSlateEditor] 在 initialValue 中添加 timestamp:', createTime);
          
          // 在开头插入 timestamp（不插入 preline，由 renderElement 动态绘制）
          nodes = [
            {
              type: 'timestamp-divider',
              timestamp: createTime.toISOString(),
              displayText: formatDateTime(createTime),
              isFirstOfDay: true,
              children: [{ text: '' }]
            },
            ...nodes
          ] as any;
          
          // 标记这个 content 已经添加过 timestamp
          timestampAddedForContentRef.current = content;
        }
      }
    }
    
    return nodes;
  }, [content, enableTimestamp, parentEventId]); // 依赖 content，内容变化时重新解析
  
  // 自动保存定时器
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>(content);
  
  // 监听外部 content 变化，同步到编辑器
  useEffect(() => {
    // 避免循环更新：只有当外部 content 与当前编辑器内容不同时才更新
    const currentContent = slateNodesToJson(editor.children);
    if (content && content !== currentContent && content !== lastContentRef.current) {
      console.log('[LightSlateEditor] 外部 content 变化，更新编辑器');
      console.log('旧内容:', currentContent);
      console.log('新内容:', content);
      
      const nodes = jsonToSlateNodes(content);
      
      // 使用 Transforms 来更新内容（推荐的方式）
      Transforms.delete(editor, {
        at: {
          anchor: Editor.start(editor, []),
          focus: Editor.end(editor, [])
        }
      });
      
      Transforms.insertNodes(editor, nodes, { at: [0] });
      lastContentRef.current = content;
    }
  }, [content, editor]);
  
  // Timestamp 相关状态
  const timestampServiceRef = useRef<EventLogTimestampService | null>(null);
  const [pendingTimestamp, setPendingTimestamp] = useState<boolean>(false);
  const contentLoadedRef = useRef<boolean>(false);
  
  // 初始化 timestamp 服务
  useEffect(() => {
    if (enableTimestamp && parentEventId) {
      timestampServiceRef.current = new EventLogTimestampService();
      console.log('[LightSlateEditor] 初始化 EventLogTimestampService');
      
      // 如果内容中已有 timestamp，提取最后一个并设置为 lastEditTime
      const timestamps = editor.children.filter((node: any) => node.type === 'timestamp-divider') as any[];
      if (timestamps.length > 0) {
        const lastTimestamp = timestamps[timestamps.length - 1];
        const lastTime = new Date(lastTimestamp.timestamp);
        timestampServiceRef.current.updateLastEditTime(parentEventId, lastTime);
        console.log('[LightSlateEditor] 从内容中恢复 lastEditTime:', lastTime);
      }
    }
  }, [enableTimestamp, parentEventId, editor]);
  
  // 从加载的内容中提取最后一个 timestamp，并初始化 timestampService
  // 如果有内容但没有 timestamp，插入初始 timestamp + preline
  useEffect(() => {
    if (enableTimestamp && parentEventId && timestampServiceRef.current && !contentLoadedRef.current) {
      // 检查是否有实际内容（不只是空段落）
      const hasActualContent = editor.children.some((node: any) => {
        if (node.type === 'paragraph') {
          return node.children?.some((child: any) => child.text?.trim());
        }
        return node.type !== 'paragraph';
      });
      
      // 扫描所有 timestamp 节点
      let lastTimestamp: Date | null = null;
      let hasTimestamp = false;
      
      for (const node of editor.children) {
        const element = node as any;
        if (element.type === 'timestamp-divider' && element.timestamp) {
          hasTimestamp = true;
          try {
            const timestampDate = new Date(element.timestamp);
            if (!lastTimestamp || timestampDate > lastTimestamp) {
              lastTimestamp = timestampDate;
            }
          } catch (error) {
            console.warn('[LightSlateEditor] 解析 timestamp 失败:', element.timestamp);
          }
        }
      }
      
      // 如果有内容但没有 timestamp，插入初始 timestamp（不插入 preline，由 renderElement 动态绘制）
      if (hasActualContent && !hasTimestamp) {
        console.log('[LightSlateEditor] 有内容但无 timestamp，插入初始 timestamp');
        
        // 从 EventHistoryService 获取创建时间
        const createLog = EventHistoryService.queryHistory({
          eventId: parentEventId,
          operations: ['create'],
          limit: 1
        })[0];
        
        if (createLog) {
          const createTime = new Date(createLog.timestamp);
          console.log('[LightSlateEditor] 找到创建时间:', createTime);
          
          // 创建 timestamp 节点（使用创建时间）
          const timestampNode = {
            type: 'timestamp-divider',
            timestamp: createTime.toISOString(),
            displayText: formatDateTime(createTime),
            isFirstOfDay: true,
            children: [{ text: '' }]
          };
          
          // 使用 Editor.withoutNormalizing 避免中间状态
          Editor.withoutNormalizing(editor, () => {
            // 在编辑器开头插入 timestamp（不插入 preline）
            Transforms.insertNodes(editor, timestampNode as any, { at: [0] });
          });
          
          // 更新 timestampService 的最后编辑时间
          timestampServiceRef.current.updateLastEditTime(parentEventId, createTime);
          
          console.log('[LightSlateEditor] 初始 timestamp 插入完成');
        } else {
          console.warn('[LightSlateEditor] 未找到创建日志，跳过初始 timestamp 插入');
        }
      }
      // 如果找到现有 timestamp，更新 timestampService 的最后编辑时间
      else if (lastTimestamp) {
        console.log('[LightSlateEditor] 从内容中提取到最后 timestamp:', lastTimestamp);
        timestampServiceRef.current.updateLastEditTime(parentEventId, lastTimestamp);
      }
      
      contentLoadedRef.current = true;
    }
  }, [editor, enableTimestamp, parentEventId]);
  
  /**
   * 检查当前元素前面是否有 timestamp，并计算到前一个 timestamp 的距离
   */
  const hasPrecedingTimestamp = useCallback((element: any, allNodes: any[]) => {
    try {
      const path = ReactEditor.findPath(editor, element);
      if (!path) return false;
      
      // 检查前面是否有 timestamp
      let hasTimestamp = false;
      for (let i = path[0] - 1; i >= 0; i--) {
        const checkElement = allNodes[i];
        if (checkElement && checkElement.type === 'timestamp-divider') {
          hasTimestamp = true;
          break;
        }
      }
      
      return hasTimestamp;
    } catch (error) {
      // 回退检查
      const currentIndex = allNodes.indexOf(element);
      if (currentIndex > 0) {
        for (let i = currentIndex - 1; i >= 0; i--) {
          const checkElement = allNodes[i];
          if (checkElement && checkElement.type === 'timestamp-divider') {
            return true;
          }
        }
      }
    }
    return false;
  }, [editor]);



  /**
   * 渲染元素组件
   */
  const renderElement = useCallback((props: RenderElementProps) => {
    const { element } = props;
    
    switch ((element as any).type) {
      case 'paragraph':
        // 检查是否应该绘制 preline
        const needsPreline = (() => {
          try {
            const path = ReactEditor.findPath(editor, element);
            if (!path) return false;
            
            // 向上查找最近的 timestamp
            let hasTimestamp = false;
            for (let i = path[0] - 1; i >= 0; i--) {
              const node = editor.children[i] as any;
              if (node.type === 'timestamp-divider') {
                hasTimestamp = true;
                break;
              }
            }
            
            if (!hasTimestamp) return false;
            
            // 如果有内容，显示 preline
            const hasContent = (element as any).children?.some((child: any) => child.text?.trim());
            if (hasContent) return true;
            
            // 空段落：检查是否是当前 timestamp 组中的段落
            // 向上查找，如果遇到 timestamp 之前都是 paragraph，说明属于这个 timestamp 组
            for (let i = path[0] - 1; i >= 0; i--) {
              const node = editor.children[i] as any;
              if (node.type === 'timestamp-divider') {
                return true; // 找到了 timestamp，这是它下面的段落
              }
              if (node.type !== 'paragraph') {
                break; // 遇到其他类型节点，停止
              }
            }
            
            return false;
          } catch {
            return false;
          }
        })();
        
        // 检查是否是最后一个非空段落（光标可能到达过的最远位置）
        const isLastContentParagraph = (() => {
          try {
            const path = ReactEditor.findPath(editor, element);
            if (!path) return false;
            
            // 检查当前位置之后是否还有非空内容
            for (let i = path[0] + 1; i < editor.children.length; i++) {
              const nextNode = editor.children[i] as any;
              if (nextNode.type === 'paragraph' && nextNode.children?.[0]?.text?.trim()) {
                return false; // 后面还有内容
              }
            }
            return true; // 这是最后一个有内容的段落
          } catch {
            return false;
          }
        })();
        
        return (
          <div
            {...props.attributes}
            className={`slate-paragraph ${needsPreline ? 'with-preline' : ''}`}
            style={{
              position: 'relative',
              paddingLeft: needsPreline ? '20px' : '0',
              minHeight: needsPreline ? '20px' : 'auto'
            }}
          >
            {needsPreline && (
              <div
                className="paragraph-preline"
                contentEditable={false}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '-28px', // 向上延伸到 timestamp 文字顶部（padding-top 8px + 文字行高约 20px）
                  bottom: isLastContentParagraph ? '-8px' : '0', // 最后段落向下延伸一点，其他段落到底部
                  width: '2px',
                  background: '#e5e7eb',
                  zIndex: 0,
                  pointerEvents: 'none' // 防止 preline 拦截点击事件
                }}
              />
            )}
            {props.children}
          </div>
        );
        
      case 'tag':
        return <TagElementComponent {...props} />;
        
      case 'date-mention':
        return <DateMentionElement {...props} />;
        
      case 'timestamp-divider':
        return <TimestampDividerElement {...props} />;
        
      default:
        return (
          <div {...props.attributes}>
            {props.children}
          </div>
        );
    }
  }, [hasPrecedingTimestamp, editor]);
  
  /**
   * 渲染叶子节点（文本格式）
   */
  const renderLeaf = useCallback((props: RenderLeafProps) => {
    let { children } = props;
    const { leaf } = props as { leaf: CustomText };
    
    if (leaf.bold) children = <strong>{children}</strong>;
    if (leaf.italic) children = <em>{children}</em>;
    if (leaf.underline) children = <u>{children}</u>;
    if (leaf.strikethrough) children = <s>{children}</s>;
    if ((leaf as any).code) children = <code>{children}</code>;
    
    // 文本颜色和背景颜色
    if (leaf.color || leaf.backgroundColor) {
      const style: React.CSSProperties = {};
      if (leaf.color) style.color = leaf.color;
      if (leaf.backgroundColor) style.backgroundColor = leaf.backgroundColor;
      children = <span style={style}>{children}</span>;
    }
    
    return <span {...props.attributes}>{children}</span>;
  }, []);
  
  /**
   * 处理编辑器聚焦 - 检查并插入 timestamp
   */
  const handleFocus = useCallback(() => {
    if (enableTimestamp && timestampServiceRef.current && parentEventId) {
      // 检查是否需要插入新的 timestamp（基于 5 分钟间隔）
      const shouldInsert = timestampServiceRef.current.shouldInsertTimestamp({
        contextId: parentEventId,
        eventId: parentEventId
      });
      
      if (shouldInsert) {
        // 检查是否已经有内容（只有有内容时才插入新 timestamp 进行分隔）
        const hasContent = editor.children.some((node: any) => {
          return node.type === 'paragraph' && node.children?.[0]?.text?.trim();
        });
        
        if (hasContent) {
          console.log('[LightSlateEditor] 聚焦时插入 timestamp（距上次编辑超过 5 分钟）');
          
          // 创建 timestamp 节点
          const timestampNode = timestampServiceRef.current.createTimestampDivider(parentEventId);
          
          timestampServiceRef.current.insertTimestamp(editor, timestampNode, parentEventId);
          
          setPendingTimestamp(true); // 标记有等待用户输入的 timestamp
        } else {
          console.log('[LightSlateEditor] 聚焦但无内容，不插入 timestamp');
        }
      } else {
        console.log('[LightSlateEditor] 聚焦但距上次编辑未超过 5 分钟，不插入 timestamp');
      }
    }
  }, [enableTimestamp, editor, parentEventId]);

  /**
   * 处理编辑器失焦 - 清理空的 timestamp
   */
  const handleBlur = useCallback(() => {
    if (pendingTimestamp && timestampServiceRef.current) {
      console.log('[LightSlateEditor] 失焦时检查是否需要清理空 timestamp');
      
      // 检查是否真的没有内容
      const hasAnyContent = editor.children.some((node: any) => {
        return node.type === 'paragraph' && 
               node.children?.[0]?.text?.trim();
      });
      
      // 只有当确实没有任何内容时才清理 timestamp
      if (!hasAnyContent) {
        timestampServiceRef.current.removeEmptyTimestamp(editor);
      }
      
      setPendingTimestamp(false);
    }
  }, [pendingTimestamp, editor]);

  /**
   * 处理编辑器内容变化
   */
  const handleChange = useCallback((newValue: Descendant[]) => {
    console.log('[LightSlateEditor] 内容变化:', newValue);
    
    // 如果有等待的 timestamp，用户开始输入了，清除标记并更新最后编辑时间
    if (pendingTimestamp) {
      setPendingTimestamp(false);
      
      // 用户开始输入，确认这个 timestamp，更新最后编辑时间
      if (enableTimestamp && timestampServiceRef.current && parentEventId) {
        timestampServiceRef.current.updateLastEditTime(parentEventId);
        console.log('[LightSlateEditor] 用户输入确认 timestamp，更新最后编辑时间');
      }
    }
    
    // 防抖保存
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(() => {
      const newContent = slateNodesToJson(newValue);
      if (newContent !== lastContentRef.current) {
        lastContentRef.current = newContent;
        onChange(newContent);
        console.log('[LightSlateEditor] 自动保存 Slate JSON:', newContent.slice(0, 100) + '...');
      }
    }, 2000);
  }, [pendingTimestamp, onChange, enableTimestamp, parentEventId]);
  
  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // 这里可以添加自定义的键盘快捷键
    // 比如 Ctrl+B 加粗、Ctrl+I 斜体等
    
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'b':
          event.preventDefault();
          // TODO: 实现加粗功能
          break;
        case 'i':
          event.preventDefault();
          // TODO: 实现斜体功能
          break;
      }
    }
  }, []);
  
  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      className={`light-slate-editor ${className}`} 
      style={{ 
        position: 'relative',
        background: 'transparent',
        border: 'none'
      }}
    >
      
      <Slate
        editor={editor}
        initialValue={initialValue}
        onValueChange={handleChange}
      >
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          readOnly={readOnly}
          className="slate-editable"
          style={{ 
            position: 'relative', 
            zIndex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none'
          }}
        />
        
        {/* FloatingToolbar 暂时移除，避免复杂依赖 */}
        {/* {!readOnly && (
          <FloatingToolbar 
            editor={editor}
            showAddTask={false}
            showTimePicker={true}
            showMoreActions={false}
          />
        )} */}
      </Slate>
    </div>
  );
};