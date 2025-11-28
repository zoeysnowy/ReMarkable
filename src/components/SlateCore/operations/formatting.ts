/**
 * SlateCore - 格式化操作工具
 * 
 * 提供文本格式化功能（粗体、斜体、颜色等）
 * 
 * @version 1.0.0
 * @date 2025-11-29
 */

import { Editor, Transforms, Element, Range, Text as SlateText } from 'slate';
import { ReactEditor } from 'slate-react';

export type TextFormat = 'bold' | 'italic' | 'underline' | 'strikethrough';

/**
 * 应用文本格式化命令
 */
export function applyTextFormat(editor: Editor, command: string, value?: string): boolean {
  console.log('[SlateCore.applyTextFormat] 🎨 执行格式化命令:', {
    command,
    value,
    isFocused: ReactEditor.isFocused(editor as ReactEditor),
    selection: editor.selection,
    hasSelection: !!editor.selection,
    isCollapsed: editor.selection ? Range.isCollapsed(editor.selection) : null,
  });
  
  // 🚨 关键检查：必须有选区才能应用格式
  if (!editor.selection) {
    console.error('[SlateCore.applyTextFormat] ❌ 无选区，无法应用格式');
    return false;
  }
  
  // 🚨 如果选区是折叠的（光标位置），也无法应用到已有文本
  if (Range.isCollapsed(editor.selection)) {
    console.warn('[SlateCore.applyTextFormat] ⚠️ 选区已折叠（无选中文本），mark只会影响下次输入');
  }
  
  try {
    // 🔧 确保编辑器有焦点
    if (!ReactEditor.isFocused(editor as ReactEditor)) {
      console.log('[SlateCore.applyTextFormat] ⚠️ 编辑器未聚焦，尝试聚焦...');
      ReactEditor.focus(editor as ReactEditor);
    }
    
    switch (command) {
      case 'bold':
        Editor.addMark(editor, 'bold', true);
        break;
      case 'italic':
        Editor.addMark(editor, 'italic', true);
        break;
      case 'underline':
        Editor.addMark(editor, 'underline', true);
        break;
      case 'strikeThrough':
        Editor.addMark(editor, 'strikethrough', true);
        break;
      case 'textColor':
        // 🆕 应用文本颜色
        if (value) {
          const beforeMarks = Editor.marks(editor);
          console.log('[SlateCore.applyTextFormat] ✅ 添加文本颜色 mark:', { 
            color: value,
            应用前的marks: beforeMarks 
          });
          Editor.addMark(editor, 'color', value);
          const afterMarks = Editor.marks(editor);
          console.log('[SlateCore.applyTextFormat] 📊 应用后 marks:', afterMarks);
          
          // 🔍 调试：检查选区中的节点
          if (editor.selection) {
            const nodes = Array.from(Editor.nodes(editor, {
              at: editor.selection,
              match: n => SlateText.isText(n),
            }));
            console.log('[SlateCore.applyTextFormat] 🔍 选区中的文本节点:', {
              nodeCount: nodes.length,
              nodes: nodes.map(([node]) => ({
                text: (node as any).text,
                marks: node
              }))
            });
          }
        } else {
          console.log('[SlateCore.applyTextFormat] ❌ 移除文本颜色 mark');
          Editor.removeMark(editor, 'color');
        }
        break;
      case 'backgroundColor':
        // 🆕 应用背景颜色
        if (value) {
          const beforeMarks = Editor.marks(editor);
          console.log('[SlateCore.applyTextFormat] ✅ 添加背景颜色 mark:', { 
            backgroundColor: value,
            应用前的marks: beforeMarks 
          });
          Editor.addMark(editor, 'backgroundColor', value);
          const afterMarks = Editor.marks(editor);
          console.log('[SlateCore.applyTextFormat] 📊 应用后 marks:', afterMarks);
        } else {
          console.log('[SlateCore.applyTextFormat] ❌ 移除背景颜色 mark');
          Editor.removeMark(editor, 'backgroundColor');
        }
        break;
      case 'removeFormat':
        // 移除所有格式（包括颜色）
        Editor.removeMark(editor, 'bold');
        Editor.removeMark(editor, 'italic');
        Editor.removeMark(editor, 'underline');
        Editor.removeMark(editor, 'strikethrough');
        Editor.removeMark(editor, 'color');
        Editor.removeMark(editor, 'backgroundColor');
        break;
      default:
        console.warn('[SlateCore.applyTextFormat] Unknown command:', command);
        return false;
    }
    
    return true;
  } catch (err) {
    console.error('[SlateCore.applyTextFormat] Failed:', err);
    return false;
  }
}

/**
 * 获取当前激活的格式
 */
export function getActiveFormats(editor: Editor): Set<TextFormat> {
  const activeFormats = new Set<TextFormat>();
  const marks = Editor.marks(editor);
  
  if (marks) {
    if (marks.bold) activeFormats.add('bold');
    if (marks.italic) activeFormats.add('italic');
    if (marks.underline) activeFormats.add('underline');
    if (marks.strikethrough) activeFormats.add('strikethrough');
  }
  
  return activeFormats;
}

/**
 * 清除所有格式
 */
export function clearAllFormats(editor: Editor): void {
  Editor.removeMark(editor, 'bold');
  Editor.removeMark(editor, 'italic');
  Editor.removeMark(editor, 'underline');
  Editor.removeMark(editor, 'strikethrough');
  Editor.removeMark(editor, 'color');
  Editor.removeMark(editor, 'backgroundColor');
}

/**
 * 切换格式（如果已激活则移除，否则添加）
 */
export function toggleFormat(editor: Editor, format: TextFormat): void {
  const isActive = Editor.marks(editor)?.[format] === true;
  
  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
}
