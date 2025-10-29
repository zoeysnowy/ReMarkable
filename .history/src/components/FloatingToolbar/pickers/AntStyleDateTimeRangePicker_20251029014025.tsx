import React, { useState, useRef, useMemo } from 'react';
import { Button, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

interface AntStyleDateTimeRangePickerProps {
  onSelect?: (start: string | null, end: string | null) => void;
  onClose?: () => void;
}

// 计算时长显示
const calculateDuration = (start: Dayjs, end: Dayjs): string => {
  const diffMs = end.diff(start);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    if (diffHours > 0) {
      return `${diffDays}D${diffHours}h`;
    }
    return `${diffDays}D`;
  } else if (diffHours > 0) {
    if (diffMinutes > 0) {
      return `${diffHours}h${diffMinutes}m`;
    }
    return `${diffHours}h`;
  } else {
    return `${diffMinutes}m`;
  }
};

// 自定义时间选择器组件（无滚动动画）
const NoScrollTimeColumn: React.FC<{
  type: 'hour' | 'minute';
  value: number;
  onChange: (value: number) => void;
  selectedTime?: string;
}> = ({ type, value, onChange, selectedTime }) => {
  const range = type === 'hour' ? 24 : 60;
  const items = Array.from({ length: range }, (_, i) => i);

  return (
    <div className="time-column">
      {selectedTime && (
        <div className="time-column-header">
          {selectedTime}
        </div>
      )}
      <div className="time-column-list">
        {items.map((item) => (
          <div
            key={item}
            className={`time-column-item ${item === value ? 'selected' : ''}`}
            onClick={() => onChange(item)}
          >
            {item.toString().padStart(2, '0')}
          </div>
        ))}
      </div>
    </div>
  );
};

const AntStyleDateTimeRangePicker: React.FC<AntStyleDateTimeRangePickerProps> = ({
  onSelect,
  onClose
}) => {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [startHour, setStartHour] = useState(0);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(23);
  const [endMinute, setEndMinute] = useState(59);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // 生成日历网格
  const calendarDays = useMemo(() => {
    const firstDay = currentMonth.startOf('month');
    const lastDay = currentMonth.endOf('month');
    const startWeek = firstDay.startOf('week');
    const endWeek = lastDay.endOf('week');

    const days = [];
    let current = startWeek;

    while (current.isBefore(endWeek) || current.isSame(endWeek, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }

    return days;
  }, [currentMonth]);

  // 处理日期点击
  const handleDateClick = (date: Dayjs) => {
    if (!startDate || (startDate && endDate) || date.isBefore(startDate)) {
      // 开始新的选择
      setStartDate(date);
      setEndDate(null);
      setIsSelectingEnd(false);
    } else if (startDate && !endDate) {
      // 选择结束日期
      setEndDate(date);
      setIsSelectingEnd(true);
    }
  };

  // 获取日期样式类
  const getDateClass = (date: Dayjs) => {
    const classes = ['calendar-date'];
    
    if (!date.isSame(currentMonth, 'month')) {
      classes.push('other-month');
    }
    
    if (date.isSame(dayjs(), 'day')) {
      classes.push('today');
    }
    
    if (startDate && date.isSame(startDate, 'day')) {
      classes.push('range-start');
    }
    
    if (endDate && date.isSame(endDate, 'day')) {
      classes.push('range-end');
    }
    
    if (startDate && endDate && date.isAfter(startDate) && date.isBefore(endDate)) {
      classes.push('in-range');
    }
    
    return classes.join(' ');
  };

  // 更新选择结果
  const updateSelection = () => {
    if (startDate && endDate) {
      const startDateTime = startDate.hour(startHour).minute(startMinute);
      const endDateTime = endDate.hour(endHour).minute(endMinute);
      
      const startStr = startDateTime.format('YYYY-MM-DD HH:mm');
      const endStr = endDateTime.format('YYYY-MM-DD HH:mm');
      
      onSelect?.(startStr, endStr);
    }
  };

  // 处理时间变化
  const handleTimeChange = (type: 'start' | 'end', timeType: 'hour' | 'minute', value: number) => {
    if (type === 'start') {
      if (timeType === 'hour') {
        setStartHour(value);
      } else {
        setStartMinute(value);
      }
    } else {
      if (timeType === 'hour') {
        setEndHour(value);
      } else {
        setEndMinute(value);
      }
    }
    
    // 延迟更新选择结果
    setTimeout(updateSelection, 0);
  };

  const duration = startDate && endDate ? calculateDuration(
    startDate.hour(startHour).minute(startMinute),
    endDate.hour(endHour).minute(endMinute)
  ) : '';

  const handleApply = () => {
    updateSelection();
    onClose?.();
  };

  const handleCancel = () => {
    setStartDate(null);
    setEndDate(null);
    onSelect?.(null, null);
    onClose?.();
  };

  return (
    <div ref={containerRef} className="ant-style-datetime-picker">
      <div className="picker-header">
        <h4>选择日期时间范围</h4>
        <button className="close-button" onClick={handleCancel}>×</button>
      </div>

      <div className="picker-content">
        {/* 日历头部 */}
        <div className="calendar-header">
          <button 
            className="nav-button"
            onClick={() => setCurrentMonth(currentMonth.subtract(1, 'year'))}
          >
            ❮❮
          </button>
          <button 
            className="nav-button"
            onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
          >
            ❮
          </button>
          <div className="month-year">
            {currentMonth.format('YYYY年 M月')}
          </div>
          <button 
            className="nav-button"
            onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
          >
            ❯
          </button>
          <button 
            className="nav-button"
            onClick={() => setCurrentMonth(currentMonth.add(1, 'year'))}
          >
            ❯❯
          </button>
        </div>

        {/* 星期标题 */}
        <div className="calendar-weekdays">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="calendar-grid">
          {calendarDays.map((date, index) => (
            <div
              key={index}
              className={getDateClass(date)}
              onClick={() => handleDateClick(date)}
            >
              {date.date()}
            </div>
          ))}
        </div>

        {/* 时间选择区域 */}
        {startDate && (
          <div className="time-selection-area">
            <div className="time-panels">
              {/* 开始时间 */}
              <div className="time-panel start-time">
                <div className="time-panel-header">开始时间</div>
                <div className="time-columns">
                  <NoScrollTimeColumn
                    type="hour"
                    value={startHour}
                    onChange={(value) => handleTimeChange('start', 'hour', value)}
                    selectedTime={`${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`}
                  />
                  <NoScrollTimeColumn
                    type="minute"
                    value={startMinute}
                    onChange={(value) => handleTimeChange('start', 'minute', value)}
                  />
                </div>
              </div>

              {/* 时长显示箭头 */}
              {endDate && (
                <div className="duration-arrow">
                  <div className="duration-text">{duration}</div>
                  <div className="arrow">→</div>
                </div>
              )}

              {/* 结束时间 */}
              {endDate && (
                <div className="time-panel end-time">
                  <div className="time-panel-header">结束时间</div>
                  <div className="time-columns">
                    <NoScrollTimeColumn
                      type="hour"
                      value={endHour}
                      onChange={(value) => handleTimeChange('end', 'hour', value)}
                      selectedTime={`${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`}
                    />
                    <NoScrollTimeColumn
                      type="minute"
                      value={endMinute}
                      onChange={(value) => handleTimeChange('end', 'minute', value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="picker-footer">
        <Space>
          <Button onClick={handleCancel}>取消</Button>
          <Button type="primary" onClick={handleApply} disabled={!startDate || !endDate}>
            确定
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default AntStyleDateTimeRangePicker;