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
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}> = ({ type, value, onChange, disabled }) => {
  const max = type === 'hour' ? 23 : 59;
  const items = Array.from({ length: max + 1 }, (_, i) => i);
  
  const handleChange = (item: number) => {
    console.log(`⏰ [Time] ${type}: ${item}`);
    if (!disabled) {
      onChange(item);
    }
  };
  
  return (
    <div className={`time-column ${disabled ? 'disabled' : ''}`}>
      <div className="time-column-content">
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
  value: { hour: number; minute: number };
  onChange: (time: { hour: number; minute: number }) => void;
  title: string;
  disabled?: boolean;
}> = ({ value, onChange, title, disabled }) => {
  return (
    <div className={`time-selector ${disabled ? 'disabled' : ''}`}>
      <div className="time-selector-header">{title}</div>
      <div className="time-columns">
        <TimeColumn
          type="hour"
          value={value.hour}
          onChange={(hour) => onChange({ ...value, hour })}
          disabled={disabled}
        />
        <div className="time-separator">:</div>
        <TimeColumn
          type="minute"
          value={value.minute}
          onChange={(minute) => onChange({ ...value, minute })}
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
  const [startTime, setStartTime] = useState({ hour: 0, minute: 0 });
  const [endTime, setEndTime] = useState({ hour: 23, minute: 59 });
  const [hoverDate, setHoverDate] = useState<Dayjs | null>(null);
  const [isSelecting, setIsSelecting] = useState<'start' | 'end' | null>(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs());

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

  const handleApply = (e?: React.MouseEvent) => {
    console.log('✅ [Picker] Apply clicked');
    e?.stopPropagation();
    
    // 只在点击确定时才调用 onSelect
    if (selectedDates.start) {
      const startDateTime = selectedDates.start.hour(startTime.hour).minute(startTime.minute);
      const endDateTime = selectedDates.end 
        ? selectedDates.end.hour(endTime.hour).minute(endTime.minute)
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
    setStartTime({ hour: 0, minute: 0 });
    setEndTime({ hour: 23, minute: 59 });
    onSelect?.(null, null);
    onClose?.();
  };

  // 生成时间显示内容
  const renderTimeDisplay = () => {
    const hasStartTime = selectedDates.start;
    const hasEndTime = selectedDates.end;
    
    if (hasStartTime && hasEndTime) {
      // 两个时间都设置了
      const startDateTime = hasStartTime.hour(startTime.hour).minute(startTime.minute);
      const endDateTime = hasEndTime.hour(endTime.hour).minute(endTime.minute);
      const duration = calculateDuration(startDateTime, endDateTime);
      
      return (
        <div className="time-range-display">
          <span className="start-time">{startTime.hour.toString().padStart(2, '0')}:{startTime.minute.toString().padStart(2, '0')}</span>
          <div className="duration-arrow">
            <div className="duration-text">{duration}</div>
            <div className="arrow">→</div>
          </div>
          <span className="end-time">{endTime.hour.toString().padStart(2, '0')}:{endTime.minute.toString().padStart(2, '0')}</span>
        </div>
      );
    } else if (hasStartTime) {
      // 只设置了开始时间
      return (
        <div className="time-single-display">
          开始于 {startTime.hour.toString().padStart(2, '0')}:{startTime.minute.toString().padStart(2, '0')}
        </div>
      );
    } else if (hasEndTime) {
      // 只设置了结束时间
      return (
        <div className="time-single-display">
          结束于 {endTime.hour.toString().padStart(2, '0')}:{endTime.minute.toString().padStart(2, '0')}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div 
      ref={containerRef} 
      className="unified-datetime-picker"
    >
      <div className="picker-header">
        <h4>选择日期时间范围</h4>
        <button className="close-button" onClick={handleCancel}>×</button>
      </div>

      <div className="quick-select-section">
        <Space size="small" wrap>
          <Button size="small" onClick={() => handleQuickSelect(0)}>今天</Button>
          <Button size="small" onClick={() => handleQuickSelect(1)}>昨天</Button>
          <Button size="small" onClick={() => handleQuickSelect(7)}>最近7天</Button>
          <Button size="small" onClick={() => handleQuickSelect(30)}>最近30天</Button>
        </Space>
      </div>

      <div className="main-content">
        {/* 左侧日历 */}
        <div className="calendar-section">
          <div className="calendar-header">
            <button className="month-nav-btn" onClick={handlePrevMonth}>‹</button>
            <span className="month-year" onClick={handleToday} style={{ cursor: 'pointer' }}>
              {currentMonth.format('YYYY年 MM月')}
            </span>
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
          {/* 时间显示区域 */}
          {renderTimeDisplay()}
          
          <div className="time-selectors">
            <TimeSelector
              value={startTime}
              onChange={setStartTime}
              title="开始时间"
              disabled={false}
            />
            
            <TimeSelector
              value={endTime}
              onChange={setEndTime}
              title="结束时间"
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