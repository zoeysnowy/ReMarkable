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

// 导入序列化工具
import { jsonToSlateNodes, slateNodesToJson } from './serialization';

// 样式复用 UnifiedSlateEditor 的样式
import './LightSlateEditor.css';

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
  
  // 将 Slate JSON 字符串转换为 Slate nodes
  // 初始化时使用 content，但不在依赖数组中（避免每次都重新初始化）
  const [initialValue] = useState(() => {
    const nodes = jsonToSlateNodes(content);
    console.log('[LightSlateEditor] 初始化节点:', nodes);
    return nodes;
  });
  
  // 自动保存定时器
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>(content);
  
  // 监听外部 content 变化，同步到编辑器
  // 但要避免循环更新：只有当外部 content 与上次保存的不同时才更新
  useEffect(() => {
    if (content !== lastContentRef.current) {
      const nodes = jsonToSlateNodes(content);
      // 只有当节点真的不同时才更新（避免不必要的重渲染）
      const currentContent = slateNodesToJson(editor.children);
      if (content !== currentContent) {
        console.log('[LightSlateEditor] 外部 content 变化，同步到编辑器');
        editor.children = nodes;
        editor.onChange();
        lastContentRef.current = content;
      }
    }
  }, [content, editor]);
  
  // Timestamp 相关状态
  const timestampServiceRef = useRef<EventLogTimestampService | null>(null);
  const [pendingTimestamp, setPendingTimestamp] = useState<boolean>(false);
  
  // 初始化 timestamp 服务
  useEffect(() => {
    if (enableTimestamp && parentEventId) {
      timestampServiceRef.current = new EventLogTimestampService();
    }
  }, [enableTimestamp, parentEventId]);
  
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
        // 检查是否需要 preline
        const needsPreline = hasPrecedingTimestamp(element, editor.children);
        
        // 检查是否是最后一个非空段落（光标可能到过的最远位置）
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
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '-32px', // 固定高度，向上延伸到 timestamp 顶部
                  bottom: isLastContentParagraph ? '-20px' : '-4px',
                  width: '2px',
                  background: '#e5e7eb',
                  zIndex: 0
                }}
              />
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {props.children}
            </div>
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
      const shouldInsert = timestampServiceRef.current.shouldInsertTimestamp({
        contextId: parentEventId,  // 使用 parentEventId 作为 contextId
        eventId: parentEventId
      });
      
      if (shouldInsert) {
        console.log('[LightSlateEditor] 聚焦时插入 timestamp');
        
        // 检查当前第一个元素是否为空段落
        const firstElement = editor.children[0] as any;
        const hasPreElement = firstElement && 
          firstElement.type === 'paragraph' && 
          firstElement.children?.[0]?.text?.length > 0;
        
        // 创建 timestamp 节点
        const timestampNode = timestampServiceRef.current.createTimestampDivider(parentEventId);
        
        timestampServiceRef.current.insertTimestamp(editor, timestampNode, parentEventId);
        
        setPendingTimestamp(true); // 标记有等待用户输入的 timestamp
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
    
    // 如果有等待的 timestamp，用户开始输入了，清除标记
    if (pendingTimestamp) {
      setPendingTimestamp(false);
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
  }, [pendingTimestamp, onChange]);
  
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