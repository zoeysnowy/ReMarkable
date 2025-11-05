/**
 * EventLineElement - EventLine 节点的渲染器
 * 
 * 支持缩进、前缀装饰、Description 样式
 */

import React from 'react';
import { RenderElementProps } from 'slate-react';
import { EventLineNode } from './types';
import './EventLineElement.css';

export interface EventLineElementProps extends RenderElementProps {
  element: EventLineNode;
  renderPrefix?: (element: EventLineNode) => React.ReactNode;
  renderSuffix?: (element: EventLineNode) => React.ReactNode;
}

export const EventLineElement: React.FC<EventLineElementProps> = ({
  element,
  attributes,
  children,
  renderPrefix,
  renderSuffix,
}) => {
  const isDescriptionMode = element.mode === 'description';
  
  const paddingLeft = isDescriptionMode
    ? `${(element.level + 1) * 24}px`
    : `${element.level * 24}px`;
  
  return (
    <div
      {...attributes}
      className={`unified-event-line${isDescriptionMode ? ' description-mode' : ''}`}
      data-line-id={element.lineId}
      data-event-id={element.eventId || ''}
      data-level={element.level}
      data-mode={element.mode}
      style={{
        paddingLeft,
        display: 'flex',
        alignItems: isDescriptionMode ? 'flex-start' : 'center',
        gap: '8px',
        minHeight: '32px',
      }}
    >
      {/* 前缀装饰 (Checkbox、Emoji 等) - Description 模式不显示 */}
      {renderPrefix && !isDescriptionMode && (
        <div className="event-line-prefix" contentEditable={false}>
          {renderPrefix(element)}
        </div>
      )}
      
      {/* 内容区域 */}
      <div className="event-line-content" style={{ flex: 1 }}>
        {children}
      </div>
      
      {/* 后缀装饰 (标签、时间等) - Description 模式不显示 */}
      {renderSuffix && !isDescriptionMode && (
        <div className="event-line-suffix" contentEditable={false}>
          {renderSuffix(element)}
        </div>
      )}
    </div>
  );
};
