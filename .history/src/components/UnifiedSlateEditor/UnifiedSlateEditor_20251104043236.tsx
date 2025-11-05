/**
 * UnifiedSlateEditor - 统一的单实例 Slate 编辑器
 * 
 * 核心特性：
 * 1. 单个 Slate 实例，支持跨行文字选择
 * 2. 智能键盘事件处理（Enter、Tab、Shift+Enter 等）
 * 3. 富文本复制粘贴，保留缩进和格式
 * 4. 与 PlanManager 完全兼容
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { createEditor, Descendant, Editor, Transforms, Range, Point, Node, Element as SlateElement } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import { EventLineNode, ParagraphNode, TagNode, DateMentionNode, TextNode, CustomEditor } from './types';
import { EventLineElement } from './EventLineElement';
import { TagElementComponent } from '../SlateEditor/elements/TagElement';
import { DateMentionElementComponent } from '../SlateEditor/elements/DateMentionElement';
import {
  planItemsToSlateNodes,
  slateNodesToPlanItems,
  createEmptyEventLine,
  slateNodesToRichHtml,
  parseExternalHtml,
} from './serialization';
import './UnifiedSlateEditor.css';

export interface UnifiedSlateEditorProps {
  items: any[];  // PlanItem[]
  onChange: (items: any[]) => void;
  onFocus?: (lineId: string) => void;
  onEditorReady?: (editor: Editor) => void;
  renderLinePrefix?: (element: EventLineNode) => React.ReactNode;
  renderLineSuffix?: (element: EventLineNode) => React.ReactNode;
  placeholder?: string;
  className?: string;
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
  renderLinePrefix,
  renderLineSuffix,
  placeholder = '开始输入...',
  className = '',
}) => {
  // 创建编辑器实例
  const editor = useMemo(() => withCustom(withHistory(withReact(createEditor() as CustomEditor))), []);
  
  // 初始化内容
  const [value, setValue] = useState<EventLineNode[]>(() => planItemsToSlateNodes(items));
  
  // 同步外部 items 变化
  useEffect(() => {
    const newNodes = planItemsToSlateNodes(items);
    setValue(newNodes);
  }, [items]);
  
  // 通知编辑器就绪
  useEffect(() => {
    if (onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);
  
  // ==================== 内容变化处理 ====================
  
  const handleChange = useCallback((newValue: Descendant[]) => {
    setValue(newValue as unknown as EventLineNode[]);
    
    // 转换为 PlanItem 并通知外部
    const planItems = slateNodesToPlanItems(newValue as unknown as EventLineNode[]);
    onChange(planItems);
  }, [onChange]);
  
  // ==================== 键盘事件处理 ====================
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { selection } = editor;
    if (!selection) return;
    
    // IME 组字中，不处理快捷键
    if (event.nativeEvent?.isComposing) return;
    
    // Enter 键 - 创建新的 EventLine
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      
      const [currentNode] = Editor.node(editor, selection);
      const eventLine = currentNode as unknown as EventLineNode;
      
      if (eventLine.type === 'event-line') {
        // 创建新行
        const newLine = createEmptyEventLine(eventLine.level);
        
        Transforms.insertNodes(editor, newLine as unknown as Node, {
          at: [Editor.above(editor)![1][0] + 1],
        });
        
        // 聚焦新行
        setTimeout(() => {
          const newPath = [Editor.above(editor)![1][0] + 1, 0, 0];
          Transforms.select(editor, {
            anchor: { path: newPath, offset: 0 },
            focus: { path: newPath, offset: 0 },
          });
        }, 10);
      }
      return;
    }
    
    // Shift+Enter - 切换 Description 模式
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      
      const [currentNode, path] = Editor.node(editor, selection);
      const eventLine = currentNode as unknown as EventLineNode;
      
      if (eventLine.type === 'event-line') {
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
            at: [path[0] + 1],
          });
        } else {
          // Description -> Title: 转换当前行
          Transforms.setNodes(
            editor,
            { mode: 'title' } as unknown as Partial<Node>,
            { at: path }
          );
        }
      }
      return;
    }
    
    // Tab 键 - 增加缩进
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      
      const [currentNode, path] = Editor.node(editor, selection);
      const eventLine = currentNode as unknown as EventLineNode;
      
      if (eventLine.type === 'event-line') {
        // 计算最大允许缩进（上一行 level + 1）
        const prevPath = [path[0] - 1];
        let maxLevel = 0;
        
        if (path[0] > 0) {
          try {
            const [prevNode] = Editor.node(editor, prevPath);
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
          { at: path }
        );
      }
      return;
    }
    
    // Shift+Tab - 减少缩进
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      
      const [currentNode, path] = Editor.node(editor, selection);
      const eventLine = currentNode as unknown as EventLineNode;
      
      if (eventLine.type === 'event-line') {
        const newLevel = Math.max(eventLine.level - 1, 0);
        
        Transforms.setNodes(
          editor,
          { level: newLevel } as unknown as Partial<Node>,
          { at: path }
        );
      }
      return;
    }
    
    // Delete/Backspace - 在行首时删除当前行
    if ((event.key === 'Backspace' || event.key === 'Delete') && Range.isCollapsed(selection)) {
      const [currentNode, path] = Editor.node(editor, selection);
      const eventLine = currentNode as unknown as EventLineNode;
      
      if (eventLine.type === 'event-line') {
        const paragraph = eventLine.children[0];
        const text = Node.string(paragraph as unknown as Node);
        
        // 如果内容为空且在行首，删除当前行
        if (!text && Point.equals(selection.anchor, Editor.start(editor, path))) {
          event.preventDefault();
          
          // 确保至少保留一行
          if (value.length > 1) {
            Transforms.removeNodes(editor, { at: path });
          }
          return;
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
  }, [renderLinePrefix, renderLineSuffix]);
  
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
  
  return (
    <div className={`unified-slate-editor ${className}`}>
      <Slate editor={editor} initialValue={value as unknown as Descendant[]} onChange={handleChange}>
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          onKeyDown={handleKeyDown}
          onCopy={handleCopy}
          onPaste={handlePaste}
          placeholder={placeholder}
          spellCheck={false}
          className="unified-editable"
        />
      </Slate>
    </div>
  );
};
