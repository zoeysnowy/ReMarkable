/**
 * SlateCore - 节点操作工具
 * 
 * 提供通用的节点查找、验证、路径计算等工具函数
 * 
 * @version 1.0.0
 * @date 2025-11-29
 */

import { Editor, Node, Path, Element as SlateElement, Text as SlateText } from 'slate';

/**
 * 按类型查找节点
 * @param editor Slate Editor
 * @param type 节点类型（如 'paragraph', 'event-line'）
 * @param from 起始路径（可选，默认当前选区）
 * @returns [node, path] 或 null
 */
export function findNodeByType(
  editor: Editor,
  type: string,
  from?: Path
): [Node, Path] | null {
  try {
    const [match] = Editor.nodes(editor, {
      at: from,
      match: (n: any) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === type,
    });
    
    if (match) {
      const [node, path] = match;
      return [node, path];
    }
    
    return null;
  } catch (err) {
    console.error('[SlateCore.findNodeByType] Failed:', err);
    return null;
  }
}

/**
 * 检查节点是否为空（无文本内容）
 * @param node Slate Node
 * @returns true = 空节点，false = 有内容
 */
export function isNodeEmpty(node: Node): boolean {
  try {
    // 递归检查所有文本节点
    const descendants = Array.from(Node.descendants(node));
    
    for (const [descendant] of descendants) {
      if (SlateText.isText(descendant) && descendant.text.trim().length > 0) {
        return false; // 找到非空文本
      }
    }
    
    return true; // 所有文本都为空
  } catch (err) {
    console.error('[SlateCore.isNodeEmpty] Failed:', err);
    return true;
  }
}

/**
 * 获取父节点路径
 * @param path 当前路径
 * @returns 父路径
 */
export function getParentPath(path: Path): Path {
  return path.slice(0, -1);
}

/**
 * 获取兄弟节点路径
 * @param path 当前路径
 * @param offset 偏移量（+1 = 下一个，-1 = 上一个）
 * @returns 兄弟路径 或 null（如果越界）
 */
export function getSiblingPath(path: Path, offset: number): Path | null {
  if (path.length === 0) return null;
  
  const parentPath = getParentPath(path);
  const index = path[path.length - 1];
  const newIndex = index + offset;
  
  if (newIndex < 0) return null; // 越界
  
  return [...parentPath, newIndex];
}

/**
 * 检查是否为祖先路径
 * @param ancestor 祖先路径
 * @param descendant 后代路径
 * @returns true = ancestor 是 descendant 的祖先
 */
export function isAncestorPath(ancestor: Path, descendant: Path): boolean {
  if (ancestor.length >= descendant.length) return false;
  
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== descendant[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * 检查路径是否有效
 * @param editor Slate Editor
 * @param path 路径
 * @returns true = 有效，false = 无效
 */
export function isValidPath(editor: Editor, path: Path): boolean {
  try {
    Node.get(editor, path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取节点在父节点中的索引
 * @param path 节点路径
 * @returns 索引值
 */
export function getNodeIndex(path: Path): number {
  return path[path.length - 1];
}

/**
 * 检查节点是否为特定类型
 * @param node Slate Node
 * @param type 类型字符串
 * @returns true = 匹配，false = 不匹配
 */
export function isNodeType(node: Node, type: string): boolean {
  return SlateElement.isElement(node) && (node as any).type === type;
}

/**
 * 获取节点的所有文本内容（递归）
 * @param node Slate Node
 * @returns 文本字符串
 */
export function getNodeText(node: Node): string {
  try {
    const descendants = Array.from(Node.descendants(node));
    const textNodes = descendants
      .map(([n]) => n)
      .filter(SlateText.isText)
      .map((n) => n.text);
    
    return textNodes.join('');
  } catch (err) {
    console.error('[SlateCore.getNodeText] Failed:', err);
    return '';
  }
}

/**
 * 查找所有特定类型的子节点
 * @param node Slate Node
 * @param type 节点类型
 * @returns 节点数组
 */
export function findChildrenByType(node: Node, type: string): Node[] {
  const results: Node[] = [];
  
  try {
    const descendants = Array.from(Node.descendants(node));
    
    for (const [descendant] of descendants) {
      if (isNodeType(descendant, type)) {
        results.push(descendant);
      }
    }
  } catch (err) {
    console.error('[SlateCore.findChildrenByType] Failed:', err);
  }
  
  return results;
}
