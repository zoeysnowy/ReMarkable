/**
 * EventLinePrefix - 事件行前缀渲染器
 * 
 * 渲染 Checkbox + Emoji
 */

import React from 'react';
import { EventLineNode } from './types';

export interface EventLinePrefixProps {
  element: EventLineNode;
  onSave: (eventId: string, updates: Partial<any>) => void;
}

export const EventLinePrefix: React.FC<EventLinePrefixProps> = React.memo(({ element, onSave }) => {
  const metadata = element.metadata || {};
  const isCompleted = metadata.isCompleted || false;
  const emoji = metadata.emoji;

  return (
    <>
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={(e) => {
          e.stopPropagation();
          onSave(element.eventId, { isCompleted: e.target.checked });
        }}
        style={{
          cursor: 'pointer',
          opacity: 1,
        }}
      />
      {emoji && <span style={{ fontSize: '16px', lineHeight: '1' }}>{emoji}</span>}
    </>
  );
}, (prevProps, nextProps) => {
  // 只在关键属性变化时才重新渲染
  const prevMetadata = prevProps.element.metadata || {};
  const nextMetadata = nextProps.element.metadata || {};
  return prevMetadata.isCompleted === nextMetadata.isCompleted &&
         prevMetadata.emoji === nextMetadata.emoji;
});
