import React, { useState } from 'react';
import { DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import './RangeTimePicker.css';

const { RangePicker } = DatePicker;

export interface RangeTimePickerProps {
  startTime?: string | null;
  endTime?: string | null;
  onStartChange: (time: string | null) => void;
  onEndChange: (time: string | null) => void;
  allowAllDay?: boolean;
  placeholder?: [string, string];
}

/**
 * 时间范围选择器组件
 * 基于 Ant Design RangePicker，支持开始/结束时间独立选择
 */
export const RangeTimePicker: React.FC<RangeTimePickerProps> = ({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  allowAllDay = true,
  placeholder = ['开始时间', '结束时间'],
}) => {
  const [isAllDay, setIsAllDay] = useState(false);

  // 将 string 转换为 Dayjs
  const startDayjs = startTime ? dayjs(startTime) : null;
  const endDayjs = endTime ? dayjs(endTime) : null;

  // 处理范围选择变化
  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates) {
      onStartChange(null);
      onEndChange(null);
      return;
    }

    const [start, end] = dates;
    
    if (start) {
      onStartChange(start.toISOString());
    } else {
      onStartChange(null);
    }

    if (end) {
      onEndChange(end.toISOString());
    } else {
      onEndChange(null);
    }
  };

  // 处理全天切换
  const handleAllDayToggle = (checked: boolean) => {
    setIsAllDay(checked);
    
    if (checked && startDayjs) {
      // 全天模式：设置时间为 00:00:00
      const startOfDay = startDayjs.startOf('day');
      const endOfDay = endDayjs ? endDayjs.endOf('day') : startOfDay.endOf('day');
      
      onStartChange(startOfDay.toISOString());
      onEndChange(endOfDay.toISOString());
    }
  };

  // 清除开始时间
  const handleClearStart = () => {
    onStartChange(null);
  };

  // 清除结束时间
  const handleClearEnd = () => {
    onEndChange(null);
  };

  return (
    <div className="range-time-picker">
      <div className="range-picker-header">
        {allowAllDay && (
          <label className="all-day-checkbox">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => handleAllDayToggle(e.target.checked)}
            />
            <span>全天</span>
          </label>
        )}
      </div>

      <div className="range-picker-content">
        <RangePicker
          value={[startDayjs, endDayjs]}
          onChange={handleRangeChange}
          showTime={!isAllDay}
          format={isAllDay ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'}
          placeholder={placeholder}
          style={{ width: '100%' }}
          allowClear={true}
        />
      </div>

      <div className="range-picker-actions">
        {startTime && (
          <button 
            className="clear-btn" 
            onClick={handleClearStart}
            title="清除开始时间"
          >
            清除开始
          </button>
        )}
        {endTime && (
          <button 
            className="clear-btn" 
            onClick={handleClearEnd}
            title="清除结束时间"
          >
            清除结束
          </button>
        )}
      </div>
    </div>
  );
};
