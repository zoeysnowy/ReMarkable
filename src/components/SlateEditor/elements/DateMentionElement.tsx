/**
 * Date Mention 元素组件
 * 
 * 渲染日期提及节点
 * v2.0: 支持 TimeHub 实时同步
 * v2.1: 使用统一的智能相对日期格式化引擎
 * v2.2: 支持点击编辑时间（通过 TimeHub 提交修改）
 */

import React, { useMemo, useState, useRef } from 'react';
import { RenderElementProps, useSelected, useFocused } from 'slate-react';
import { DateMentionElement } from '../types';
import { useEventTime } from '../../../hooks/useEventTime';
import { formatRelativeDate } from '../../../utils/relativeDateFormatter';

export const DateMentionElementComponent: React.FC<RenderElementProps> = ({ attributes, children, element }) => {
  const dateMentionElement = element as DateMentionElement;
  const selected = useSelected();
  const focused = useFocused();
  const [showPicker, setShowPicker] = useState(false);
  const spanRef = useRef<HTMLSpanElement>(null);
  
  // 🆕 尝试从 element 中获取 eventId（UnifiedSlateEditor 的 DateMentionNode 类型）
  const eventId = (element as any).eventId;
  
  // 🆕 使用 TimeHub 订阅实时时间
  const { timeSpec, start, end, loading, setEventTime } = useEventTime(eventId);
  
  // 🆕 显示逻辑：优先使用 TimeHub 的时间，否则回退到 element.date
  const displayText = useMemo(() => {
    console.log(`%c[🎨 DateMentionElement 重新计算 displayText]`, 'background: #4CAF50; color: white; padding: 2px 6px;', {
      eventId,
      'TimeHub.start': start,
      'TimeHub.end': end,
      'element.startDate': (element as any).startDate,
      'element.endDate': (element as any).endDate,
      渲染时间: new Date().toLocaleTimeString()
    });
    
    // 如果有 TimeHub 的时间数据，使用 TimeHub
    if (start) {
      const startText = formatRelativeDate(new Date(start));
      if (end && end !== start) {
        const endText = formatRelativeDate(new Date(end));
        return `${startText} - ${endText}`;
      }
      return startText;
    }
    
    // 否则使用 element 自带的数据
    if ((element as any).startDate) {
      // UnifiedSlateEditor 的 DateMentionNode
      const startText = formatRelativeDate(new Date((element as any).startDate));
      if ((element as any).endDate) {
        const endText = formatRelativeDate(new Date((element as any).endDate));
        return `${startText} - ${endText}`;
      }
      return startText;
    }
    
    // 旧的 SlateEditor 格式
    return dateMentionElement.displayText || formatRelativeDate(new Date(dateMentionElement.date));
  }, [start, end, element, dateMentionElement, eventId]);

  // 🆕 点击处理：可以通过 setEventTime 向 TimeHub 提交时间修改
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!eventId) {
      console.warn('[DateMentionElement] 无法编辑：缺少 eventId');
      return;
    }
    
    console.log('[DateMentionElement] 点击日期，可以调用 setEventTime 修改时间', {
      eventId,
      currentStart: start,
      currentEnd: end,
      setEventTime: typeof setEventTime,
    });
    
    // TODO: 这里可以打开一个日期选择器，用户选择后调用 setEventTime({ start, end, ... })
    // 示例: await setEventTime({ start: '2025-11-20T14:00:00', end: '2025-11-20T15:00:00' });
  };

  return (
    <span
      {...attributes}
      ref={spanRef}
      contentEditable={false}
      data-type="date-mention"
      data-date={dateMentionElement.date || (element as any).startDate}
      data-event-id={eventId}
      className={`date-mention ${selected && focused ? 'selected' : ''}`}
      onClick={eventId ? handleClick : undefined}
      style={{
        display: 'inline',
        margin: '0 2px',
        padding: '2px 6px',
        borderRadius: '4px',
        backgroundColor: start ? '#e8f5e9' : '#e3f2fd', // TimeHub 数据用绿色
        border: start ? '1px solid #66bb6a' : '1px solid #90caf9',
        color: start ? '#2e7d32' : '#1976d2',
        fontSize: '0.9em',
        fontWeight: 500,
        userSelect: 'none',
        cursor: eventId ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
    >
      📅 {displayText}
      {children}
    </span>
  );
};
