/**
 * EventLinePrefix - 事件行前缀渲染器
 * 
 * 根据Figma设计稿实现类似Word修订模式的竖线显示
 * 布局：状态标签 + 竖线 + Checkbox + Emoji
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

  // 🆕 状态配置映射 (根据用户要求的颜色方案)
  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'new':
        return {
          color: '#3B82F6', // 蓝色 - New
          label: 'New',
          labelColor: '#1E40AF'
        };
      case 'done':
        return {
          color: '#10B981', // 绿色 - Done
          label: 'Done', 
          labelColor: '#059669'
        };
      case 'updated':
        return {
          color: '#F59E0B', // 黄色 - Updated
          label: 'Updated',
          labelColor: '#D97706'
        };
      case 'missed':
        return {
          color: '#EF4444', // 红色 - Missed
          label: 'Missed',
          labelColor: '#DC2626'
        };
      case 'deleted':
        return {
          color: '#9CA3AF', // 灰色 - Del
          label: 'Del',
          labelColor: '#6B7280'
        };
      default:
        return null;
    }
  };

  const statusConfig = getStatusConfig(eventStatus);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
      {/* 🆕 状态标签 + 竖线组合 (Word修订模式风格) */}
      {statusConfig && (
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          {/* 状态标签 */}
          <div
            style={{
              position: 'absolute',
              left: '-45px', // 标签位于竖线左侧
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              fontWeight: '600',
              fontStyle: 'italic',
              color: statusConfig.labelColor,
              fontFamily: 'Roboto, sans-serif',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}
          >
            {statusConfig.label}
          </div>
          
          {/* 状态竖线 */}
          <div
            style={{
              width: '3px',
              height: '20px',
              backgroundColor: statusConfig.color,
              borderRadius: '1.5px',
              flexShrink: 0,
              marginRight: '6px',
            }}
          />
        </div>
      )}
      
      {/* Checkbox */}
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
          marginRight: '4px',
        }}
      />
      
      {/* Emoji */}
      {emoji && (
        <span style={{ 
          fontSize: '16px', 
          lineHeight: '1',
          marginRight: '4px'
        }}>
          {emoji}
        </span>
      )}
    </div>
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
