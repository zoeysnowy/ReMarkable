/**
 * SlateCore - JSON 序列化工具
 * 
 * 提供 Slate JSON 格式的序列化和反序列化
 * 统一的 JSON ↔ Slate nodes 转换
 * 
 * @version 1.0.0
 * @date 2025-11-29
 */

import { Descendant } from 'slate';

/**
 * JSON 字符串 → Slate nodes
 * @param json JSON 字符串或对象
 * @returns Slate nodes 数组
 */
export function jsonToSlateNodes(json: string | any[]): Descendant[] {
  try {
    // 如果已经是对象，直接返回
    if (Array.isArray(json)) {
      return json as Descendant[];
    }
    
    // 如果是字符串，解析 JSON
    if (typeof json === 'string') {
      if (json.trim() === '') {
        // 空字符串，返回默认空段落
        return [
          {
            type: 'paragraph',
            children: [{ text: '' }],
          } as any,
        ];
      }
      
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
    
    // 其他情况，返回默认空段落
    console.warn('[SlateCore.jsonToSlateNodes] 无效输入，返回空段落:', json);
    return [
      {
        type: 'paragraph',
        children: [{ text: '' }],
      } as any,
    ];
  } catch (err) {
    console.error('[SlateCore.jsonToSlateNodes] 解析失败:', err);
    return [
      {
        type: 'paragraph',
        children: [{ text: '' }],
      } as any,
    ];
  }
}

/**
 * Slate nodes → JSON 字符串
 * @param nodes Slate nodes 数组
 * @returns JSON 字符串
 */
export function slateNodesToJson(nodes: Descendant[]): string {
  try {
    return JSON.stringify(nodes);
  } catch (err) {
    console.error('[SlateCore.slateNodesToJson] 序列化失败:', err);
    return '[]';
  }
}

/**
 * 创建空段落节点
 * @returns 空段落
 */
export function createEmptyParagraph(): any {
  return {
    type: 'paragraph',
    children: [{ text: '' }],
  };
}

/**
 * 创建带文本的段落节点
 * @param text 文本内容
 * @returns 段落节点
 */
export function createTextParagraph(text: string): any {
  return {
    type: 'paragraph',
    children: [{ text }],
  };
}

/**
 * 创建 Bullet 段落节点
 * @param text 文本内容
 * @param level bullet 层级 (0-4)
 * @returns Bullet 段落节点
 */
export function createBulletParagraph(text: string, level: number = 0): any {
  return {
    type: 'paragraph',
    bullet: true,
    bulletLevel: level,
    children: [{ text }],
  };
}
