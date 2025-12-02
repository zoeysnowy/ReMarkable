/**
 * 🔗 LinkedCard - 双向链接堆叠卡片
 * 
 * 受 Gemini 的 "Vessels as Stacks" 启发，事件的双向链接（linkedEventIds）
 * 以堆叠卡片的形式展示在主节点背后。
 * 
 * 特性：
 * - 收纳态：卡片缩放、旋转、堆叠，像一叠整理好的文件
 * - 展开态：鼠标悬停时扇形滑出（Fan-out），横向平铺
 * - Framer Motion 动画：流畅的 spring 弹簧动画
 * - 点击跳转：点击卡片打开对应事件的 EventEditModal
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Event } from '../../types';
import './EventTree.css';

interface LinkedCardProps {
  event: Event;           // 链接的事件数据
  index: number;          // 在堆叠中的索引（0 = 最靠近主节点）
  isHovered: boolean;     // 主节点是否被悬停
  onClick?: () => void;   // 点击回调（打开 EventEditModal）
}

export const LinkedCard: React.FC<LinkedCardProps> = ({
  event,
  index,
  isHovered,
  onClick,
}) => {
  // 🎨 动画参数计算
  // 收纳态：卡片堆叠在主节点背后，每张卡片略微偏移、旋转、缩放
  // 展开态：卡片横向扇形展开，间隔 180px
  const xOffset = isHovered ? (index + 1) * 180 : (index + 1) * 4;
  const yOffset = isHovered ? 0 : (index + 1) * 4;
  const rotate = isHovered ? 0 : (index + 1) * 2;
  const scale = isHovered ? 1 : 1 - (index * 0.05);
  const opacity = isHovered ? 1 : 1 - (index * 0.15);

  return (
    <motion.div
      className="linked-card"
      animate={{
        x: xOffset,
        y: yOffset,
        rotate,
        scale,
        opacity,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
      }}
      onClick={onClick}
      style={{
        pointerEvents: isHovered ? 'auto' : 'none', // 收纳态不可点击
      }}
    >
      {/* 卡片头部：链接图标 + LINKED 标签 */}
      <div className="linked-card-header">
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
        <span className="text-xs font-bold opacity-70">LINKED</span>
      </div>

      {/* 卡片内容：事件标题 */}
      <div className="linked-card-content">
        {event.emoji && (
          <span className="text-base mr-1.5">{event.emoji}</span>
        )}
        <h4 className="linked-card-title">
          {typeof event.title === 'string' ? event.title : (event.title?.simpleTitle || event.title?.colorTitle || event.title?.fullTitle || '无标题事件')}
        </h4>
      </div>

      {/* 卡片底部：时间显示（可选） */}
      {event.startTime && (
        <div className="linked-card-footer">
          <span className="text-xs opacity-50">
            {new Date(event.startTime).toLocaleString('zh-CN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}
    </motion.div>
  );
};
