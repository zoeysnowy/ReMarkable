/**
 * 序列化/反序列化工具
 * 
 * 负责 Slate 节点 ↔ PlanItem 数组的双向转换
 */

import { Descendant, Text } from 'slate';
import { 
  EventLineNode, 
  ParagraphNode, 
  TextNode, 
  TagNode, 
  DateMentionNode,
  CustomElement,
  EventLineData,
  EventMetadata,  // 🆕 导入 EventMetadata 类型
} from './types';

// ==================== PlanItem → Slate 节点 ====================

/**
 * 将 PlanItem 数组转换为 Slate 节点数组
 */
export function planItemsToSlateNodes(items: any[]): EventLineNode[] {
  const nodes: EventLineNode[] = [];
  
  // 🔍 DEBUG: 检查加载时是否包含 eventlog
  if (items.length > 0) {
    console.log('[planItemsToSlateNodes] 加载事件:', {
      总数: items.length,
      示例: items.slice(0, 3).map(item => ({
        id: item.id?.substring(0, 30),
        title: item.title?.substring(0, 20),
        hasEventlog: !!(item.eventlog),
        hasDescription: !!(item.description),
        eventlogLength: (item.eventlog || '').length,
        descriptionLength: (item.description || '').length,
      }))
    });
  }
  
  items.forEach(item => {
    // 🆕 v1.6: 提取完整元数据（透传所有业务字段）
    const metadata: EventMetadata = {
      // 时间字段
      startTime: item.startTime ?? null,
      endTime: item.endTime ?? null,
      dueDate: item.dueDate ?? null,
      isAllDay: item.isAllDay,
      timeSpec: item.timeSpec,
      
      // 样式字段
      emoji: item.emoji,
      color: item.color,
      
      // 业务字段
      priority: item.priority,
      category: item.category,
      isCompleted: item.isCompleted,
      isTask: item.isTask,
      type: item.type,
      
      // Plan 相关
      isPlan: item.isPlan,
      isTimeCalendar: item.isTimeCalendar,
      
      // 同步字段
      calendarId: item.calendarId,
      calendarIds: item.calendarIds,
      todoListIds: item.todoListIds, // 🆕 To Do List IDs
      source: item.source,
      syncStatus: item.syncStatus,
      externalId: item.externalId,
      remarkableSource: item.remarkableSource,
      
      // 时间戳
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
    
    // Title 行（始终创建，即使内容为空）
    const titleNode: EventLineNode = {
      type: 'event-line',
      eventId: item.eventId || item.id,
      lineId: item.id,
      level: item.level || 0,
      mode: 'title',
      children: [
        {
          type: 'paragraph',
          children: htmlToSlateFragment(item.content || item.title || ''),
        },
      ],
      metadata,  // 🆕 透传元数据
    };
    nodes.push(titleNode);
    
    // Description 行（只有存在时才创建）
    // 🆕 v1.8: 优先使用 eventlog (富文本)，回退到 description (纯文本)
    const descriptionContent = item.eventlog || item.description;
    if (descriptionContent) {
      const descNode: EventLineNode = {
        type: 'event-line',
        eventId: item.eventId || item.id,
        lineId: `${item.id}-desc`,
        level: item.level || 0,
        mode: 'description',
        children: [
          {
            type: 'paragraph',
            children: htmlToSlateFragment(descriptionContent),
          },
        ],
        metadata,  // 🆕 透传元数据（description 行共享 metadata）
      };
      nodes.push(descNode);
    }
  });
  
  // ✅ v1.5: 如果没有节点，创建一个临时空节点（供 Slate 编辑器使用）
  // 但在 slateNodesToPlanItems 转换时会被过滤掉
  if (nodes.length === 0) {
    nodes.push(createEmptyEventLine());
  }
  
  return nodes;
}

/**
 * 将 HTML 转换为 Slate fragment
 */
function htmlToSlateFragment(html: string): (TextNode | TagNode | DateMentionNode)[] {
  if (!html) return [{ text: '' }];
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const fragment: (TextNode | TagNode | DateMentionNode)[] = [];
  
  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        fragment.push({ text });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      
      // Tag 元素
      if (element.hasAttribute('data-tag-id')) {
        fragment.push({
          type: 'tag',
          tagId: element.getAttribute('data-tag-id') || '',
          tagName: element.getAttribute('data-tag-name') || '',
          tagColor: element.getAttribute('data-tag-color') || undefined,
          tagEmoji: element.getAttribute('data-tag-emoji') || undefined,
          mentionOnly: element.hasAttribute('data-mention-only'),
          children: [{ text: '' }],
        });
      }
      // DateMention 元素
      else if (element.hasAttribute('data-start-date')) {
        fragment.push({
          type: 'dateMention',
          startDate: element.getAttribute('data-start-date') || '',
          endDate: element.getAttribute('data-end-date') || undefined,
          mentionOnly: element.hasAttribute('data-mention-only'),
          children: [{ text: '' }],
        });
      }
      // 格式化文本
      else if (element.tagName === 'STRONG' || element.tagName === 'B') {
        const children: (TextNode | TagNode | DateMentionNode)[] = [];
        element.childNodes.forEach(child => processNode(child));
        // TODO: 处理嵌套格式
      }
      // 递归处理子节点
      else {
        element.childNodes.forEach(child => processNode(child));
      }
    }
  }
  
  tempDiv.childNodes.forEach(node => processNode(node));
  
  return fragment.length > 0 ? fragment : [{ text: '' }];
}

/**
 * 创建空的 EventLine 节点
 */
export function createEmptyEventLine(level: number = 0): EventLineNode {
  const lineId = `line-${Date.now()}-${Math.random()}`;
  return {
    type: 'event-line',
    lineId,
    eventId: lineId, // 🔧 新行的 eventId 与 lineId 相同
    level,
    mode: 'title',
    children: [
      {
        type: 'paragraph',
        children: [{ text: '' }],
      },
    ],
  };
}

// ==================== Slate 节点 → PlanItem ====================

/**
 * 将 Slate 节点数组转换为 PlanItem 数组
 */
export function slateNodesToPlanItems(nodes: EventLineNode[]): any[] {
  const items: Map<string, any> = new Map();
  
  nodes.forEach(node => {
    if (node.type !== 'event-line') return;
    
    // 🔧 FIX: 使用 eventId 作为分组依据，而不是 lineId
    // Description 行的 lineId 是 `${id}-desc`，但 eventId 是正确的完整 ID
    const baseId = node.eventId;
    
    if (!baseId) {
      console.warn('[slateNodesToPlanItems] Node missing eventId:', node);
      return;
    }
    
    if (!items.has(baseId)) {
      // 🆕 v1.6: 从第一个遇到的节点中提取完整 metadata
      const metadata = node.metadata || {};
      
      items.set(baseId, {
        id: baseId,
        eventId: node.eventId,
        level: node.level,
        title: '',
        content: '',
        description: '',
        tags: [],
        
        // 🆕 v1.6: 透传完整元数据（带默认值）
        startTime: metadata.startTime ?? undefined,
        endTime: metadata.endTime ?? undefined,
        dueDate: metadata.dueDate ?? undefined,
        isAllDay: metadata.isAllDay ?? false,
        timeSpec: metadata.timeSpec,
        
        emoji: metadata.emoji,
        color: metadata.color,
        
        priority: metadata.priority || 'medium',
        category: metadata.category,
        isCompleted: metadata.isCompleted || false,
        isTask: metadata.isTask ?? true,
        type: metadata.type || 'todo',
        
        isPlan: metadata.isPlan ?? true,
        isTimeCalendar: metadata.isTimeCalendar ?? false,
        
        calendarId: metadata.calendarId,
        calendarIds: metadata.calendarIds || [],
        todoListIds: metadata.todoListIds || [], // 🆕 To Do List IDs
        source: metadata.source || 'local',
        syncStatus: metadata.syncStatus || 'local-only',
        externalId: metadata.externalId,
        remarkableSource: metadata.remarkableSource ?? true,
        
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
      });
    }
    
    const item = items.get(baseId)!;
    
    // 🔧 安全检查:确保节点结构正确，但不要跳过节点，只是使用安全的默认值
    const fragment = node.children?.[0]?.children;
    
    // 如果没有有效的 fragment，使用空数组（不会崩溃，但会正确处理）
    const html = fragment ? slateFragmentToHtml(fragment) : '';
    
    if (node.mode === 'title') {
      item.content = html;
      item.title = fragment ? extractPlainText(fragment) : '';
      item.tags = fragment ? extractTags(fragment) : [];
    } else {
      // 🆕 v1.8: 描述行保存到 eventlog (富文本) 和 description (纯文本)
      // 双向同步策略：
      // 1. 编辑器内容 → eventlog (富文本) + description (纯文本)
      // 2. 如果 eventlog 为空但 description 有内容 → 从 description 初始化 eventlog
      // 3. 保持两个字段始终同步（增量更新）
      
      const newEventlog = html; // 当前编辑器的富文本内容
      const newDescription = fragment ? extractPlainText(fragment) : ''; // 当前编辑器的纯文本内容
      
      item.eventlog = newEventlog;
      item.description = newDescription;
      
      // 🔍 调试日志
      console.log('[slateNodesToPlanItems] Description 保存 (双向同步):', {
        eventId: baseId,
        lineId: node.lineId,
        eventlog: item.eventlog,
        description: item.description,
        fragmentLength: fragment?.length || 0
      });
    }
  });
  
  // ✅ v1.5: 过滤掉空节点（临时占位节点）
  const result = Array.from(items.values()).filter(item => {
    const isEmpty = !item.title?.trim() && 
                   !item.content?.trim() && 
                   !item.description?.trim() &&
                   (!item.tags || item.tags.length === 0);
    return !isEmpty;  // 只保留非空节点
  });
  
  // 🔍 v1.8: 调试返回的 items
  console.log('[slateNodesToPlanItems] 返回结果:', result.map(item => ({
    id: item.id,
    title: item.title?.substring(0, 20),
    hasEventlog: !!item.eventlog,
    hasDescription: !!item.description,
    eventlogLength: item.eventlog?.length || 0,
    descriptionLength: item.description?.length || 0
  })));
  
  return result;
}

/**
 * 将 Slate fragment 转换为 HTML
 */
function slateFragmentToHtml(fragment: (TextNode | TagNode | DateMentionNode)[]): string {
  // 🔧 安全检查：如果 fragment 为 undefined 或 null，返回空字符串
  if (!fragment || !Array.isArray(fragment)) {
    console.warn('[slateFragmentToHtml] fragment 不是数组', { fragment });
    return '';
  }
  
  return fragment.map(node => {
    if ('text' in node) {
      let text = node.text;
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      if (node.underline) text = `<u>${text}</u>`;
      if (node.strikethrough) text = `<s>${text}</s>`;
      if (node.color) text = `<span style="color: ${node.color}">${text}</span>`;
      return text;
    } else if (node.type === 'tag') {
      const attrs = [
        `data-type="tag"`,
        `data-tag-id="${node.tagId}"`,
        `data-tag-name="${node.tagName}"`,
        node.tagColor ? `data-tag-color="${node.tagColor}"` : '',
        node.tagEmoji ? `data-tag-emoji="${node.tagEmoji}"` : '',
        node.mentionOnly ? `data-mention-only="true"` : '',
      ].filter(Boolean).join(' ');
      
      const emoji = node.tagEmoji ? node.tagEmoji + ' ' : '';
      return `<span ${attrs} contenteditable="false" class="inline-tag">${emoji}${node.tagName}</span>`;
    } else if (node.type === 'dateMention') {
      const attrs = [
        `data-type="dateMention"`,
        `data-start-date="${node.startDate}"`,
        node.endDate ? `data-end-date="${node.endDate}"` : '',
        node.mentionOnly ? `data-mention-only="true"` : '',
      ].filter(Boolean).join(' ');
      
      const startDate = new Date(node.startDate);
      const endDate = node.endDate ? new Date(node.endDate) : null;
      const dateText = formatDateForDisplay(startDate, endDate);
      
      return `<span ${attrs} contenteditable="false" class="inline-date">📅 ${dateText}</span>`;
    }
    return '';
  }).join('');
}

/**
 * 提取纯文本
 */
function extractPlainText(fragment: (TextNode | TagNode | DateMentionNode)[]): string {
  // 🔧 安全检查
  if (!fragment || !Array.isArray(fragment)) {
    console.warn('[extractPlainText] fragment 不是数组', { fragment });
    return '';
  }
  
  return fragment.map(node => {
    if ('text' in node) return node.text;
    if (node.type === 'tag') return `#${node.tagName}`;
    if (node.type === 'dateMention') {
      const start = new Date(node.startDate);
      return formatDateForDisplay(start, node.endDate ? new Date(node.endDate) : null);
    }
    return '';
  }).join('');
}

/**
 * 提取标签
 */
function extractTags(fragment: (TextNode | TagNode | DateMentionNode)[]): string[] {
  // 🔧 安全检查
  if (!fragment || !Array.isArray(fragment)) {
    console.warn('[extractTags] fragment 不是数组', { fragment });
    return [];
  }
  
  return fragment
    .filter((node): node is TagNode => 'type' in node && node.type === 'tag' && !node.mentionOnly)
    .map(node => node.tagName);
}

/**
 * 格式化日期显示
 */
function formatDateForDisplay(start: Date, end: Date | null): string {
  const formatDate = (d: Date) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  };
  
  if (end && end.getTime() !== start.getTime()) {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }
  return formatDate(start);
}

// ==================== HTML 复制增强 ====================

/**
 * 将 Slate 节点转换为富文本 HTML（用于跨应用复制）
 */
export function slateNodesToRichHtml(nodes: EventLineNode[]): string {
  const eventLines = nodes;
  
  // 按 level 构建嵌套列表
  const html: string[] = ['<ul style="list-style-type: disc; padding-left: 20px;">'];
  
  eventLines.forEach(node => {
    if (node.type !== 'event-line') return;
    
    const indent = '  '.repeat(node.level);
    const content = slateFragmentToRichHtml(node.children[0].children);
    const style = node.mode === 'description' ? ' style="color: #666; font-size: 0.9em;"' : '';
    
    html.push(`${indent}<li${style}>${content}</li>`);
  });
  
  html.push('</ul>');
  
  return html.join('\n');
}

/**
 * 将 Slate fragment 转换为富文本 HTML
 */
function slateFragmentToRichHtml(fragment: (TextNode | TagNode | DateMentionNode)[]): string {
  return fragment.map(node => {
    if ('text' in node) {
      let text = node.text || '';
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      if (node.underline) text = `<u>${text}</u>`;
      if (node.strikethrough) text = `<s>${text}</s>`;
      if (node.color) text = `<span style="color: ${node.color}">${text}</span>`;
      return text;
    } else if (node.type === 'tag') {
      const emoji = node.tagEmoji ? node.tagEmoji + ' ' : '';
      return `<span style="display: inline-block; padding: 2px 6px; background: ${node.tagColor || '#e5e7eb'}; border-radius: 4px; font-size: 0.85em;">${emoji}#${node.tagName}</span>`;
    } else if (node.type === 'dateMention') {
      const start = new Date(node.startDate);
      const end = node.endDate ? new Date(node.endDate) : null;
      const dateText = formatDateForDisplay(start, end);
      return `<span style="display: inline-block; padding: 2px 6px; background: #dbeafe; border-radius: 4px; font-size: 0.85em;">📅 ${dateText}</span>`;
    }
    return '';
  }).join('');
}

// ==================== HTML 粘贴解析 ====================

/**
 * 从外部 HTML 解析为 Slate 节点（智能识别缩进和日期）
 */
export function parseExternalHtml(html: string): EventLineNode[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const nodes: EventLineNode[] = [];
  
  // 递归处理列表
  function processList(ul: HTMLElement, level: number = 0): void {
    const items = ul.querySelectorAll(':scope > li');
    items.forEach(li => {
      const content = li.innerHTML;
      const lineId = `line-${Date.now()}-${Math.random()}`;
      
      nodes.push({
        type: 'event-line',
        lineId,
        level,
        mode: 'title',
        children: [
          {
            type: 'paragraph',
            children: parseHtmlFragment(content),
          },
        ],
      });
      
      // 处理嵌套列表
      const nestedUl = li.querySelector(':scope > ul');
      if (nestedUl) {
        processList(nestedUl as HTMLElement, level + 1);
      }
    });
  }
  
  // 查找列表
  const ul = tempDiv.querySelector('ul');
  if (ul) {
    processList(ul);
  } else {
    // 没有列表，处理段落
    const paragraphs = tempDiv.querySelectorAll('p');
    if (paragraphs.length > 0) {
      paragraphs.forEach(p => {
        nodes.push({
          type: 'event-line',
          lineId: `line-${Date.now()}-${Math.random()}`,
          level: 0,
          mode: 'title',
          children: [
            {
              type: 'paragraph',
              children: parseHtmlFragment(p.innerHTML),
            },
          ],
        });
      });
    } else {
      // 纯文本
      nodes.push({
        type: 'event-line',
        lineId: `line-${Date.now()}-${Math.random()}`,
        level: 0,
        mode: 'title',
        children: [
          {
            type: 'paragraph',
            children: parseHtmlFragment(tempDiv.innerHTML),
          },
        ],
      });
    }
  }
  
  return nodes.length > 0 ? nodes : [createEmptyEventLine()];
}

/**
 * 解析 HTML fragment（保留格式，智能识别日期）
 */
function parseHtmlFragment(html: string): (TextNode | TagNode | DateMentionNode)[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const fragment: (TextNode | TagNode | DateMentionNode)[] = [];
  
  function processNode(node: Node, formats: Partial<TextNode> = {}): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        // 尝试智能识别日期
        const dateMatch = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
        if (dateMatch) {
          const beforeDate = text.substring(0, dateMatch.index);
          const dateStr = dateMatch[1];
          const afterDate = text.substring(dateMatch.index! + dateStr.length);
          
          if (beforeDate) fragment.push({ text: beforeDate, ...formats });
          
          fragment.push({
            type: 'dateMention',
            startDate: new Date(dateStr).toISOString(),
            children: [{ text: '' }],
          });
          
          if (afterDate) fragment.push({ text: afterDate, ...formats });
        } else {
          fragment.push({ text, ...formats });
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const newFormats = { ...formats };
      
      if (element.tagName === 'STRONG' || element.tagName === 'B') {
        newFormats.bold = true;
      } else if (element.tagName === 'EM' || element.tagName === 'I') {
        newFormats.italic = true;
      } else if (element.tagName === 'U') {
        newFormats.underline = true;
      } else if (element.tagName === 'S' || element.tagName === 'DEL') {
        newFormats.strikethrough = true;
      }
      
      element.childNodes.forEach(child => processNode(child, newFormats));
    }
  }
  
  tempDiv.childNodes.forEach(node => processNode(node));
  
  return fragment.length > 0 ? fragment : [{ text: '' }];
}
