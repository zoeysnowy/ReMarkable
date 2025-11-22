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

import React, { useMemo, useEffect, useState, useRef } from 'react';
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
  editorItems: any[]; // 事件列表，用于根据 index 查找事件
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
  editorItems,
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
  // ✅ 优化：相同状态的连续segment使用相同列，实现竖线连续性
  const segmentColumns = useMemo(() => {
    const columnMap = new Map<StatusLineSegment, number>();
    
    // 按开始位置排序segments
    const sortedSegments = [...segments].sort((a, b) => a.startIndex - b.startIndex);
    
    // 记录每个status在每一行的列位置：Map<lineIndex, Map<status, column>>
    const statusColumnsAtLine = new Map<number, Map<string, number>>();
    
    sortedSegments.forEach(segment => {
      const { startIndex, status } = segment;
      
      // 检查上一行（startIndex - 1）是否有相同的status
      const prevLineColumns = statusColumnsAtLine.get(startIndex - 1);
      let column: number | undefined;
      
      if (prevLineColumns && prevLineColumns.has(status)) {
        // ✅ 上一行有相同status，继承相同列
        column = prevLineColumns.get(status)!;
        console.log(`[StatusLineContainer] 🔗 Status "${status}" at line ${startIndex}: 继承上一行的列 ${column}`);
      } else {
        // 找到当前行所有已占用的列
        const occupiedColumns = new Set<number>();
        
        // 查找与当前segment重叠的其他segments占用的列
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
        column = 0;
        while (occupiedColumns.has(column)) {
          column++;
        }
        
        console.log(`[StatusLineContainer] 🆕 Status "${status}" at line ${startIndex}: 分配新列 ${column}`);
      }
      
      columnMap.set(segment, column);
      
      // 记录这个segment所有行的status→column映射
      for (let lineIndex = segment.startIndex; lineIndex <= segment.endIndex; lineIndex++) {
        if (!statusColumnsAtLine.has(lineIndex)) {
          statusColumnsAtLine.set(lineIndex, new Map());
        }
        statusColumnsAtLine.get(lineIndex)!.set(status, column);
      }
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

  // 使用state存储计算后的segment位置
  const [renderedSegments, setRenderedSegments] = useState<Array<{
    startIndex: number;
    endIndex: number;
    status: string;
    label: string;
    column: number;
    left: number;
    top: number;
    height: number;
  }>>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算每个segment的基础信息（left、column）
  const baseSegments = useMemo(() => {
    return segments.map(segment => {
      const column = segmentColumns.get(segment) || 0;
      const left = BASE_LEFT + maxLabelWidth + LABEL_SPACING + column * (LINE_WIDTH + LINE_SPACING);
      
      return {
        ...segment,
        column,
        left,
        top: segment.startIndex * lineHeight, // 初始估算值
        height: (segment.endIndex - segment.startIndex + 1) * lineHeight // 初始估算值
      };
    });
  }, [segments, segmentColumns, maxLabelWidth, lineHeight]);

  // 在DOM渲染后，使用实际DOM位置更新segment
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSegmentPositions = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const contentDiv = container.querySelector('.status-line-content');
      if (!contentDiv) return;
      
      const allEventLines = contentDiv.querySelectorAll('[data-event-line]');
      if (allEventLines.length === 0) return;
      
      const containerRect = contentDiv.getBoundingClientRect();
      
      // 按 eventId 分组所有行（title + eventlog）
      const eventIdToLines = new Map<string, HTMLElement[]>();
      allEventLines.forEach(line => {
        const eventId = (line as HTMLElement).dataset.eventId;
        if (eventId) {
          if (!eventIdToLines.has(eventId)) {
            eventIdToLines.set(eventId, []);
          }
          eventIdToLines.get(eventId)!.push(line as HTMLElement);
        }
      });
      
      console.log('[StatusLineContainer] 🔍 DOM查询:', {
        总行数: allEventLines.length,
        事件数: eventIdToLines.size,
        segments数: baseSegments.length
      });
      
      const updated = baseSegments.map(segment => {
        // 通过 editorItems 的 index 找到对应的事件
        const eventItem = editorItems[segment.startIndex];
        if (!eventItem || !eventItem.id) {
          console.warn(`[StatusLineContainer] ⚠️ Segment[${segment.startIndex}]: 找不到对应的事件`);
          return segment;
        }
        
        // 获取这个事件的所有行（title + eventlog）
        const lines = eventIdToLines.get(eventItem.id);
        if (!lines || lines.length === 0) {
          console.warn(`[StatusLineContainer] ⚠️ Event ${eventItem.id}: 找不到DOM行`);
          return segment;
        }
        
        // 竖线从第一行（title）开始，到最后一行（最后的eventlog）结束
        const startElement = lines[0];
        const endElement = lines[lines.length - 1];
        
        const startRect = startElement.getBoundingClientRect();
        const endRect = endElement.getBoundingClientRect();
        const top = startRect.top - containerRect.top;
        const height = endRect.bottom - startRect.top;
        
        console.log(`[StatusLineContainer] Event[${segment.startIndex}] ${eventItem.title?.substring(0, 20)} ${segment.status}: top=${top.toFixed(1)}, height=${height.toFixed(1)}, lines=${lines.length}`);
        
        return {
          ...segment,
          top,
          height
        };
      });
      
      console.log('[StatusLineContainer] 渲染segments:', {
        输入segments数: segments.length,
        输出rendered数: updated.length,
        详情: updated.map(r => ({
          index: r.startIndex,
          status: r.status,
          column: r.column,
          left: r.left,
          top: r.top,
          height: r.height
        }))
      });
      
      setRenderedSegments(updated);
    };
    
    // 初次渲染后立即更新
    updateSegmentPositions();
    
    // 监听窗口大小变化
    const resizeObserver = new ResizeObserver(updateSegmentPositions);
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [baseSegments, segments.length, editorItems]);

  // 计算智能标签位置
  const smartLabels = useMemo(() => {
    const labels: Array<{
      status: string;
      label: string;
      left: number;
      top: number;
    }> = [];
    
    const seenStatuses = new Map<string, { top: number; count: number }>();
    
    // 按startIndex排序，优先处理最早出现的segment
    const sortedSegments = [...renderedSegments].sort((a, b) => {
      return a.startIndex - b.startIndex;
    });
    
    sortedSegments.forEach(segment => {
      if (!seenStatuses.has(segment.status)) {
        // 检查是否有其他status在相同位置（top差距小于5px认为是同一行）
        let offsetCount = 0;
        seenStatuses.forEach((info, status) => {
          if (Math.abs(info.top - segment.top) < 5) {
            offsetCount += info.count;
          }
        });
        
        // 标签位置：使用竖线的起始位置（标题行）+ 半行高（因为CSS有translateY(-50%)）
        // 如果有重叠则向下偏移
        const top = segment.top + lineHeight / 2 + offsetCount * 20; // 每个标签高度约20px
        const left = BASE_LEFT;
        
        seenStatuses.set(segment.status, { top: segment.top, count: 1 });
        
        labels.push({
          status: segment.status,
          label: segment.label,
          left,
          top
        });
      }
    });
    
    return labels;
  }, [renderedSegments]);

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
    <div ref={containerRef} className="status-line-container">
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