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
import { htmlToSlateNodes, slateNodesToHtml } from './serialization';

// 样式复用 UnifiedSlateEditor 的样式
import './LightSlateEditor.css';

export interface LightSlateEditorProps {
  /** HTML 内容 (来自 event.description) */
  content: string;
  
  /** 父事件 ID (用于 timestamp 上下文) */
  parentEventId: string;
  
  /** 内容变化回调 */
  onChange: (html: string) => void;
  
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
  const editor = useMemo(
    () => withHistory(withReact(createEditor())),
    []
  );
  
  // 将 HTML 内容转换为 Slate nodes
  const initialValue = useMemo(() => {
    return htmlToSlateNodes(content);
  }, [content]);
  
  // Slate 编辑器的当前值
  const [value, setValue] = useState<Descendant[]>(initialValue);
  
  // 自动保存定时器
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>(content);
  
  // Timestamp 相关状态
  const timestampServiceRef = useRef<EventLogTimestampService | null>(null);
  
  // 初始化 timestamp 服务
  useEffect(() => {
    if (enableTimestamp && parentEventId) {
      timestampServiceRef.current = new EventLogTimestampService();
    }
  }, [enableTimestamp, parentEventId]);
  
  /**
   * 渲染元素组件
   */
  const renderElement = useCallback((props: RenderElementProps) => {
    const { element } = props;
    
    switch ((element as any).type) {
      case 'paragraph':
        return (
          <div 
            {...props.attributes}
            className="slate-paragraph"
          >
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
  }, []);
  
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
   * 处理编辑器内容变化
   */
  const handleChange = useCallback((newValue: Descendant[]) => {
    setValue(newValue);
    
    // 检查是否需要插入 timestamp
    if (enableTimestamp && timestampServiceRef.current) {
      const shouldInsert = timestampServiceRef.current.shouldInsertTimestamp(
        editor,
        newValue,
        parentEventId
      );
      
      if (shouldInsert) {
        console.log('[LightSlateEditor] 检测到需要插入 timestamp');
        const timestampElement = timestampServiceRef.current.createTimestampDivider(parentEventId);
        
        // 在当前光标位置插入 timestamp
        timestampServiceRef.current.insertTimestamp(editor, timestampElement, parentEventId);
        return; // 插入操作会触发新的 onChange
      }
    }
    
    // 防抖保存
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(() => {
      const newContent = slateNodesToHtml(newValue);
      if (newContent !== lastContentRef.current) {
        lastContentRef.current = newContent;
        onChange(newContent);
        console.log('[LightSlateEditor] 自动保存内容:', newContent.slice(0, 50) + '...');
      }
    }, 2000);
  }, [enableTimestamp, onChange, editor]);
  
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
    <div className={`light-slate-editor ${className}`}>
      <Slate
        editor={editor}
        initialValue={value}
        onValueChange={handleChange}
      >
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly={readOnly}
          className="slate-editable"
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