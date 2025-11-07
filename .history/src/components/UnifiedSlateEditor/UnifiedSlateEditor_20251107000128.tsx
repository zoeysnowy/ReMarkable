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
  
  // 🆕 检测是否应该显示 gray-text placeholder
  const shouldShowGrayText = useMemo(() => {
    // console.log('[shouldShowGrayText] value.length:', value.length, 'items.length:', items.length);
    if (value.length === 0) return true;
    if (value.length === 1) {
      const firstLine = value[0];
      const text = firstLine.children[0]?.children?.[0];
      const isEmpty = !text || (typeof text === 'object' && 'text' in text && !text.text);
      // console.log('[shouldShowGrayText] first line text:', text, 'isEmpty:', isEmpty);
      return isEmpty;
    }
    return false;
  }, [value, items]);
  
  // 同步外部 items 变化（只在结构变化时同步，避免循环更新）
  useEffect(() => {
    // 比较 items 的 ID 列表，只有结构变化时才同步
    const currentIds = value.map(node => node.lineId.replace('-desc', '')).filter((id, index, arr) => arr.indexOf(id) === index);
    const newIds = items.map(item => item.id);
    
    // 检查 ID 列表是否变化
    const idsChanged = currentIds.length !== newIds.length || 
                       currentIds.some((id, index) => id !== newIds[index]);
    
    if (idsChanged) {
      console.log('[UnifiedSlateEditor] Items structure changed, syncing...', { currentIds, newIds });
      const newNodes = planItemsToSlateNodes(items);
      setValue(newNodes);
    }
  }, [items, value]);
  
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
  
  const handleClick = useCallback(() => {
    // 当用户点击编辑器时，通知焦点变化
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
  }, [onFocus, editor]);
  
  // ==================== 键盘事件处理 ====================
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { selection } = editor;
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
    
    // Enter 键 - 创建新的 EventLine
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      
      // 🆕 检查当前 event 是否有 description 行
      let insertIndex = currentPath[0] + 1;
      
      if (eventLine.mode === 'title') {
        // 从当前行开始查找是否有对应的 description 行
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
      }
      
      // 创建新行（继承当前层级）
      const newLine = createEmptyEventLine(eventLine.level);
      
      Transforms.insertNodes(editor, newLine as unknown as Node, {
        at: [insertIndex],
      });
      
      // 聚焦新行
      ReactEditor.focus(editor);
      Transforms.select(editor, {
        anchor: { path: [insertIndex, 0, 0], offset: 0 },
        focus: { path: [insertIndex, 0, 0], offset: 0 },
      });
      
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
        
        // 聚焦新创建的 Description 行
        ReactEditor.focus(editor);
        Transforms.select(editor, {
          anchor: { path: [currentPath[0] + 1, 0, 0], offset: 0 },
          focus: { path: [currentPath[0] + 1, 0, 0], offset: 0 },
        });
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
    
    // Shift+Tab - 减少缩进
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      
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
      const paragraph = eventLine.children[0];
      const text = Node.string(paragraph as unknown as Node);
      
      // 如果内容为空且在行首，删除当前行
      if (!text && Point.equals(selection.anchor, Editor.start(editor, currentPath))) {
        event.preventDefault();
        
        // 确保至少保留一行
        if (value.length > 1) {
          Transforms.removeNodes(editor, { at: currentPath });
        }
        return;
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
  
  // 🆕 Gray text placeholder 点击处理
  const handleGrayTextClick = useCallback(() => {
    // 创建一个新的空行并聚焦
    const newLine = createEmptyEventLine(0);
    setValue([newLine]);
    
    // 聚焦编辑器
    setTimeout(() => {
      ReactEditor.focus(editor);
      Transforms.select(editor, {
        anchor: { path: [0, 0, 0], offset: 0 },
        focus: { path: [0, 0, 0], offset: 0 },
      });
    }, 10);
  }, [editor]);
  
  return (
    <div className={`unified-slate-editor ${className}`}>
      <Slate editor={editor} initialValue={value as unknown as Descendant[]} onChange={handleChange}>
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onCopy={handleCopy}
          onPaste={handlePaste}
          placeholder={placeholder}
          spellCheck={false}
          className="unified-editable"
        />
      </Slate>
      
      {/* 🆕 Gray Text Placeholder */}
      {shouldShowGrayText && (
        <div
          className="gray-text-placeholder"
          onClick={handleGrayTextClick}
          style={{
            padding: '8px 16px',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '14px',
            userSelect: 'none',
          }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
};
