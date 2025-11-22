/**
 * EventLogTimestampService - EventLog 时间戳自动插入服务
 * 
 * 按照 TimeLog PRD 的规则自动插入 timestamp divider：
 * 1. 当天首次编辑 → 完整时间戳（如 "2025-10-19 10:21:18"）
 * 2. 距上次编辑超过 5 分钟 → 相对时间戳（如 "16min later"）
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import { Editor, Transforms, Range, Node, Element as SlateElement } from 'slate';
import { TimestampDividerElement } from './types';

/**
 * 检查两个日期是否为同一天
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

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

/**
 * 格式化相对时间（如 "16min later", "2h later"）
 */
function formatRelativeTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min later`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h later`;
  }
  
  return `${hours}h ${remainingMinutes}min later`;
}

export class EventLogTimestampService {
  private lastEditTimestamp: Map<string, Date> = new Map();
  
  /**
   * 检查是否需要插入 timestamp
   * @param editor Slate Editor 实例（新增参数，用于 LightSlateEditor 模式）
   * @param value 当前 Slate 值（新增参数，用于检测内容变化）
   * @param eventId Event ID（可选，用于传统模式）
   * @returns 是否需要插入
   */
  shouldInsertTimestamp(editor: Editor, value?: any[], eventId?: string): boolean {
    // 如果没有提供 eventId，使用默认的 'light-editor' 作为key
    const contextId = eventId || 'light-editor';
    const lastEdit = this.lastEditTimestamp.get(contextId);
    const now = new Date();
    
    console.log('[TimestampService] shouldInsertTimestamp 检查:', {
      contextId,
      eventId,
      lastEdit,
      now,
      hasLastEdit: !!lastEdit
    });
    
    // 情况1：当天首次编辑
    if (!lastEdit || !isSameDay(lastEdit, now)) {
      console.log('[TimestampService] 返回 true - 首次编辑或新的一天');
      return true;
    }
    
    // 情况2：距上次编辑超过 15 分钟（减少频率）
    const minutesElapsed = (now.getTime() - lastEdit.getTime()) / 1000 / 60;
    const shouldInsert = minutesElapsed >= 15;
    console.log('[TimestampService] 检查时间间隔:', { minutesElapsed, shouldInsert });
    return shouldInsert;
  }
  
  /**
   * 创建 timestamp divider 节点
   * @param eventId Event ID (可选)
   * @returns TimestampDividerElement
   */
  createTimestampDivider(eventId?: string): TimestampDividerElement {
    const contextId = eventId || 'light-editor';
    const lastEdit = this.lastEditTimestamp.get(contextId);
    const now = new Date();
    
    const isFirstOfDay = !lastEdit || !isSameDay(lastEdit, now);
    const minutesSinceLast = lastEdit 
      ? Math.floor((now.getTime() - lastEdit.getTime()) / 1000 / 60)
      : undefined;
    
    const displayText = isFirstOfDay
      ? formatDateTime(now) // "2025-10-19 10:21:18"
      : `${formatDateTime(now)} | ${formatRelativeTime(minutesSinceLast!)}`; // "2025-10-19 10:35:18 | 16min later"
    
    return {
      type: 'timestamp-divider',
      timestamp: now.toISOString(),
      isFirstOfDay,
      minutesSinceLast,
      displayText,
      children: [{ text: '' }]
    };
  }
  
  /**
   * 在 Slate 编辑器中插入 timestamp
   * @param editor Slate Editor 实例
   * @param timestampElement 预创建的 timestamp 元素 (用于 LightSlateEditor)
   * @param eventId Event ID (可选，用于传统模式)
   */
  insertTimestamp(editor: Editor, timestampElement?: TimestampDividerElement, eventId?: string): void {
    console.log('[TimestampService] insertTimestamp 被调用:', { eventId, hasPreElement: !!timestampElement });
    
    // 如果没有预创建元素，检查是否需要插入并创建
    if (!timestampElement) {
      if (!this.shouldInsertTimestamp(editor, undefined, eventId)) {
        console.log('[TimestampService] shouldInsertTimestamp 返回 false，跳过插入');
        return;
      }
      timestampElement = this.createTimestampDivider(eventId);
    }
    
    const timestampNode = timestampElement;
    console.log('[TimestampService] 创建 timestamp 节点:', timestampNode);
    
    try {
      // 使用最安全的方式：在文档开始插入
      const { selection } = editor;
      console.log('[TimestampService] 编辑器状态:', { hasSelection: !!selection });
      
      if (selection) {
        // 尝试在当前段落开始插入
        const [match] = Editor.nodes(editor, {
          match: n => SlateElement.isElement(n) && (n as any).type === 'paragraph'
        });
        
        if (match) {
          const [, paragraphPath] = match;
          console.log('[TimestampService] 在段落路径插入:', paragraphPath);
          Transforms.insertNodes(editor, timestampNode as any, { at: paragraphPath });
        } else {
          // 回退到在选择点前插入
          console.log('[TimestampService] 在选择点插入');
          Transforms.insertNodes(editor, timestampNode as any);
        }
      } else {
        // 没有选择时，在文档开头插入
        console.log('[TimestampService] 在文档开头插入');
        Transforms.insertNodes(editor, timestampNode as any, { at: [0] });
      }
      
      console.log('[TimestampService] timestamp 插入成功');
      
    } catch (error) {
      console.error('[Timestamp] 插入失败:', error);
    }
    
    // 更新最后编辑时间
    const contextId = eventId || 'light-editor';
    this.lastEditTimestamp.set(contextId, new Date());
    console.log('[TimestampService] 更新最后编辑时间完成:', contextId);
  }
  
  /**
   * 重置某个 Event 的时间戳记录（用于清空 eventlog 时）
   * @param eventId Event ID
   */
  resetTimestamp(eventId: string): void {
    this.lastEditTimestamp.delete(eventId);
  }
  
  /**
   * 清空所有时间戳记录
   */
  clearAll(): void {
    this.lastEditTimestamp.clear();
  }
}
