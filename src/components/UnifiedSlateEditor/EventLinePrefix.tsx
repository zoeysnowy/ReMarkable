/**
 * EventLinePrefix - 事件行前缀渲染器
 * 
 * 根据Figma设计稿实现统一缩进的竖线布局
 * 竖线由容器统一渲染，此组件只处理缩进和标签
 * 布局：统一缩进的 Checkbox + Emoji + 状态标签
 */

import React, { useEffect, useState } from 'react';
import { useSlateStatic, ReactEditor } from 'slate-react';
import { Transforms, Editor } from 'slate';
import { EventLineNode } from './types';
import { EventService } from '../../services/EventService';
import { formatTimeForStorage } from '../../utils/timeUtils';

export interface EventLinePrefixProps {
  element: EventLineNode;
  onSave: (eventId: string, updates: Partial<any>) => void;
  eventStatus?: 'new' | 'updated' | 'done' | 'missed' | 'deleted'; // 🆕 事件状态
}

const EventLinePrefixComponent: React.FC<EventLinePrefixProps> = ({ element, onSave, eventStatus }) => {
  const editor = useSlateStatic();
  const metadata = element.metadata || {};
  
  // ✅ 直接从 metadata 计算 checked 状态，不调用 EventService
  const lastChecked = metadata.checked && metadata.checked.length > 0 
    ? metadata.checked[metadata.checked.length - 1] 
    : null;
  const lastUnchecked = metadata.unchecked && metadata.unchecked.length > 0 
    ? metadata.unchecked[metadata.unchecked.length - 1] 
    : null;
  
  // 比较最后的时间戳
  const isCompleted = lastChecked && (!lastUnchecked || lastChecked > lastUnchecked);
  
  // 🆕 根据 checkType 判断是否显示 checkbox
  const checkType = metadata.checkType;
  const showCheckbox = checkType === 'once' || checkType === 'recurring';
  
  console.log('🔍 [EventLinePrefix] Render:', {
    eventId: element.eventId?.slice(-10),
    hasMetadata: !!element.metadata,
    metadataKeys: element.metadata ? Object.keys(element.metadata) : [],
    checkType,
    showCheckbox,
    isCompleted
  });
  
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {/* Checkbox - 根据 checkType 决定是否显示 */}
      {showCheckbox && (
        <input
          type="checkbox"
          checked={!!isCompleted}
          onChange={(e) => {
            e.stopPropagation();
            const isChecked = e.target.checked;
            
            console.log('[EventLinePrefix] Checkbox clicked:', {
              eventId: element.eventId,
              isChecked,
              checkType: metadata.checkType
            });
            
            // ✅ 1. 立即更新 Slate element 的 metadata（乐观更新）
            const timestamp = formatTimeForStorage(new Date());
            const updatedMetadata = {
              ...metadata,
              checked: isChecked ? [...(metadata.checked || []), timestamp] : metadata.checked,
              unchecked: !isChecked ? [...(metadata.unchecked || []), timestamp] : metadata.unchecked
            };
            
            // 🔥 直接更新 Slate element - 立即触发重新渲染
            try {
              const path = ReactEditor.findPath(editor, element);
              Transforms.setNodes(editor, { metadata: updatedMetadata } as any, { at: path });
              console.log('[EventLinePrefix] ✅ Slate element updated:', { path, updatedMetadata });
            } catch (err) {
              console.error('[EventLinePrefix] ❌ Failed to update Slate element:', err);
            }
            
            // ✅ 2. 调用 EventService 持久化到 localStorage（会自动触发 eventsUpdated）
            if (isChecked) {
              EventService.checkIn(element.eventId);
            } else {
              EventService.uncheck(element.eventId);
            }
            
            // 🔧 注意：不再调用 onSave，因为 EventService.checkIn/uncheck 已经触发了 eventsUpdated 事件
            // UnifiedSlateEditor 的监听器会自动同步最新的 checked/unchecked 数组
          }}
          style={{
            cursor: 'pointer',
            opacity: 1,
            marginRight: '4px',
          }}
        />
      )}
      
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
  
  // ✅ 比较 check-in 状态而不是 isCompleted
  const prevChecked = EventService.getCheckInStatus(prevProps.element.eventId).isChecked;
  const nextChecked = EventService.getCheckInStatus(nextProps.element.eventId).isChecked;
  
  return prevChecked === nextChecked &&
         prevMetadata.emoji === nextMetadata.emoji &&
         prevProps.eventStatus === nextProps.eventStatus;
});
