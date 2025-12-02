/**
 * 🎯 CustomEventNode - React Flow 自定义事件节点
 * 
 * EventTree 的核心节点组件，集成双向链接堆叠卡片。
 * 
 * 架构：
 * - 刚性骨架（Rigid Bone）：parentEventId/childEventIds 占据画布空间，显示为 line + link 标记
 * - 柔性血管（Flexible Vessels）：linkedEventIds 堆叠在背后，悬停时扇形展开
 * 
 * 特性：
 * - 主节点：Emoji + 标题 + Checkbox（Task） + 链接指示器
 * - 堆叠卡片：鼠标悬停时从收纳态 → 展开态
 * - 系统事件过滤：不显示 isTimer/isOutsideApp/isTimeLog 事件
 */

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Event } from '../../types';
import { LinkedCard } from './LinkedCard';
import './EventTree.css';

export interface EventNodeData {
  event: Event;                  // 主事件数据
  linkedEvents: Event[];         // 双向链接的事件（linkedEventIds + backlinks）
  onEventClick?: (event: Event) => void;  // 点击事件回调
  onCheckboxChange?: (event: Event, isCompleted: boolean) => void;  // Checkbox 回调
}

export const CustomEventNode: React.FC<NodeProps<EventNodeData>> = ({ data }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // 阻止触发节点点击
    if (data.onCheckboxChange) {
      data.onCheckboxChange(data.event, e.target.checked);
    }
  }, [data]);

  const handleNodeClick = useCallback(() => {
    if (data.onEventClick) {
      data.onEventClick(data.event);
    }
  }, [data]);

  const handleLinkedCardClick = useCallback((linkedEvent: Event) => {
    if (data.onEventClick) {
      data.onEventClick(linkedEvent);
    }
  }, [data]);

  return (
    <div
      className="custom-event-node"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* React Flow 连接点（用于父子关系） */}
      <Handle
        type="target"
        position={Position.Top}
        className="event-node-handle"
      />

      {/* 堆叠的双向链接卡片（绝对定位，藏在主节点后） */}
      {data.linkedEvents.length > 0 && (
        <div className="linked-cards-container">
          {data.linkedEvents.map((linkedEvent, index) => (
            <LinkedCard
              key={linkedEvent.id}
              event={linkedEvent}
              index={index}
              isHovered={isHovered}
              onClick={() => handleLinkedCardClick(linkedEvent)}
            />
          ))}
        </div>
      )}

      {/* 主节点内容 */}
      <div
        className="event-node-content"
        onClick={handleNodeClick}
      >
        {/* Checkbox（仅 Task 显示） */}
        {data.event.isTask && (
          <input
            type="checkbox"
            className="event-node-checkbox"
            checked={data.event.isCompleted || false}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Emoji */}
        {data.event.emoji && (
          <span className="event-node-emoji">{data.event.emoji}</span>
        )}

        {/* 标题 */}
        <span className="event-node-title">
          {typeof data.event.title === 'string' ? data.event.title : (data.event.title?.simpleTitle || data.event.title?.colorTitle || data.event.title?.fullTitle || '无标题事件')}
        </span>

        {/* 链接指示器（收纳态显示数量） */}
        {data.linkedEvents.length > 0 && (
          <div
            className="event-node-link-indicator"
            style={{
              opacity: isHovered ? 0 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 6.5L7 4.5M3.5 9L5.5 7M8.5 3L6.5 5" />
              <circle cx="2.5" cy="9.5" r="1.5" />
              <circle cx="9.5" cy="2.5" r="1.5" />
            </svg>
            <span>{data.linkedEvents.length}</span>
          </div>
        )}
      </div>

      {/* React Flow 连接点（用于父子关系） */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="event-node-handle"
      />
    </div>
  );
};
