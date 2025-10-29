/**
 * DateRangePicker - 日期范围选择器
 */

import React, { useState } from 'react';
import './DateRangePicker.css';

interface DateRangePickerProps {
  onSelect: (startDate: Date, endDate: Date) => void;
  onClose: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  onSelect,
  onClose,
}) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [includeTime, setIncludeTime] = useState(false);

  const handleConfirm = () => {
    if (startDate) {
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : start;
      onSelect(start, end);
    }
  };

  // 快捷选择
  const quickSelects = [
    { label: '今天', days: 0 },
    { label: '明天', days: 1 },
    { label: '本周', days: 7 },
    { label: '下周', days: 14 },
    { label: '本月', days: 30 },
  ];

  const handleQuickSelect = (days: number) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="date-range-picker-panel">
      <div className="picker-header">
        <span className="picker-title">选择日期</span>
        <button className="picker-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* 快捷选择 */}
      <div className="quick-selects">
        {quickSelects.map((item) => (
          <button
            key={item.label}
            className="quick-select-btn"
            onClick={() => handleQuickSelect(item.days)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 日期输入 */}
      <div className="date-inputs">
        <div className="date-input-group">
          <label>开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="date-input-group">
          <label>结束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* 包含时间选项 */}
      <div className="date-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={includeTime}
            onChange={(e) => setIncludeTime(e.target.checked)}
          />
          <span>包含具体时间</span>
        </label>
      </div>

      {/* 确认按钮 */}
      <div className="picker-footer">
        <button className="picker-cancel-btn" onClick={onClose}>
          取消
        </button>
        <button
          className="picker-confirm-btn"
          onClick={handleConfirm}
          disabled={!startDate}
        >
          确认
        </button>
      </div>
    </div>
  );
};
