/**
 * EventLinePrefix - 事件行前缀渲染器
 * 
 * 渲染 Checkbox + Emoji
 */

import React from 'react';
import { EventLineNode } from './types';
import { EventService } from '../../services/EventService';

export interface EventLinePrefixProps {
  element: EventLineNode;
  onSave: (eventId: string, updates: Partial<any>) => void;
  eventStatus?: 'new' | 'updated' | 'done' | 'missed' | 'deleted'; // 🆕 事件状态
}

const EventLinePrefixComponent: React.FC<EventLinePrefixProps> = ({ element, onSave, eventStatus }) => {
  const metadata = element.metadata || {};
  const isCompleted = metadata.isCompleted || false;
  const emoji = metadata.emoji;

  // 🆕 状态竖线颜色映射
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'new':
        return 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)';
      case 'updated':
        return 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)';
      case 'done':
        return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      case 'missed':
        return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      case 'deleted':
        return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      default:
        return 'transparent';
    }
  };

  return (
    <>
      {/* 🆕 状态竖线 */}
      {eventStatus && (
        <div
          className="event-status-bar"
          style={{
            width: '3px',
            height: '20px',
            background: getStatusColor(eventStatus),
            borderRadius: '1.5px',
            flexShrink: 0,
            marginRight: '4px',
          }}
        />
      )}
      
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={(e) => {
          e.stopPropagation();
          const isChecked = e.target.checked;
          
          // 更新 isCompleted 状态
          onSave(element.eventId, { isCompleted: isChecked });
          
          // 同时处理签到逻辑
          if (isChecked) {
            EventService.checkIn(element.eventId);
          } else {
            EventService.uncheck(element.eventId);
          }
        }}
        style={{
          cursor: 'pointer',
          opacity: 1,
        }}
      />
      {emoji && <span style={{ fontSize: '16px', lineHeight: '1' }}>{emoji}</span>}
    </>
  );
};

export const EventLinePrefix = React.memo(EventLinePrefixComponent, (prevProps, nextProps) => {
  // 只在关键属性变化时才重新渲染
  const prevMetadata = prevProps.element.metadata || {};
  const nextMetadata = nextProps.element.metadata || {};
  return prevMetadata.isCompleted === nextMetadata.isCompleted &&
         prevMetadata.emoji === nextMetadata.emoji &&
         prevProps.eventStatus === nextProps.eventStatus;
});
