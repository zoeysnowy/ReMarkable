/**
 * 🌲 EventTreeViewer - 事件树查看器
 * 
 * 双模式支持：
 * 1. 可视化模式（默认）：React Flow + 堆叠卡片
 * 2. 编辑模式：Slate 编辑器 + bullet list
 * 
 * 用户可以通过切换按钮在两种模式间切换
 */

import React, { useState } from 'react';
import { EventTreeCanvas } from './EventTreeCanvas';
import { EditableEventTree } from './EditableEventTree';
import { Event } from '../../types';
import './EventTreeViewer.css';

interface EventTreeViewerProps {
  rootEventId: string;
  events: Event[];
  onEventClick?: (event: Event) => void;
  defaultMode?: 'visual' | 'edit';
}

export const EventTreeViewer: React.FC<EventTreeViewerProps> = ({
  rootEventId,
  events,
  onEventClick,
  defaultMode = 'visual',
}) => {
  const [mode, setMode] = useState<'visual' | 'edit'>(defaultMode);

  return (
    <div className="event-tree-viewer">
      {/* 模式切换按钮 */}
      <div className="mode-switcher">
        <button
          className={`mode-btn ${mode === 'visual' ? 'active' : ''}`}
          onClick={() => setMode('visual')}
          title="可视化模式（React Flow）"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="4" cy="4" r="2" />
            <circle cx="12" cy="4" r="2" />
            <circle cx="8" cy="12" r="2" />
            <line x1="4" y1="6" x2="8" y2="10" />
            <line x1="12" y1="6" x2="8" y2="10" />
          </svg>
          <span>可视化</span>
        </button>

        <button
          className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
          onClick={() => setMode('edit')}
          title="编辑模式（列表编辑）"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="4" x2="13" y2="4" />
            <line x1="5" y1="8" x2="13" y2="8" />
            <line x1="7" y1="12" x2="13" y2="12" />
            <circle cx="3" cy="4" r="1" fill="currentColor" />
            <circle cx="5" cy="8" r="1" fill="currentColor" />
            <circle cx="7" cy="12" r="1" fill="currentColor" />
          </svg>
          <span>编辑</span>
        </button>
      </div>

      {/* 内容区域 */}
      <div className="tree-content">
        {mode === 'visual' ? (
          <EventTreeCanvas
            rootEventId={rootEventId}
            events={events}
            onEventClick={onEventClick}
          />
        ) : (
          <EditableEventTree
            rootEventId={rootEventId}
            onEventClick={onEventClick}
          />
        )}
      </div>
    </div>
  );
};
