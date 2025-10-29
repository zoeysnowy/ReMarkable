import React, { useState, useRef } from 'react';
import { DatePicker, Button, Space, TimePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;

interface PureDateTimeRangePickerProps {
  onSelect?: (start: string | null, end: string | null) => void;
  onClose?: () => void;
}

// 自定义简单时间选择器组件
const SimpleTimeSelector: React.FC<{
  value?: string;
  onChange?: (time: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [hour, setHour] = useState(value ? parseInt(value.split(':')[0]) : 0);
  const [minute, setMinute] = useState(value ? parseInt(value.split(':')[1]) : 0);

  const handleTimeChange = (newHour: number, newMinute: number) => {
    const timeStr = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`;
    onChange?.(timeStr);
  };

  const handleHourChange = (newHour: number) => {
    setHour(newHour);
    handleTimeChange(newHour, minute);
  };

  const handleMinuteChange = (newMinute: number) => {
    setMinute(newMinute);
    handleTimeChange(hour, newMinute);
  };

  return (
    <div className="simple-time-selector">
      <div className="time-input-group">
        <select 
          value={hour} 
          onChange={(e) => handleHourChange(parseInt(e.target.value))}
          className="time-select hour-select"
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>
              {i.toString().padStart(2, '0')}
            </option>
          ))}
        </select>
        <span className="time-separator">:</span>
        <select 
          value={minute} 
          onChange={(e) => handleMinuteChange(parseInt(e.target.value))}
          className="time-select minute-select"
        >
          {Array.from({ length: 60 }, (_, i) => (
            <option key={i} value={i}>
              {i.toString().padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

const PureDateTimeRangePicker: React.FC<PureDateTimeRangePickerProps> = ({
  onSelect,
  onClose
}) => {
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>('23:59');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleStartDateChange = (date: Dayjs | null) => {
    setStartDate(date);
    updateSelection(date, endDate, startTime, endTime);
  };

  const handleEndDateChange = (date: Dayjs | null) => {
    setEndDate(date);
    updateSelection(startDate, date, startTime, endTime);
  };

  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    updateSelection(startDate, endDate, time, endTime);
  };

  const handleEndTimeChange = (time: string) => {
    setEndTime(time);
    updateSelection(startDate, endDate, startTime, time);
  };

  const updateSelection = (sDate: Dayjs | null, eDate: Dayjs | null, sTime: string, eTime: string) => {
    if (sDate && eDate) {
      const [sHour, sMinute] = sTime.split(':').map(Number);
      const [eHour, eMinute] = eTime.split(':').map(Number);
      
      const startDateTime = sDate.hour(sHour).minute(sMinute);
      const endDateTime = eDate.hour(eHour).minute(eMinute);
      
      const startStr = startDateTime.format('YYYY-MM-DD HH:mm');
      const endStr = endDateTime.format('YYYY-MM-DD HH:mm');
      
      onSelect?.(startStr, endStr);
    }
  };

  const handleQuickSelect = (days: number) => {
    const end = dayjs();
    const start = end.subtract(days, 'day');
    
    setStartDate(start);
    setEndDate(end);
    setStartTime('00:00');
    setEndTime('23:59');
    
    const startStr = start.hour(0).minute(0).format('YYYY-MM-DD HH:mm');
    const endStr = end.hour(23).minute(59).format('YYYY-MM-DD HH:mm');
    onSelect?.(startStr, endStr);
  };

  const handleApply = () => {
    onClose?.();
  };

  const handleCancel = () => {
    setStartDate(null);
    setEndDate(null);
    setStartTime('00:00');
    setEndTime('23:59');
    onSelect?.(null, null);
    onClose?.();
  };

  return (
    <div ref={containerRef} className="pure-datetime-range-picker">
      <div className="picker-header">
        <h4>选择日期时间范围</h4>
        <button className="close-button" onClick={handleCancel}>×</button>
      </div>
      
      <div className="quick-select-section">
        <div className="quick-select-buttons">
          <Button size="small" onClick={() => handleQuickSelect(1)}>今天</Button>
          <Button size="small" onClick={() => handleQuickSelect(7)}>最近7天</Button>
          <Button size="small" onClick={() => handleQuickSelect(30)}>最近30天</Button>
        </div>
      </div>

      <div className="date-time-selection">
        <div className="datetime-row">
          <div className="datetime-item">
            <label>开始日期</label>
            <DatePicker
              value={startDate}
              onChange={handleStartDateChange}
              placeholder="选择开始日期"
              style={{ width: '140px' }}
              format="YYYY-MM-DD"
            />
          </div>
          <div className="datetime-item">
            <label>开始时间</label>
            <SimpleTimeSelector
              value={startTime}
              onChange={handleStartTimeChange}
              placeholder="开始时间"
            />
          </div>
        </div>

        <div className="datetime-row">
          <div className="datetime-item">
            <label>结束日期</label>
            <DatePicker
              value={endDate}
              onChange={handleEndDateChange}
              placeholder="选择结束日期"
              style={{ width: '140px' }}
              format="YYYY-MM-DD"
            />
          </div>
          <div className="datetime-item">
            <label>结束时间</label>
            <SimpleTimeSelector
              value={endTime}
              onChange={handleEndTimeChange}
              placeholder="结束时间"
            />
          </div>
        </div>
      </div>

      <div className="selection-preview">
        {startDate && endDate && (
          <div className="preview-text">
            <span className="preview-label">已选择：</span>
            <span className="preview-value">
              {startDate.format('YYYY-MM-DD')} {startTime} - {endDate.format('YYYY-MM-DD')} {endTime}
            </span>
          </div>
        )}
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

export default PureDateTimeRangePicker;