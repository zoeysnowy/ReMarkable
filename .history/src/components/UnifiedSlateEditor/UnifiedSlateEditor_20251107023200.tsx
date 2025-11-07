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
import {
  planItemsToSlateNodes,
  slateNodesToPlanItems,
  createEmptyEventLine,
  slateNodesToRichHtml,
  parseExternalHtml,
} from './serialization';
import './UnifiedSlateEditor.css';

// 🔍 初始化调试标志 - 在模块加载时立即从 localStorage 读取
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('SLATE_DEBUG');
    if (saved === 'true') {
      (window as any).SLATE_DEBUG = true;
      console.log('%c[🚀] SLATE_DEBUG 已从 localStorage 恢复', 'background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px;');
    }
  } catch (e) {
    // ignore
  }
}

// 🔍 调试开关 - 通过 window.SLATE_DEBUG = true 开启
const isDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  return (window as any).SLATE_DEBUG === true;
};

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
  
  // 初始化内容
  const [value, setValue] = useState<EventLineNode[]>(() => planItemsToSlateNodes(items));
  
  // 🆕 生成编辑器 key，用于强制重新渲染
  const [editorKey, setEditorKey] = useState(0);
  
  // 🆕 检测是否应该显示 gray-text placeholder
  const shouldShowGrayText = useMemo(() => {
    // 情况1: 没有任何节点
    if (!value || value.length === 0) return true;
    
    // 情况2: 只有一个节点，检查是否为空
    if (value.length === 1) {
      const firstLine = value[0];
      if (!firstLine.children || firstLine.children.length === 0) return true;
      
      const paragraph = firstLine.children[0];
      if (!paragraph.children || paragraph.children.length === 0) return true;
      
      const firstChild = paragraph.children[0];
      // 检查是否只有一个空文本节点
      if (paragraph.children.length === 1 && 
          typeof firstChild === 'object' && 
          'text' in firstChild && 
          (!firstChild.text || firstChild.text === '')) {
        return true;
      }
      
      return false;
    }
    
    // 情况3: 有多个节点，不显示 placeholder
    return false;
  }, [value]);
  
  // 🆕 用 ref 存储上次的 items，避免无限循环
  const prevItemsRef = React.useRef<any[]>(items);
  
  // 同步外部 items 变化（只在结构变化时同步，避免循环更新）
  useEffect(() => {
    // 🔧 特殊情况：如果 items 为空且 value 已经是单个空节点，不同步
    if (items.length === 0 && value.length === 1) {
      const firstNode = value[0];
      if (!firstNode.children || firstNode.children.length === 0) {
        prevItemsRef.current = items;
        return;
      }
      
      const paragraph = firstNode.children[0];
      if (!paragraph.children || paragraph.children.length === 0) {
        prevItemsRef.current = items;
        return;
      }
      
      const firstChild = paragraph.children[0];
      const isEmpty = paragraph.children.length === 1 && 
                     typeof firstChild === 'object' && 
                     'text' in firstChild && 
                     (!firstChild.text || firstChild.text === '');
      
      if (isEmpty) {
        prevItemsRef.current = items;
        return;
      }
    }
    
    // 比较 items 的 ID 列表，只有结构变化时才同步
    const currentIds = value.map(node => node.lineId.replace('-desc', '')).filter((id, index, arr) => arr.indexOf(id) === index);
    const newIds = items.map(item => item.id);
    
    // 检查 ID 列表是否变化
    const idsChanged = currentIds.length !== newIds.length || 
                       currentIds.some((id, index) => id !== newIds[index]);
    
    // 🔧 检查 items 是否真的变化（深度对比 ID 列表）
    const prevIds = prevItemsRef.current.map(item => item.id);
    const itemsReallyChanged = prevIds.length !== newIds.length || 
                               prevIds.some((id, index) => id !== newIds[index]);
    
    // 🔧 判断是新增还是删除
    const isAddition = newIds.length > currentIds.length;
    const isDeletion = newIds.length < currentIds.length;
    
    if (idsChanged && itemsReallyChanged) {
      if (isDebugEnabled()) {
        window.console.log('[UnifiedSlateEditor] Items structure changed, syncing...', { 
          currentIds, 
          newIds, 
          prevIds,
          isAddition,
          isDeletion,
        });
      }
      
      // 🔧 只在新增时重新创建编辑器，删除时让 Slate 自己处理
      if (!isDeletion) {
        const newNodes = planItemsToSlateNodes(items);
        setValue(newNodes);
        
        // 🆕 强制重新渲染编辑器（通过改变 key）- 只在新增时
        setEditorKey(prev => prev + 1);
      }
      
      // 更新 ref
      prevItemsRef.current = items;
    }
  }, [items]); // ⚠️ 移除 value 依赖，避免循环
  
  // 通知编辑器就绪
  useEffect(() => {
    if (onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);
  
  // ==================== 内容变化处理 ====================
  
  const handleChange = useCallback((newValue: Descendant[]) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    
    if (isDebugEnabled()) {
      // 📊 详细记录每个节点的完整状态
      window.console.group(`%c[🔄 ${timestamp}] handleChange - 编辑器内容变化`, 'color: #2196F3; font-weight: bold;');
      window.console.log('节点总数:', newValue.length);
      
      newValue.forEach((node: any, index) => {
        const paragraph = node.children?.[0];
        const textNode = paragraph?.children?.[0];
        const text = textNode?.text || '';
        
        window.console.log(`  [${index}] lineId: ${node.lineId.slice(-10)}`, {
          mode: node.mode,
          level: node.level,
          text: `"${text}"`,
          textLength: text.length,
          nodeStructure: {
            type: node.type,
            childrenCount: node.children?.length,
            paragraphChildrenCount: paragraph?.children?.length,
          }
        });
      });
      
      // 光标位置
      if (editor.selection) {
        window.console.log('光标位置:', {
          anchor: editor.selection.anchor,
          focus: editor.selection.focus,
          isCollapsed: Range.isCollapsed(editor.selection),
        });
      } else {
        window.console.log('光标位置: null (无焦点)');
      }
      
      window.console.groupEnd();
    }
    
    setValue(newValue as unknown as EventLineNode[]);
    
    // 转换为 PlanItem 并通知外部
    const planItems = slateNodesToPlanItems(newValue as unknown as EventLineNode[]);
    
    if (isDebugEnabled()) {
      window.console.log(`[📤 ${timestamp}] 转换后的 PlanItems`, {
        itemCount: planItems.length,
        items: planItems.map(item => ({
          id: item.id.slice(-10),
          title: `"${item.title}"`,
          titleLength: item.title?.length || 0,
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
      
      // 当用户点击编辑器时，通知焦点变化
      if (onFocus && editor.selection) {
        const match = Editor.above(editor, {
          match: n => (n as any).type === 'event-line',
        });
        
        if (match) {
          const [node] = match;
          const eventLine = node as unknown as EventLineNode;
          onFocus(eventLine.lineId);
        }
      }
    } catch (err) {
      // 忽略选区错误
      if (isDebugEnabled()) {
        window.console.warn('[handleClick] Error:', err);
      }
      event.preventDefault();
    }
  }, [onFocus, editor]);
  
  // ==================== 键盘事件处理 ====================
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const { selection } = editor;
    
    // 🔍 详细记录每个按键
    if (!event.nativeEvent?.isComposing && isDebugEnabled()) {
      window.console.group(`%c[⌨️ ${timestamp}] 按键: "${event.key}"`, 'color: #FF9800; font-weight: bold;');
      window.console.log('按键信息:', {
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });
      
      if (selection) {
        const currentNode = Editor.above(editor, {
          match: n => (n as any).type === 'event-line',
        });
        
        if (currentNode) {
          const [node, path] = currentNode;
          const eventLine = node as unknown as EventLineNode;
          const text = Node.string(node as unknown as Node);
          
          window.console.log('当前位置:', {
            lineId: eventLine.lineId.slice(-10),
            mode: eventLine.mode,
            level: eventLine.level,
            path,
            currentText: `"${text}"`,
            textLength: text.length,
            selection: {
              anchor: selection.anchor,
              focus: selection.focus,
              isCollapsed: Range.isCollapsed(selection),
            },
          });
        }
      }
      
      window.console.groupEnd();
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
    
    // Enter 键 - 创建新的 EventLine
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      
      if (isDebugEnabled()) {
        window.console.group(`%c[↩️ ${timestamp}] Enter 键 - 创建新行`, 'color: #4CAF50; font-weight: bold;');
        window.console.log('当前状态:', {
          currentLine: currentPath[0],
          lineId: eventLine.lineId.slice(-10),
          mode: eventLine.mode,
          level: eventLine.level,
          totalLines: value.length,
        });
      }
      
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
              if (isDebugEnabled()) {
                window.console.log('找到 description 行，插入位置调整:', { from: currentPath[0] + 1, to: insertIndex });
              }
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
      
      if (isDebugEnabled()) {
        window.console.log('创建新行:', {
          insertIndex,
          newLineId: newLine.lineId.slice(-10),
          inheritedLevel: eventLine.level,
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
      // 安全检查：确保节点有效
      try {
        const paragraph = eventLine.children[0];
        if (!paragraph) return;
        
        const text = Node.string(paragraph as unknown as Node);
        const startPoint = Editor.start(editor, currentPath);
        
        // 如果内容为空且在行首，删除当前行
        if (!text && Point.equals(selection.anchor, startPoint)) {
          event.preventDefault();
          
          if (isDebugEnabled()) {
            window.console.group(`%c[🗑️ ${timestamp}] 删除空行`, 'color: #f44336; font-weight: bold;');
            window.console.log('删除前状态:', {
              totalLines: value.length,
              currentLine: currentPath[0],
              lineId: eventLine.lineId.slice(-10),
              isLastLine: value.length === 1,
            });
          }
          
          // 🔧 修复：如果是最后一行，清空内容而不是删除节点
          if (value.length === 1) {
            if (isDebugEnabled()) {
              window.console.log('操作: 清空最后一行');
            }
            // 重置为空行
            Transforms.delete(editor, {
              at: {
                anchor: startPoint,
                focus: Editor.end(editor, currentPath),
              },
            });
            
            if (isDebugEnabled()) {
              window.console.log('删除后光标位置:', editor.selection);
              window.console.groupEnd();
            }
            return;
          }
        
          // 多行时删除当前行
          if (value.length > 1) {
            if (isDebugEnabled()) {
              window.console.log('操作: 删除当前行（非最后一行）');
              window.console.log('删除前光标:', editor.selection);
            }
            
            Transforms.removeNodes(editor, { at: currentPath });
            
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
  
  // 🔧 防止 Slate 内部错误导致崩溃
  const handleEditorError = useCallback((error: Error) => {
    console.error('[UnifiedSlateEditor] Caught error:', error);
    // 不阻止渲染，只记录错误
  }, []);
  
  return (
    <div className={`unified-slate-editor ${className}`} style={{ position: 'relative' }}>
      {/* 🆕 Gray Text Placeholder - 绝对定位在第一行 */}
      {shouldShowGrayText && (
        <div
          className="gray-text-placeholder"
          onClick={handleGrayTextClick}
          style={{
            position: 'absolute',
            top: '8px',
            left: '16px',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '14px',
            userSelect: 'none',
            pointerEvents: 'all',
            zIndex: 1,
          }}
        >
          {placeholder}
        </div>
      )}
      
      {/* 🔧 确保编辑器始终有内容 */}
      {value && value.length > 0 ? (
        <Slate 
          key={editorKey} 
          editor={editor} 
          initialValue={value as unknown as Descendant[]} 
          onChange={handleChange}
          onError={handleEditorError}
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
  );
};
