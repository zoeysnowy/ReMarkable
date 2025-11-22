/**
 * StatusLineContainer - 竖线状态容器（多线并行版本）
 * 
 * 功能：
 * 1. 支持多条并行竖线（每行可能有多个不同状态的竖线）
 * 2. 自适应缩进（根据实际竖线数量动态调整内容缩进）
 * 3. 智能标签定位（每个状态只显示一次，优先放在最左侧位置）
 * 
 * 设计规则：
 * - 竖线宽度：2px（Figma规范）
 * - 竖线间距：5px
 * - 标签与竖线间距：8px
 */

import React, { useMemo } from 'react';
import './StatusLineContainer.css';

export interface StatusLineSegment {
  startIndex: number;
  endIndex: number;
  status: 'new' | 'updated' | 'done' | 'missed' | 'deleted';
  label: string;
}

interface StatusLineContainerProps {
  children: React.ReactNode;
  segments: StatusLineSegment[];
  lineHeight?: number; // 每行高度
  totalLines?: number; // 总行数
}

const LINE_WIDTH = 2; // 竖线宽度
const LINE_SPACING = 3; // 竖线间距
const LABEL_SPACING = 8; // 标签与竖线的间距
const BASE_LEFT = 5; // 基础左边距

export const StatusLineContainer: React.FC<StatusLineContainerProps> = ({ 
  children, 
  segments, 
  lineHeight = 32,
  totalLines = 0 
}) => {
  // 计算每一行的竖线列表（从左到右排序）
  const lineConfigs = useMemo(() => {
    const configs: Map<number, StatusLineSegment[]> = new Map();
    
    segments.forEach(segment => {
      for (let i = segment.startIndex; i <= segment.endIndex; i++) {
        if (!configs.has(i)) {
          configs.set(i, []);
        }
        configs.get(i)!.push(segment);
      }
    });
    
    return configs;
  }, [segments]);

  // 计算全局最大竖线数量（决定最大缩进）
  const maxLinesCount = useMemo(() => {
    let max = 0;
    lineConfigs.forEach(lines => {
      max = Math.max(max, lines.length);
    });
    return max;
  }, [lineConfigs]);

  // 为每个segment分配列位置（column index）
  const segmentColumns = useMemo(() => {
    const columnMap = new Map<StatusLineSegment, number>();
    const usedColumns = new Set<number>();
    
    // 按开始位置排序segments
    const sortedSegments = [...segments].sort((a, b) => a.startIndex - b.startIndex);
    
    sortedSegments.forEach(segment => {
      // 找到第一个可用的列
      let column = 0;
      const occupiedColumns = new Set<number>();
      
      // 检查与当前segment重叠的其他segments占用了哪些列
      sortedSegments.forEach(other => {
        if (other === segment) return;
        if (columnMap.has(other)) {
          // 检查是否重叠
          const overlaps = !(other.endIndex < segment.startIndex || other.startIndex > segment.endIndex);
          if (overlaps) {
            occupiedColumns.add(columnMap.get(other)!);
          }
        }
      });
      
      // 找到第一个未被占用的列
      while (occupiedColumns.has(column)) {
        column++;
      }
      
      columnMap.set(segment, column);
    });
    
    return columnMap;
  }, [segments]);

  // 计算标签的最大宽度
  const maxLabelWidth = useMemo(() => {
    if (segments.length === 0) return 0;
    // 估算每个标签的宽度（每个字符约7px，斜体加点额外空间）
    const labelWidths = segments.map(seg => seg.label.length * 7 + 4);
    return Math.max(...labelWidths);
  }, [segments]);

  // 计算每个segment的渲染信息
  const renderedSegments = useMemo(() => {
    return segments.map(segment => {
      const column = segmentColumns.get(segment) || 0;
      // 竖线位置 = BASE_LEFT + 标签最大宽度 + 间距 + column×(竖线宽度+间距)
      const left = BASE_LEFT + maxLabelWidth + LABEL_SPACING + column * (LINE_WIDTH + LINE_SPACING);
      const top = segment.startIndex * lineHeight;
      const height = (segment.endIndex - segment.startIndex + 1) * lineHeight;
      
      return {
        ...segment,
        column,
        left,
        top,
        height
      };
    });
  }, [segments, segmentColumns, lineHeight, maxLabelWidth]);

  // 计算智能标签位置
  const smartLabels = useMemo(() => {
    const labels: Array<{
      status: string;
      label: string;
      left: number;
      top: number;
      isLeftmost: boolean;
    }> = [];
    
    const seenStatuses = new Map<string, boolean>();
    
    // 按column和startIndex排序，优先处理最左侧和最早出现的
    const sortedSegments = [...renderedSegments].sort((a, b) => {
      if (a.column !== b.column) return a.column - b.column;
      return a.startIndex - b.startIndex;
    });
    
    sortedSegments.forEach(segment => {
      if (!seenStatuses.has(segment.status)) {
        seenStatuses.set(segment.status, segment.column === 0);
        
        // 标签从BASE_LEFT开始
        const centerLine = segment.startIndex;
        const top = centerLine * lineHeight + lineHeight / 2;
        const left = BASE_LEFT; // 从BASE_LEFT开始
        
        labels.push({
          status: segment.status,
          label: segment.label,
          left,
          top,
          isLeftmost: segment.column === 0
        });
      }
    });
    
    // 非最左侧的标签需要堆叠在最左侧标签下方
    const leftmostLabels = labels.filter(l => l.isLeftmost);
    const otherLabels = labels.filter(l => !l.isLeftmost);
    
    otherLabels.forEach((label, index) => {
      // 堆叠在第一个最左侧标签下方
      if (leftmostLabels.length > 0) {
        label.left = leftmostLabels[0].left;
        label.top = leftmostLabels[0].top + (index + 1) * 16; // 16px行高
      }
    });
    
    return labels;
  }, [renderedSegments, lineHeight]);

  // 动态计算竖线区域的实际宽度
  const lineAreaWidth = useMemo(() => {
    if (maxLinesCount === 0) return 0;
    // 竖线区域宽度 = 竖线数量 × 宽度 + (竖线数量-1) × 间距
    return maxLinesCount * LINE_WIDTH + (maxLinesCount - 1) * LINE_SPACING;
  }, [maxLinesCount]);

  // 计算内容区域的缩进
  const contentPaddingLeft = useMemo(() => {
    if (maxLinesCount === 0) return 0;
    // 缩进 = BASE_LEFT + 标签最大宽度 + 间距 + 竖线区域宽度 + 间距
    return BASE_LEFT + maxLabelWidth + LABEL_SPACING + lineAreaWidth + LABEL_SPACING;
  }, [maxLabelWidth, lineAreaWidth]);

  return (
    <div className="status-line-container">
      {/* 竖线层 */}
      <div className="status-line-layer">
        {renderedSegments.map((segment, index) => (
          <div
            key={index}
            className={`status-line ${segment.status}`}
            style={{
              left: segment.left,
              top: segment.top,
              height: segment.height,
              width: LINE_WIDTH
            }}
          />
        ))}
      </div>

      {/* 标签层 */}
      <div className="status-label-layer">
        {smartLabels.map((label, index) => (
          <div
            key={index}
            className={`status-label ${label.status}`}
            style={{
              left: label.left,
              top: label.top,
            }}
          >
            {label.label}
          </div>
        ))}
      </div>

      {/* 内容层 - 自适应缩进 */}
      <div 
        className="status-line-content"
        style={{
          paddingLeft: contentPaddingLeft
        }}
      >
        {children}
      </div>
    </div>
  );
};