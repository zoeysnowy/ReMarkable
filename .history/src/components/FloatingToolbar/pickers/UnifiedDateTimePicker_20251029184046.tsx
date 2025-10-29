import React, { useState, useRef, useEffect } from 'react';
import { Button, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import 'dayjs/locale/zh-cn';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.locale('zh-cn');

interface UnifiedDateTimePickerProps {
  onSelect?: (start: string | null, end: string | null) => void;
  onClose?: () => void;
}

// 自定义时间列选择器
const TimeColumn: React.FC<{
  type: 'hour' | 'minute';
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}> = ({ type, value, onChange, disabled }) => {
  const max = type === 'hour' ? 23 : 59;
  const items = Array.from({ length: max + 1 }, (_, i) => i);
  
  const handleChange = (item: number | null) => {
    console.log(`⏰ [Time] ${type}:`, item === null ? '不选择' : item);
    if (!disabled) {
      onChange(item);
    }
  };
  
  return (
    <div className={`time-column ${disabled ? 'disabled' : ''}`}>
      <div className="time-column-content">
        {/* 不选择选项 */}
        <div
          className={`time-cell no-select ${value === null ? 'selected' : ''}`}
          onClick={() => handleChange(null)}
        >
          --
        </div>
        {items.map(item => (
          <div
            key={item}
            className={`time-cell ${item === value ? 'selected' : ''}`}
            onClick={() => handleChange(item)}
          >
            {item.toString().padStart(2, '0')}
          </div>
        ))}
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
  onClose
}) => {
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

  const containerRef = useRef<HTMLDivElement>(null);

  // 全局点击监听器 - 用于诊断（可以在调试完成后移除）
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInside = containerRef.current?.contains(target);
      console.log('🌍 [Picker Global] Click', {
        target: target.tagName + (target.className ? '.' + target.className.substring(0, 30) : ''),
        isInside
      });
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
    console.log('📅 [Picker] Date clicked:', date.format('YYYY-MM-DD'));
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
    console.log('⚡ [Picker] Quick select:', days, 'days');
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

  const handleMonthEditConfirm = () => {
    const year = parseInt(editYear);
    const month = parseInt(editMonth);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      setCurrentMonth(dayjs().year(year).month(month - 1));
    }
    setIsEditingMonth(false);
  };

  const handleMonthEditCancel = () => {
    setIsEditingMonth(false);
  };

  const handleApply = (e?: React.MouseEvent) => {
    console.log('✅ [Picker] Apply clicked');
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

      const startStr = startDateTime.format('YYYY-MM-DD HH:mm');
      const endStr = endDateTime.format('YYYY-MM-DD HH:mm');
      
      onSelect?.(startStr, endStr);
    }
    
    onClose?.();
  };

  const handleCancel = (e?: React.MouseEvent) => {
    console.log('❌ [Picker] Cancel clicked');
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
        dateTime: '未选择时间',
        duration: null,
        dayDiff: 0,
        isCrossDay: false
      };
    }
    
    const startDate = selectedDates.start!;
    const endDate = selectedDates.end || startDate;
    const start = startTime ? startDate.hour(startTime.hour).minute(startTime.minute) : startDate.hour(0).minute(0);
    const end = endTime ? endDate.hour(endTime.hour).minute(endTime.minute) : endDate.hour(23).minute(59);
    
    // 计算时长
    const diffMinutes = end.diff(start, 'minute');
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    let durationText = '';
    if (hours > 0 && minutes > 0) {
      durationText = `${hours}h${minutes}min`;
    } else if (hours > 0) {
      durationText = `${hours}h`;
    } else {
      durationText = `${minutes}min`;
    }
    
    // 检查是否跨天
    const dayDiff = end.diff(start, 'day');
    const isCrossDay = dayDiff > 0;
    
    // 格式化显示文本
    const startStr = start.format('YYYY-MM-DD（ddd）HH:mm');
    const endStr = end.format('HH:mm');
    
    return {
      dateTime: `${startStr} → ${endStr}`,
      duration: durationText,
      dayDiff,
      isCrossDay
    };
  };

  // 快捷选择：明天
  const handleSelectTomorrow = () => {
    const tomorrow = dayjs().add(1, 'day');
    setSelectedDates({ start: tomorrow, end: tomorrow });
    setStartTime({ hour: 0, minute: 0 });
    setEndTime({ hour: 23, minute: 59 });
  };

  // 快捷选择：本周
  const handleSelectThisWeek = () => {
    const start = dayjs().startOf('week');
    const end = dayjs().endOf('week');
    setSelectedDates({ start, end });
    setStartTime({ hour: 0, minute: 0 });
    setEndTime({ hour: 23, minute: 59 });
  };

  // 快捷选择：下周
  const handleSelectNextWeek = () => {
    const start = dayjs().add(1, 'week').startOf('week');
    const end = dayjs().add(1, 'week').endOf('week');
    setSelectedDates({ start, end });
    setStartTime({ hour: 0, minute: 0 });
    setEndTime({ hour: 23, minute: 59 });
  };

  // 快捷选择：上午（当前日期 00:00 - 12:00）
  const handleSelectMorning = () => {
    const today = dayjs();
    setSelectedDates({ start: today, end: today });
    setStartTime({ hour: 0, minute: 0 });
    setEndTime({ hour: 12, minute: 0 });
  };

  // 快捷选择：下午（当前日期 12:00 - 18:00）
  const handleSelectAfternoon = () => {
    const today = dayjs();
    setSelectedDates({ start: today, end: today });
    setStartTime({ hour: 12, minute: 0 });
    setEndTime({ hour: 18, minute: 0 });
  };

  // 快捷选择：晚上（当前日期 18:00 - 24:00）
  const handleSelectEvening = () => {
    const today = dayjs();
    setSelectedDates({ start: today, end: today });
    setStartTime({ hour: 18, minute: 0 });
    setEndTime({ hour: 24, minute: 0 });
  };

  return (
    <div 
      ref={containerRef} 
      className="unified-datetime-picker"
    >
      {/* 顶部预览区域 */}
      <div className="picker-preview-header">
        <div className="preview-time-display">
          <span className="preview-datetime">{renderPreviewContent().dateTime}</span>
          <div className="preview-arrow-section">
            {renderPreviewContent().duration && (
              <span className="duration-text">{renderPreviewContent().duration}</span>
            )}
            <svg className="arrow-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {renderPreviewContent().isCrossDay && (
            <span className="cross-day-badge">+{renderPreviewContent().dayDiff}</span>
          )}
        </div>
      </div>

      <div className="main-content">
        {/* 左侧日历 */}
        <div className="calendar-section">
          {/* 日历上方的快捷按钮 */}
          <div className="quick-buttons-container calendar-quick-buttons">
            <button className="quick-btn" onClick={handleSelectTomorrow}>明天</button>
            <button className="quick-btn" onClick={handleSelectThisWeek}>本周</button>
            <button className="quick-btn" onClick={handleSelectNextWeek}>下周</button>
          </div>
          
          <div className="calendar-header">
            <button className="month-nav-btn" onClick={handlePrevMonth}>‹</button>
            {isEditingMonth ? (
              <div className="month-edit-container">
                <input
                  type="number"
                  className="month-edit-input"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  placeholder="年"
                  min="1900"
                  max="2100"
                />
                <span className="month-edit-separator">年</span>
                <input
                  type="number"
                  className="month-edit-input"
                  value={editMonth}
                  onChange={(e) => setEditMonth(e.target.value)}
                  placeholder="月"
                  min="1"
                  max="12"
                />
                <span className="month-edit-separator">月</span>
                <button className="month-edit-btn confirm" onClick={handleMonthEditConfirm}>✓</button>
                <button className="month-edit-btn cancel" onClick={handleMonthEditCancel}>✕</button>
              </div>
            ) : (
              <span className="month-year" onClick={handleMonthClick}>
                {currentMonth.format('YYYY年 MM月')}
              </span>
            )}
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
            <button className="quick-btn" onClick={handleSelectMorning}>上午</button>
            <button className="quick-btn" onClick={handleSelectAfternoon}>下午</button>
            <button className="quick-btn" onClick={handleSelectEvening}>晚上</button>
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
              onChange={(hour) => hour === null ? setStartTime(null) : setStartTime({ hour, minute: startTime?.minute ?? 0 })}
              disabled={false}
            />
            <TimeColumn
              type="minute"
              value={startTime?.minute ?? null}
              onChange={(minute) => minute === null ? setStartTime(null) : setStartTime({ hour: startTime?.hour ?? 0, minute })}
              disabled={false}
            />
            <TimeColumn
              type="hour"
              value={endTime?.hour ?? null}
              onChange={(hour) => hour === null ? setEndTime(null) : setEndTime({ hour, minute: endTime?.minute ?? 0 })}
              disabled={false}
            />
            <TimeColumn
              type="minute"
              value={endTime?.minute ?? null}
              onChange={(minute) => minute === null ? setEndTime(null) : setEndTime({ hour: endTime?.hour ?? 0, minute })}
              disabled={false}
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