/**
 * SlateCore - Bullet 操作工具
 * 
 * 提供 Bullet List 的增删改查功能
 * 支持多层级 bullet (0-4)，OneNote 风格删除机制
 * 支持自动检测触发字符（* - • ➢）
 * 
 * @version 2.0.0
 * @date 2025-11-30
 */

import { Editor, Transforms, Element, Path, Range, Point, Node as SlateNode } from 'slate';

// 🎯 Bullet 触发字符配置
export const BULLET_TRIGGERS = ['* ', '- ', '• ', '➢ ', '· '] as const;

// 🎨 Bullet 符号映射（5级）
export const BULLET_CHARS = ['●', '○', '–', '□', '▸'] as const;

/**
 * 获取指定层级的 Bullet 符号
 */
export function getBulletChar(level: number): string {
  return BULLET_CHARS[Math.min(level, BULLET_CHARS.length - 1)];
}

/**
 * 检测输入是否触发 Bullet 自动转换
 * @returns 触发的字符串（如 "* "），或 null
 */
export function detectBulletTrigger(editor: Editor): string | null {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) {
    console.log('[detectBulletTrigger] ❌ 无选区或选区非折叠状态');
    return null;
  }

  try {
    // 获取光标前的两个字符
    const { anchor } = selection;
    const beforePoint = Editor.before(editor, anchor, { unit: 'character', distance: 2 });
    
    if (!beforePoint) {
      console.log('[detectBulletTrigger] ❌ 无法获取光标前的位置');
      return null;
    }

    const beforeRange = { anchor: beforePoint, focus: anchor };
    const beforeText = Editor.string(editor, beforeRange);
    
    console.log('[detectBulletTrigger] 🔍 光标前文本:', JSON.stringify(beforeText), '长度:', beforeText.length);

    // 检查是否匹配触发字符
    for (const trigger of BULLET_TRIGGERS) {
      console.log('[detectBulletTrigger] 🔍 比对触发字符:', JSON.stringify(trigger), '匹配:', beforeText === trigger);
      if (beforeText === trigger) {
        return trigger;
      }
    }

    return null;
  } catch (err) {
    console.error('[SlateCore.detectBulletTrigger] Failed:', err);
    return null;
  }
}

/**
 * 应用 Bullet 自动转换（删除触发字符，设置 bullet 属性）
 * @param trigger 触发字符（如 "* "）
 */
export function applyBulletAutoConvert(editor: Editor, trigger: string): boolean {
  try {
    const { selection } = editor;
    if (!selection) return false;

    // 1. 删除触发字符（向后删除两个字符）
    const beforePoint = Editor.before(editor, selection.anchor, { 
      unit: 'character', 
      distance: trigger.length 
    });
    
    if (!beforePoint) return false;

    Editor.withoutNormalizing(editor, () => {
      // 删除触发字符
      Transforms.delete(editor, {
        at: { anchor: beforePoint, focus: selection.anchor },
      });

      // 2. 设置当前段落为 bullet level 0
      const [paraMatch] = Editor.nodes(editor, {
        match: (n: any) => !Editor.isEditor(n) && Element.isElement(n) && n.type === 'paragraph',
      });

      if (paraMatch) {
        const [, nodePath] = paraMatch;
        Transforms.setNodes(editor, { bullet: true, bulletLevel: 0 } as any, { at: nodePath });
        console.log('[SlateCore.applyBulletAutoConvert] ✅ 触发自动转换:', trigger);
      }
    });

    return true;
  } catch (err) {
    console.error('[SlateCore.applyBulletAutoConvert] Failed:', err);
    return false;
  }
}

/**
 * 增加 Bullet 层级
 * @param editor Slate Editor
 * @param path 段落路径（可选，默认当前选区）
 * @param maxLevel 最大层级（默认 4）
 */
export function increaseBulletLevel(
  editor: Editor,
  path?: Path,
  maxLevel: number = 4
): boolean {
  try {
    const [paraMatch] = Editor.nodes(editor, {
      at: path,
      match: (n: any) => !Editor.isEditor(n) && Element.isElement(n) && (n as any).type === 'paragraph',
    });
    
    if (!paraMatch) return false;
    
    const [node, nodePath] = paraMatch;
    const para = node as any;
    
    if (para.bullet) {
      const currentLevel = para.bulletLevel || 0;
      const newLevel = currentLevel + 1;
      
      if (newLevel <= maxLevel) {
        Transforms.setNodes(editor, { bulletLevel: newLevel } as any, { at: nodePath });
        console.log('[SlateCore.increaseBulletLevel] 层级增加:', currentLevel, '→', newLevel);
        return true;
      } else {
        console.warn('[SlateCore.increaseBulletLevel] 已达到最大层级:', maxLevel);
        return false;
      }
    } else {
      // 如果不是 bullet，先设置为 bullet level 0
      Transforms.setNodes(editor, { bullet: true, bulletLevel: 0 } as any, { at: nodePath });
      console.log('[SlateCore.increaseBulletLevel] 设置为 bullet level 0');
      return true;
    }
  } catch (err) {
    console.error('[SlateCore.increaseBulletLevel] Failed:', err);
    return false;
  }
}

/**
 * 减少 Bullet 层级
 * @param editor Slate Editor
 * @param path 段落路径（可选，默认当前选区）
 */
export function decreaseBulletLevel(
  editor: Editor,
  path?: Path
): boolean {
  try {
    const [paraMatch] = Editor.nodes(editor, {
      at: path,
      match: (n: any) => !Editor.isEditor(n) && Element.isElement(n) && (n as any).type === 'paragraph',
    });
    
    if (!paraMatch) return false;
    
    const [node, nodePath] = paraMatch;
    const para = node as any;
    
    if (para.bullet) {
      const currentLevel = para.bulletLevel || 0;
      const newLevel = currentLevel - 1;
      
      if (newLevel < 0) {
        // Level 0 再减少就取消 bullet
        Transforms.setNodes(editor, { bullet: undefined, bulletLevel: undefined } as any, { at: nodePath });
        console.log('[SlateCore.decreaseBulletLevel] 取消 bullet');
        return true;
      } else {
        Transforms.setNodes(editor, { bulletLevel: newLevel } as any, { at: nodePath });
        console.log('[SlateCore.decreaseBulletLevel] 层级减少:', currentLevel, '→', newLevel);
        return true;
      }
    }
    
    return false;
  } catch (err) {
    console.error('[SlateCore.decreaseBulletLevel] Failed:', err);
    return false;
  }
}

/**
 * 切换 Bullet List（如果是 bullet 则取消，否则设置为 bullet level 0）
 * @param editor Slate Editor
 * @param path 段落路径（可选，默认当前选区）
 */
export function toggleBullet(
  editor: Editor,
  path?: Path
): boolean {
  try {
    const [paraMatch] = Editor.nodes(editor, {
      at: path,
      match: (n: any) => !Editor.isEditor(n) && Element.isElement(n) && (n as any).type === 'paragraph',
    });
    
    if (!paraMatch) return false;
    
    const [node, nodePath] = paraMatch;
    const para = node as any;
    
    if (para.bullet) {
      // 已是 bullet，取消
      Transforms.setNodes(editor, { bullet: undefined, bulletLevel: undefined } as any, { at: nodePath });
      console.log('[SlateCore.toggleBullet] 取消 bullet');
    } else {
      // 设置为 bullet（默认 level 0）
      Transforms.setNodes(editor, { bullet: true, bulletLevel: 0 } as any, { at: nodePath });
      console.log('[SlateCore.toggleBullet] 设置为 bullet level 0');
    }
    
    return true;
  } catch (err) {
    console.error('[SlateCore.toggleBullet] Failed:', err);
    return false;
  }
}

/**
 * OneNote 风格的 Backspace 处理（行首删除 bullet）
 * @param editor Slate Editor
 * @param path 段落路径
 * @param offset 光标偏移量
 * @returns true = 已处理（阻止默认行为），false = 使用默认行为
 */
export function handleBulletBackspace(
  editor: Editor,
  path: Path,
  offset: number
): boolean {
  try {
    // 只在行首处理（offset === 0）
    if (offset !== 0) {
      return false; // 非行首，使用默认行为
    }
    
    const [paraMatch] = Editor.nodes(editor, {
      at: path,
      match: (n: any) => !Editor.isEditor(n) && Element.isElement(n) && (n as any).type === 'paragraph',
    });
    
    if (!paraMatch) return false;
    
    const [node, nodePath] = paraMatch;
    const para = node as any;
    
    if (!para.bullet) {
      return false; // 不是 bullet，使用默认行为
    }
    
    const currentLevel = para.bulletLevel || 0;
    
    if (currentLevel > 0) {
      // Level > 0: Backspace 降低一级层级
      Transforms.setNodes(editor, { bulletLevel: currentLevel - 1 } as any, { at: nodePath });
      console.log('[SlateCore.handleBulletBackspace] 降低层级:', currentLevel, '→', currentLevel - 1);
      return true; // 阻止默认行为
    } else {
      // Level 0: Backspace 删除 bullet，保留文本
      Transforms.setNodes(editor, { bullet: undefined, bulletLevel: undefined } as any, { at: nodePath });
      console.log('[SlateCore.handleBulletBackspace] 删除 bullet，保留文本');
      return true; // 阻止默认行为
    }
  } catch (err) {
    console.error('[SlateCore.handleBulletBackspace] Failed:', err);
    return false;
  }
}

/**
 * Enter 键处理（自动继承 bullet）
 * @param editor Slate Editor
 * @returns true = 已处理（阻止默认行为），false = 使用默认行为
 */
export function handleBulletEnter(
  editor: Editor
): boolean {
  try {
    const { selection } = editor;
    if (!selection) return false;
    
    const [paraMatch] = Editor.nodes(editor, {
      match: (n: any) => !Editor.isEditor(n) && Element.isElement(n) && (n as any).type === 'paragraph',
    });
    
    if (!paraMatch) return false;
    
    const [node] = paraMatch;
    const para = node as any;
    
    if (!para.bullet) {
      return false; // 不是 bullet，使用默认行为
    }
    
    // 检查当前行是否为空
    const paraText = para.children.map((child: any) => child.text || '').join('');
    
    if (paraText.trim() === '') {
      // 空 bullet 行按 Enter → 删除 bullet
      Transforms.setNodes(editor, { bullet: undefined, bulletLevel: undefined } as any);
      console.log('[SlateCore.handleBulletEnter] 空行删除 bullet');
      return false; // 使用默认行为（创建新行）
    }
    
    // 非空行：创建新行，继承 bullet 和 level
    const currentLevel = para.bulletLevel || 0;
    Transforms.splitNodes(editor);
    Transforms.setNodes(editor, { bullet: true, bulletLevel: currentLevel } as any);
    console.log('[SlateCore.handleBulletEnter] 继承 bullet level:', currentLevel);
    return true; // 阻止默认行为
  } catch (err) {
    console.error('[SlateCore.handleBulletEnter] Failed:', err);
    return false;
  }
}
