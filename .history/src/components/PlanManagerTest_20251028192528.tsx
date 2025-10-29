/**
 * PlanManager 测试版 - 使用 FreeFormEditor
 */

import React, { useState, useMemo } from 'react';
import { FreeFormEditor, FreeFormLine } from './MultiLineEditor/FreeFormEditor';
import { PlanItem } from './PlanManager';

interface PlanManagerTestProps {
  items: PlanItem[];
  onSave: (item: PlanItem) => void;
  onDelete: (id: string) => void;
}

export const PlanManagerTest: React.FC<PlanManagerTestProps> = ({
  items,
  onSave,
  onDelete,
}) => {
  // 将 PlanItem[] 转换为 FreeFormLine<PlanItem>[]
  const lines = useMemo<FreeFormLine<PlanItem>[]>(() => {
    return items.map((item, index) => ({
      id: item.id,
      content: item.title,
      level: 0,
      data: item,
    }));
  }, [items]);

  // 处理行变化
  const handleLinesChange = (newLines: FreeFormLine<PlanItem>[]) => {
    newLines.forEach((line) => {
      if (line.data) {
        const updatedItem = { ...line.data, title: line.content };
        onSave(updatedItem);
      } else {
        // 创建新项目
        const newItem: PlanItem = {
          id: line.id,
          title: line.content,
          tags: [],
          priority: 'medium',
          isCompleted: false,
          type: 'todo',
        };
        onSave(newItem);
      }
    });
  };

  // 渲染 Checkbox
  const renderLinePrefix = (line: FreeFormLine<PlanItem>) => {
    if (!line.data) return null;
    
    return (
      <input
        type="checkbox"
        checked={line.data.isCompleted || false}
        onChange={(e) => {
          if (line.data) {
            onSave({ ...line.data, isCompleted: e.target.checked });
          }
        }}
        style={{
          cursor: 'pointer',
          width: '18px',
          height: '18px',
        }}
      />
    );
  };

  // 渲染标签和颜色
  const renderLineSuffix = (line: FreeFormLine<PlanItem>) => {
    if (!line.data) return null;
    
    const { color, priority } = line.data;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* 优先级指示器 */}
        {priority && (
          <span
            style={{
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor:
                priority === 'urgent'
                  ? '#ef4444'
                  : priority === 'high'
                  ? '#f59e0b'
                  : priority === 'medium'
                  ? '#3b82f6'
                  : '#6b7280',
              color: 'white',
            }}
          >
            {priority}
          </span>
        )}
        
        {/* 颜色条 */}
        {color && (
          <div
            style={{
              width: '4px',
              height: '24px',
              borderRadius: '2px',
              backgroundColor: color,
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', backgroundColor: 'white' }}>
      <h2>PlanManager 测试 (FreeFormEditor)</h2>
      <FreeFormEditor
        lines={lines}
        onLinesChange={handleLinesChange}
        renderLinePrefix={renderLinePrefix}
        renderLineSuffix={renderLineSuffix}
        placeholder="✨ 点击创建新任务，按 Enter 快速创建，Tab 调整层级，↑↓ 导航"
      />
    </div>
  );
};
