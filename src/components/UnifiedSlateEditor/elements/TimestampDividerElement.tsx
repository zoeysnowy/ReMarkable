/**
 * TimestampDividerElement - 时间戳分隔线组件
 * TimelineEntryElement - 时间轴条目容器组件
 * 
 * 用于 EventLog 中显示编辑时间的分隔线和内容
 * 按照 TimeLog PRD 的样式规范渲染
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import React from 'react';
import { RenderElementProps } from 'slate-react';
import { TimestampDividerElement as TimestampDividerType, TimelineSegmentElement as TimelineSegmentType } from './types';


export const TimestampDividerElement: React.FC<RenderElementProps> = ({ attributes, children, element }) => {
  const node = element as TimestampDividerType;
  
  return (
    <div
      {...attributes}
      contentEditable={false}
      style={{
        position: 'relative',
        fontSize: '16px',
        color: '#e5e7eb',
        lineHeight: 1,
        margin: '0 0 8px 0',
        padding: '0 0 0 16px',
        fontFamily: "'Microsoft YaHei', Arial"
      }}
    >
      {/* 左侧 preline */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: '-8px',
        width: '2px',
        background: '#e5e7eb'
      }}></div>
      
      {node.displayText}
      {children}
    </div>
  );
};

// TimelineSegmentElement removed - using simpler timestamp approach to prevent path resolution issues
