import React, { useState, useRef, useEffect } from 'react';
import { Button, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import 'dayjs/locale/zh-cn';
import './UnifiedDateTimePicker.css';
import { useEventTime } from '../../../hooks/useEventTime';
import { formatTimeForStorage } from '../../../utils/timeUtils';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.locale('zh-cn');

interface UnifiedDateTimePickerProps {
  onSelect?: (start: string | null, end: string | null) => void;
  onClose?: () => void;
  onApplied?: (startIso: string, endIso?: string, allDay?: boolean) => void; // TimeHub 模式：写入成功后回调（外层可插入可视化标记/保存其它字段）
  eventId?: string;         // 可选：绑定事件ID时，将通过 TimeHub 读写
  useTimeHub?: boolean;     // 可选：默认 false，置为 true 时启用 TimeHub
}

// 自定义时间列选择器
const TimeColumn: React.FC<{
  type: 'hour' | 'minute';
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  scrollTrigger?: number; // 外部触发器，用于强制重新滚动
}> = ({ type, value, onChange, disabled, scrollTrigger }) => {
  const max = type === 'hour' ? 23 : 59;
  const items = Array.from({ length: max + 1 }, (_, i) => i);
  
  const columnRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const cellHeightRef = useRef<number>(21.6); // 默认值，会动态更新
  
  // 动态获取CSS中实际的cell高度
  useEffect(() => {
    if (contentRef.current) {
      const firstCell = contentRef.current.querySelector('.time-cell');
      if (firstCell) {
        const computedHeight = window.getComputedStyle(firstCell).height;
        cellHeightRef.current = parseFloat(computedHeight);
      }
    }
  }, []); // 只在组件挂载时获取一次
  
  // 当值改变时，滚动到中间组的对应位置
  useEffect(() => {
    if (columnRef.current && contentRef.current) {
      // 确保DOM已经渲染，使用requestAnimationFrame延迟到下一帧
      requestAnimationFrame(() => {
        if (!columnRef.current || !contentRef.current) return;
        
        // 动态读取当前的cell高度（以防CSS还未应用）
        const firstCell = contentRef.current.querySelector('.time-cell');
        if (firstCell) {
          const computedHeight = window.getComputedStyle(firstCell).height;
          const parsedHeight = parseFloat(computedHeight);
          if (!isNaN(parsedHeight)) {
            cellHeightRef.current = parsedHeight;
          }
        }
        
        const cellHeight = cellHeightRef.current;
        const containerHeight = columnRef.current.clientHeight;
        
        
        // 验证值是否有效
        if (!cellHeight || !containerHeight || isNaN(cellHeight) || isNaN(containerHeight)) {
          console.warn(`⚠️ [TimeColumn] ${type} invalid dimensions, skipping scroll`);
          return;
        }
        
        // 计算滚动到中间组的位置
        // 每组有 (max + 2) 个项（包括 -- 和 0 到 max）
        const groupSize = max + 2;
        
        let selectedIndex;
        if (value === null) {
          // -- 在每组的第一个位置，滚动到中间组的 --
          selectedIndex = groupSize;
        } else {
          // 数字在 -- 之后，+1 是 -- 的位置，再 + value
          selectedIndex = groupSize + 1 + value;
        }
        
        // 计算滚动位置，让选中项在距离顶部约1/3的位置，这样4个列的选中值会在同一水平线上
        const offsetFromTop = containerHeight * 0.3; // 距离顶部30%的位置
        const scrollTop = selectedIndex * cellHeight - offsetFromTop;
        
        
        isScrollingRef.current = true;
        columnRef.current.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
        
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 300);
      });
    }
  }, [value, max, type, scrollTrigger]); // 添加scrollTrigger依赖，使其变化时也触发滚动
  
  // 处理无限滚动：当滚动到边界时，跳转回中间组
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    
    const handleScroll = () => {
      if (isScrollingRef.current) return;
      
      const cellHeight = cellHeightRef.current; // 使用动态获取的高度
      const groupSize = max + 2;
      const groupHeight = groupSize * cellHeight;
      const scrollTop = column.scrollTop;
      const scrollHeight = column.scrollHeight;
      const clientHeight = column.clientHeight;
      
      // 如果滚动到接近顶部（第1组），跳转到第2组相同位置
      if (scrollTop < groupHeight * 0.5) {
        isScrollingRef.current = true;
        column.scrollTop = scrollTop + groupHeight;
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 50);
      }
      // 如果滚动到接近底部（第3组），跳转到第2组相同位置
      else if (scrollTop > scrollHeight - clientHeight - groupHeight * 0.5) {
        isScrollingRef.current = true;
        column.scrollTop = scrollTop - groupHeight;
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 50);
      }
    };
    
    column.addEventListener('scroll', handleScroll);
    return () => column.removeEventListener('scroll', handleScroll);
  }, [max]);
  
  const handleChange = (item: number | null) => {
    if (!disabled) {
      onChange(item);
    }
  };
  
  // 渲染一组：-- + 0~max
  const renderGroup = (groupIndex: number) => {
    return (
      <React.Fragment key={`group-${groupIndex}`}>
        {/* -- 选项 */}
        <div
          className={`time-cell no-select ${value === null ? 'selected' : ''}`}
          onClick={() => handleChange(null)}
        >
          --
        </div>
        {/* 数字选项 */}
        {items.map(item => (
          <div
            key={`${groupIndex}-${item}`}
            className={`time-cell ${item === value ? 'selected' : ''}`}
            onClick={() => handleChange(item)}
          >
            {item.toString().padStart(2, '0')}
          </div>
        ))}
      </React.Fragment>
    );
  };
  
  
  return (
    <div className={`time-column ${disabled ? 'disabled' : ''}`} ref={columnRef}>
      <div className="time-column-content" ref={contentRef}>
        {/* 渲染3组循环 */}
        {renderGroup(0)}
        {renderGroup(1)}
        {renderGroup(2)}
      </div>
    </div>
  );
};

// 时间选择器组件
const TimeSelector: React.FC<{
  value: { hour: number; minute: number } | null;
  onChange: (time: { hour: number; minute: number } | null) => void;
  title: string;
  disabled?: boolean;
}> = ({ value, onChange, title, disabled }) => {
  const handleHourChange = (hour: number | null) => {
    if (hour === null) {
      onChange(null);
    } else {
      onChange({ hour, minute: value?.minute ?? 0 });
    }
  };

  const handleMinuteChange = (minute: number | null) => {
    if (minute === null) {
      onChange(null);
    } else {
      onChange({ hour: value?.hour ?? 0, minute });
    }
  };

  return (
    <div className={`time-selector ${disabled ? 'disabled' : ''}`}>
      {title && <div className="time-selector-header">{title}</div>}
      <div className="time-columns">
        <TimeColumn
          type="hour"
          value={value?.hour ?? null}
          onChange={handleHourChange}
          disabled={disabled}
        />
        <div className="time-separator">:</div>
        <TimeColumn
          type="minute"
          value={value?.minute ?? null}
          onChange={handleMinuteChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

// 计算时长显示
const calculateDuration = (start: Dayjs, end: Dayjs) => {
  const diffMinutes = end.diff(start, 'minute');
  const days = Math.floor(diffMinutes / (24 * 60));
  const hours = Math.floor((diffMinutes % (24 * 60)) / 60);
  const minutes = diffMinutes % 60;

  if (days > 0) {
    if (hours > 0 && minutes > 0) {
      return `${days}D${hours}h${minutes}min`;
    } else if (hours > 0) {
      return `${days}D${hours}h`;
    } else if (minutes > 0) {
      return `${days}D${minutes}min`;
    } else {
      return `${days}D`;
    }
  } else if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h${minutes}min`;
    } else {
      return `${hours}h`;
    }
  } else {
    return `${minutes}min`;
  }
};

const UnifiedDateTimePicker: React.FC<UnifiedDateTimePickerProps> = ({
  onSelect,
  onClose,
  onApplied,
  eventId,
  useTimeHub = false,
}) => {
  // Hooks must be called unconditionally; useEventTime gracefully handles undefined eventId
  const eventTime = useEventTime(eventId);
  // 默认选择今天的日期
  const [selectedDates, setSelectedDates] = useState<{start: Dayjs | null, end: Dayjs | null}>({
    start: dayjs(),
    end: dayjs()
  });
  const [startTime, setStartTime] = useState<{ hour: number; minute: number } | null>(null);
  const [endTime, setEndTime] = useState<{ hour: number; minute: number } | null>(null);
  const [hoverDate, setHoverDate] = useState<Dayjs | null>(null);
  const [isSelecting, setIsSelecting] = useState<'start' | 'end' | null>(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [isEditingMonth, setIsEditingMonth] = useState(false);
  const [editYear, setEditYear] = useState(dayjs().year().toString());
  const [editMonth, setEditMonth] = useState((dayjs().month() + 1).toString());
  const [selectedQuickBtn, setSelectedQuickBtn] = useState<string | null>(null);
  const [scrollTrigger, setScrollTrigger] = useState<number>(0); // 用于强制重新滚动

  const containerRef = useRef<HTMLDivElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);

  // 当绑定了事件且存在已保存时间时，用其初始化本地选择状态
  useEffect(() => {
    if (!eventTime || eventTime.loading) return;
    const start = eventTime.start ? dayjs(eventTime.start.replace(' ', 'T')) : null;
    const end = eventTime.end ? dayjs(eventTime.end.replace(' ', 'T')) : start;
    if (start) {
      setSelectedDates({ start, end: end || start });
      // 根据是否全天/是否提供具体时分，决定列的初始值
      const hasSpecificStart = start.hour() !== 0 || start.minute() !== 0;
      const hasSpecificEnd = end ? (end.hour() !== 0 || end.minute() !== 0) : false;
      setStartTime(hasSpecificStart ? { hour: start.hour(), minute: start.minute() } : null);
      setEndTime(end && hasSpecificEnd ? { hour: end.hour(), minute: end.minute() } : null);
    }
  }, [eventTime?.start, eventTime?.end, eventTime?.loading]);

  // 监听点击编辑区域外退出编辑模式
  useEffect(() => {
    if (!isEditingMonth) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (editContainerRef.current && !editContainerRef.current.contains(target)) {
        setIsEditingMonth(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditingMonth]);

  // 全局点击监听器 - 用于诊断（可以在调试完成后移除）
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInside = containerRef.current?.contains(target);
      const className = typeof target.className === 'string' ? target.className : '';
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, []);

  // 生成日历网格
  const generateCalendar = () => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startOfWeek = startOfMonth.startOf('week');
    const endOfWeek = endOfMonth.endOf('week');

    const days = [];
    let current = startOfWeek;

    while (current.isBefore(endOfWeek) || current.isSame(endOfWeek, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }

    return days;
  };

  const handleDateClick = (date: Dayjs) => {
    setSelectedQuickBtn(null); // 清除快捷按钮选中状态
    if (!selectedDates.start || (selectedDates.start && selectedDates.end)) {
      // 开始新的选择
      setSelectedDates({ start: date, end: null });
      setIsSelecting('end');
    } else if (selectedDates.start && !selectedDates.end) {
      // 选择结束日期
      if (date.isBefore(selectedDates.start)) {
        setSelectedDates({ start: date, end: selectedDates.start });
      } else {
        setSelectedDates({ start: selectedDates.start, end: date });
      }
      setIsSelecting(null);
    }
  };

  const isInRange = (date: Dayjs) => {
    if (!selectedDates.start) return false;
    if (!selectedDates.end && !hoverDate) return date.isSame(selectedDates.start, 'day');
    
    const end = selectedDates.end || hoverDate;
    if (!end) return false;

    const rangeStart = selectedDates.start.isBefore(end) ? selectedDates.start : end;
    const rangeEnd = selectedDates.start.isBefore(end) ? end : selectedDates.start;

    return date.isSameOrAfter(rangeStart, 'day') && date.isSameOrBefore(rangeEnd, 'day');
  };

  const isRangeStart = (date: Dayjs) => {
    if (!selectedDates.start) return false;
    if (!selectedDates.end && !hoverDate) return date.isSame(selectedDates.start, 'day');
    
    const end = selectedDates.end || hoverDate;
    if (!end) return false;

    return date.isSame(selectedDates.start.isBefore(end) ? selectedDates.start : end, 'day');
  };

  const isRangeEnd = (date: Dayjs) => {
    if (!selectedDates.start) return false;
    if (!selectedDates.end && !hoverDate) return false;
    
    const end = selectedDates.end || hoverDate;
    if (!end) return false;

    return date.isSame(selectedDates.start.isBefore(end) ? end : selectedDates.start, 'day');
  };

  const handleQuickSelect = (days: number) => {
    const end = dayjs();
    const start = end.subtract(days, 'day');
    setSelectedDates({ start, end });
    setStartTime({ hour: 0, minute: 0 });
    setEndTime({ hour: 23, minute: 59 });
  };

  const handlePrevMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'));
  };

  const handleToday = () => {
    setCurrentMonth(dayjs());
  };

  const handleMonthClick = () => {
    setIsEditingMonth(true);
    setEditYear(currentMonth.year().toString());
    setEditMonth((currentMonth.month() + 1).toString());
  };

  const handleYearChange = (value: string) => {
    setEditYear(value);
    const year = parseInt(value);
    const month = parseInt(editMonth);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      setCurrentMonth(dayjs().year(year).month(month - 1));
    }
  };

  const handleMonthChange = (value: string) => {
    setEditMonth(value);
    const year = parseInt(editYear);
    const month = parseInt(value);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      setCurrentMonth(dayjs().year(year).month(month - 1));
    }
  };

  const handleApply = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    // 只在点击确定时才调用 onSelect
    if (selectedDates.start) {
      const startDateTime = startTime 
        ? selectedDates.start.hour(startTime.hour).minute(startTime.minute)
        : selectedDates.start.startOf('day');
        
      const endDateTime = selectedDates.end
        ? (endTime 
          ? selectedDates.end.hour(endTime.hour).minute(endTime.minute)
          : selectedDates.end.endOf('day'))
        : startDateTime;
      
      // 如果启用 TimeHub，则写入统一时间服务
      if (useTimeHub && eventId) {
        const startIso = formatTimeForStorage(startDateTime.toDate());
        const endIso = formatTimeForStorage(endDateTime.toDate());
        const allDaySelected = !startTime && !endTime;
        // 写入后触发 onApplied，供外层插入可视化及保存其它字段
        try {
          const { TimeHub } = await import('../../../services/TimeHub');
          await TimeHub.setEventTime(eventId, {
            start: startIso,
            end: endIso,
            kind: startIso !== endIso ? 'range' : 'fixed',
            allDay: allDaySelected,
            source: 'picker',
          });
          onApplied?.(startIso, endIso, allDaySelected);
        } catch {}
      } else {
        // 保持向后兼容的回调
        const startStr = startDateTime.format('YYYY-MM-DD HH:mm');
        const endStr = endDateTime.format('YYYY-MM-DD HH:mm');
        onSelect?.(startStr, endStr);
      }
    }
    
    onClose?.();
  };

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDates({ start: dayjs(), end: dayjs() });
    setStartTime(null);
    setEndTime(null);
    onSelect?.(null, null);
    onClose?.();
  };

  // 生成预览内容
  const renderPreviewContent = () => {
    const hasStartDate = selectedDates.start;
    
    if (!hasStartDate) {
      return {
        startDateTime: '未选择',
        endDateTime: '时间',
        duration: null,
        dayDiff: 0,
        isCrossDay: false
      };
    }
    
    const startDate = selectedDates.start!;
    const endDate = selectedDates.end || startDate;
    
    // 检查是否通过快捷按钮选择且未手动调整
    const isQuickBtnSelection = selectedQuickBtn !== null;
    
    // 格式化基础日期（周几）
    const dateStr = startDate.format('YYYY-MM-DD（ddd）');
    
    // 情况0: 开始和结束时间都为 null
    if (!startTime && !endTime) {
      // 如果选择了多天（跨日期）
      if (!startDate.isSame(endDate, 'day')) {
        const dayDiff = endDate.diff(startDate, 'day') + 1; // +1 因为包含首尾两天
        const endDateStr = endDate.format('YYYY-MM-DD（ddd）');
        return {
          startDateTime: dateStr,
          endDateTime: endDateStr,
          duration: `${dayDiff}d`, // 显示实际天数（包含首尾）
          dayDiff,
          isCrossDay: false // 不显示角标，因为已经显示了完整的结束日期
        };
      }
      // 单天，没有选择时间 = 全天
      return {
        startDateTime: dateStr,
        endDateTime: '全天',
        duration: null,
        dayDiff: 0,
        isCrossDay: false
      };
    }
    
    // 情况1: 通过快捷按钮选择（上午/下午/晚上）且未手动调整
    if (isQuickBtnSelection && (selectedQuickBtn === 'morning' || selectedQuickBtn === 'afternoon' || selectedQuickBtn === 'evening')) {
      const timeLabel = selectedQuickBtn === 'morning' ? '上午' : selectedQuickBtn === 'afternoon' ? '下午' : '晚上';
      return {
        startDateTime: dateStr,
        endDateTime: timeLabel,
        duration: null,
        dayDiff: 0,
        isCrossDay: false
      };
    }
    
    // 情况2: 开始时间为 null（只选择了结束时间）
    if (!startTime && endTime) {
      const endStr = endDate.hour(endTime.hour).minute(endTime.minute).format('HH:mm');
      return {
        startDateTime: dateStr,
        endDateTime: `${endStr}前`,
        duration: null,
        dayDiff: 0,
        isCrossDay: false
      };
    }
    
    // 情况3: 结束时间为 null（只选择了开始时间）
    if (startTime && !endTime) {
      const startStr = startDate.hour(startTime.hour).minute(startTime.minute).format('HH:mm');
      return {
        startDateTime: dateStr,
        endDateTime: `${startStr}后`,
        duration: null,
        dayDiff: 0,
        isCrossDay: false
      };
    }
    
    // 情况4: 用户自主选择了开始+结束时间（默认行为）
    const start = startTime ? startDate.hour(startTime.hour).minute(startTime.minute) : startDate.hour(0).minute(0);
    const end = endTime ? endDate.hour(endTime.hour).minute(endTime.minute) : endDate.hour(23).minute(59);
    
    // 计算时长
    const diffMinutes = end.diff(start, 'minute');
    const days = Math.floor(diffMinutes / (24 * 60));
    const hours = Math.floor((diffMinutes % (24 * 60)) / 60);
    const minutes = diffMinutes % 60;
    
    let durationText = '';
    if (days > 0) {
      // 超过24小时，显示天数
      if (hours > 0 && minutes > 0) {
        durationText = `${days}d${hours}h${minutes}m`;
      } else if (hours > 0) {
        durationText = `${days}d${hours}h`;
      } else if (minutes > 0) {
        durationText = `${days}d${minutes}m`;
      } else {
        durationText = `${days}d`;
      }
    } else if (hours > 0) {
      // 小于24小时
      if (minutes > 0) {
        durationText = `${hours}h${minutes}m`;
      } else {
        durationText = `${hours}h`;
      }
    } else {
      // 只有分钟
      durationText = `${minutes}m`;
    }
    
    // 检查是否跨天
    const dayDiff = end.diff(start, 'day');
    const isCrossDay = dayDiff > 0;
    
    // 格式化显示文本
    const startStr = start.format('YYYY-MM-DD（ddd）HH:mm');
    const endStr = end.format('HH:mm');
    
    return {
      startDateTime: startStr,
      endDateTime: endStr,
      duration: durationText,
      dayDiff,
      isCrossDay
    };
  };

  // 快捷选择：明天
  const handleSelectTomorrow = () => {
    const tomorrow = dayjs().add(1, 'day');
    setSelectedDates({ start: tomorrow, end: tomorrow });
    setStartTime(null);
    setEndTime(null);
    setSelectedQuickBtn('tomorrow');
    setCurrentMonth(tomorrow); // 切换到明天所在的月份
  };

  // 快捷选择：本周
  const handleSelectThisWeek = () => {
    const start = dayjs().startOf('week');
    const end = dayjs().endOf('week');
    setSelectedDates({ start, end });
    setStartTime(null);
    setEndTime(null);
    setSelectedQuickBtn('thisWeek');
    setCurrentMonth(start); // 切换到本周开始的月份
  };

  // 快捷选择：下周
  const handleSelectNextWeek = () => {
    const start = dayjs().add(1, 'week').startOf('week');
    const end = dayjs().add(1, 'week').endOf('week');
    setSelectedDates({ start, end });
    setStartTime(null);
    setEndTime(null);
    setSelectedQuickBtn('nextWeek');
    setCurrentMonth(start); // 切换到下周开始的月份
  };

  // 快捷选择：上午（保留已选日期，设置 00:00 - 12:00）
  const handleSelectMorning = () => {
    const targetDate = selectedDates.start || dayjs();
    setSelectedDates({ start: targetDate, end: targetDate });
    setStartTime({ hour: 0, minute: 0 });
    setEndTime({ hour: 12, minute: 0 });
    setSelectedQuickBtn('morning');
    setCurrentMonth(targetDate); // 确保当前月份可见
    setScrollTrigger(prev => prev + 1); // 触发强制滚动
  };

  // 快捷选择：下午（保留已选日期，设置 12:00 - 18:00）
  const handleSelectAfternoon = () => {
    const targetDate = selectedDates.start || dayjs();
    setSelectedDates({ start: targetDate, end: targetDate });
    setStartTime({ hour: 12, minute: 0 });
    setEndTime({ hour: 18, minute: 0 });
    setSelectedQuickBtn('afternoon');
    setCurrentMonth(targetDate); // 确保当前月份可见
    setScrollTrigger(prev => prev + 1); // 触发强制滚动
  };

  // 快捷选择：晚上（保留已选日期，设置 18:00 - 23:59）
  const handleSelectEvening = () => {
    const targetDate = selectedDates.start || dayjs();
    setSelectedDates({ start: targetDate, end: targetDate });
    setStartTime({ hour: 18, minute: 0 });
    setEndTime({ hour: 23, minute: 59 });
    setSelectedQuickBtn('evening');
    setCurrentMonth(targetDate); // 确保当前月份可见
    setScrollTrigger(prev => prev + 1); // 触发强制滚动
  };

  return (
    <div 
      ref={containerRef} 
      className="unified-datetime-picker"
    >
      {/* 顶部预览区域 */}
      <div className="picker-preview-header">
        <div className="preview-time-display">
          <span className="preview-start-time">{renderPreviewContent().startDateTime}</span>
          <div className="preview-arrow-section">
            {renderPreviewContent().duration && (
              <>
                <span className="duration-text">{renderPreviewContent().duration}</span>
                <svg className="arrow-icon" width="52" height="9" viewBox="0 0 52 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M51.3889 4.43908C51.6037 4.2243 51.6037 3.87606 51.3889 3.66127L47.8887 0.161088C47.6739 -0.0537006 47.3257 -0.0537006 47.1109 0.161088C46.8961 0.375876 46.8961 0.724117 47.1109 0.938905L50.2222 4.05018L47.1109 7.16144C46.8961 7.37623 46.8961 7.72447 47.1109 7.93926C47.3257 8.15405 47.6739 8.15405 47.8887 7.93926L51.3889 4.43908ZM0 4.05017L-4.80825e-08 4.60017L51 4.60018L51 4.05018L51 3.50018L4.80825e-08 3.50017L0 4.05017Z" fill="url(#paint0_linear_262_790)"/>
                  <defs>
                    <linearGradient id="paint0_linear_262_790" x1="-4.37114e-08" y1="4.55017" x2="51" y2="4.55018" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#22D3EE"/>
                      <stop offset="1" stopColor="#3B82F6"/>
                    </linearGradient>
                  </defs>
                </svg>
              </>
            )}
          </div>
          <span className="preview-end-time">
            {renderPreviewContent().endDateTime}
            {renderPreviewContent().isCrossDay && (
              <span className="cross-day-badge">+{renderPreviewContent().dayDiff}</span>
            )}
          </span>
        </div>
      </div>

      <div className="main-content">
        {/* 左侧日历 */}
        <div className="calendar-section">
          {/* 日历上方的快捷按钮 */}
          <div className="quick-buttons-container calendar-quick-buttons">
            <button 
              className={`quick-btn ${selectedQuickBtn === 'tomorrow' ? 'selected' : ''}`} 
              onClick={handleSelectTomorrow}
            >
              明天
            </button>
            <button 
              className={`quick-btn ${selectedQuickBtn === 'thisWeek' ? 'selected' : ''}`} 
              onClick={handleSelectThisWeek}
            >
              本周
            </button>
            <button 
              className={`quick-btn ${selectedQuickBtn === 'nextWeek' ? 'selected' : ''}`} 
              onClick={handleSelectNextWeek}
            >
              下周
            </button>
          </div>
          
          <div className="calendar-header">
            <button className="month-nav-btn" onClick={handlePrevMonth}>‹</button>
            <div className="month-year-container" ref={editContainerRef}>
              {isEditingMonth ? (
                <>
                  <input
                    type="number"
                    className="month-edit-input year-input"
                    value={editYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    autoFocus
                    min="1900"
                    max="2100"
                  />
                  <span className="month-edit-separator">年</span>
                  <input
                    type="number"
                    className="month-edit-input month-input"
                    value={editMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    min="1"
                    max="12"
                  />
                  <span className="month-edit-separator">月</span>
                </>
              ) : (
                <span className="month-year" onClick={handleMonthClick}>
                  {currentMonth.format('YYYY年 MM月')}
                </span>
              )}
            </div>
            <button className="month-nav-btn" onClick={handleNextMonth}>›</button>
          </div>
          
          <div className="calendar-grid">
            <div className="weekdays">
              {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            
            <div className="dates">
              {generateCalendar().map(date => (
                <div
                  key={date.format('YYYY-MM-DD')}
                  className={`
                    date-cell 
                    ${date.month() !== currentMonth.month() ? 'other-month' : ''}
                    ${date.isSame(dayjs(), 'day') ? 'today' : ''}
                    ${isInRange(date) ? 'in-range' : ''}
                    ${isRangeStart(date) ? 'range-start' : ''}
                    ${isRangeEnd(date) ? 'range-end' : ''}
                  `}
                  onClick={() => handleDateClick(date)}
                  onMouseEnter={() => setHoverDate(date)}
                  onMouseLeave={() => setHoverDate(null)}
                >
                  {date.date()}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧时间选择 */}
        <div className="time-section">
          {/* 时间选择器上方的快捷按钮 */}
          <div className="quick-buttons-container time-quick-buttons">
            <button 
              className={`quick-btn ${selectedQuickBtn === 'morning' ? 'selected' : ''}`} 
              onClick={handleSelectMorning}
            >
              上午
            </button>
            <button 
              className={`quick-btn ${selectedQuickBtn === 'afternoon' ? 'selected' : ''}`} 
              onClick={handleSelectAfternoon}
            >
              下午
            </button>
            <button 
              className={`quick-btn ${selectedQuickBtn === 'evening' ? 'selected' : ''}`} 
              onClick={handleSelectEvening}
            >
              晚上
            </button>
          </div>
          
          {/* 大标题：开始时间 | 结束时间 */}
          <div className="time-main-titles">
            <div className="time-main-title">开始时间</div>
            <div className="time-main-title">结束时间</div>
          </div>

          {/* 4列时间选择器 */}
          <div className="time-columns-container">
            <TimeColumn
              type="hour"
              value={startTime?.hour ?? null}
              onChange={(hour) => {
                setSelectedQuickBtn(null); // 手动调整时清除快捷按钮状态
                hour === null ? setStartTime(null) : setStartTime({ hour, minute: startTime?.minute ?? 0 });
              }}
              disabled={false}
              scrollTrigger={scrollTrigger}
            />
            <TimeColumn
              type="minute"
              value={startTime?.minute ?? null}
              onChange={(minute) => {
                setSelectedQuickBtn(null); // 手动调整时清除快捷按钮状态
                minute === null ? setStartTime(null) : setStartTime({ hour: startTime?.hour ?? 0, minute });
              }}
              disabled={false}
              scrollTrigger={scrollTrigger}
            />
            <TimeColumn
              type="hour"
              value={endTime?.hour ?? null}
              onChange={(hour) => {
                setSelectedQuickBtn(null); // 手动调整时清除快捷按钮状态
                hour === null ? setEndTime(null) : setEndTime({ hour, minute: endTime?.minute ?? 0 });
              }}
              disabled={false}
              scrollTrigger={scrollTrigger}
            />
            <TimeColumn
              type="minute"
              value={endTime?.minute ?? null}
              onChange={(minute) => {
                setSelectedQuickBtn(null); // 手动调整时清除快捷按钮状态
                minute === null ? setEndTime(null) : setEndTime({ hour: endTime?.hour ?? 0, minute });
              }}
              disabled={false}
              scrollTrigger={scrollTrigger}
            />
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <Space>
          <Button onClick={handleCancel}>取消</Button>
          <Button type="primary" onClick={handleApply}>确定</Button>
        </Space>
      </div>
    </div>
  );
};

export default UnifiedDateTimePicker;