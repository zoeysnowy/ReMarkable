/**
 * EventLineElement - EventLine 节点的渲染器
 * 
 * 支持缩进、前缀装饰、Description 样式
 */

import React from 'react';
import { RenderElementProps } from 'slate-react';
import { EventLineNode } from './types';
import { EventLinePrefix } from './EventLinePrefix';
import { EventLineSuffix } from './EventLineSuffix';
import './EventLineElement.css';

export interface EventLineElementProps {
  element: EventLineNode;
  attributes: any;
  children: React.ReactNode;
  onSave?: (eventId: string, updates: any) => void;  // 保存回调
  onTimeClick?: (eventId: string, anchor: HTMLElement) => void;  // 时间点击
  onMoreClick?: (eventId: string) => void;  // More 图标点击
  onPlaceholderClick?: () => void; // 🆕 Placeholder 点击回调
}

export const EventLineElement: React.FC<EventLineElementProps> = ({
  element,
  attributes,
  children,
  onSave,
  onTimeClick,
  onMoreClick,
  onPlaceholderClick,
}) => {
  const isEventlogMode = element.mode === 'eventlog';
  const isPlaceholder = (element.metadata as any)?.isPlaceholder || element.eventId === '__placeholder__';
  
  const paddingLeft = isEventlogMode
    ? `${(element.level + 1) * 24}px`
    : `${element.level * 24}px`;
  
  // 🆕 处理 placeholder 点击
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPlaceholder && onPlaceholderClick) {
      e.preventDefault();
      e.stopPropagation();
      onPlaceholderClick();
    }
  };
  
  return (
    <div
      {...attributes}
      className={`unified-event-line ${isEventlogMode ? 'eventlog-mode' : ''}${isPlaceholder ? ' placeholder-line' : ''}`}
      data-line-id={element.lineId}
      data-event-id={element.eventId || ''}
      data-level={element.level}
      data-mode={element.mode}
      onMouseDown={handleMouseDown}
      style={{
        paddingLeft,
        display: 'flex',
        alignItems: isEventlogMode ? 'flex-start' : 'center',
        gap: '8px',
        minHeight: isEventlogMode ? '20px' : '32px', // 🔧 eventlog 模式更紧凑
      }}
    >
      {/* 前缀装饰 (Checkbox、Emoji 等) - Eventlog 模式不显示 */}
      {!isEventlogMode && onSave && (
        <div className="event-line-prefix" contentEditable={false}>
          <EventLinePrefix element={element} onSave={onSave} />
        </div>
      )}
      
      {/* 内容区域 - Placeholder 行显示为灰色但可点击 */}
      <div 
        className="event-line-content" 
        style={{ 
          flex: 1,
          cursor: isPlaceholder ? 'text' : 'inherit',
          userSelect: isPlaceholder ? 'none' : 'auto',
        }}
      >
        {children}
      </div>
      
      {/* 后缀装饰 (标签、时间等) - Eventlog 模式不显示 */}
      {!isEventlogMode && onTimeClick && onMoreClick && (
        <div className="event-line-suffix" contentEditable={false}>
          <EventLineSuffix element={element} onTimeClick={onTimeClick} onMoreClick={onMoreClick} />
        </div>
      )}
    </div>
  );
};
