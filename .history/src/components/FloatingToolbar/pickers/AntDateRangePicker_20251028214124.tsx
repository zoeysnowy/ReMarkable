/**
 * AntDateRangePicker - 基于 Ant Design 的日期范围选择器
 */

import React, { useState } from 'react';
import { DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import './DateRangePicker.css';

const { RangePicker } = DatePicker;

interface AntDateRangePickerProps {
  onSelect: (startDate: Date, endDate: Date) => void;
  onClose: () => void;
}

export const AntDateRangePicker: React.FC<AntDateRangePickerProps> = ({
  onSelect,
  onClose,
}) => {
  const [includeTime, setIncludeTime] = useState(false);

  console.log('🔧 AntDateRangePicker rendered');

  // 快捷选择选项
  const rangePresets = [
    {
      label: '今天',
      value: [dayjs(), dayjs()] as [Dayjs, Dayjs],
    },
    {
      label: '明天',
      value: [dayjs().add(1, 'day'), dayjs().add(1, 'day')] as [Dayjs, Dayjs],
    },
    {
      label: '本周',
      value: [dayjs().startOf('week'), dayjs().endOf('week')] as [Dayjs, Dayjs],
    },
  ];

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    console.log('📅 Range changed:', dates);
    if (dates && dates[0] && dates[1]) {
      onSelect(dates[0].toDate(), dates[1].toDate());
    }
  };

  return (
    <div className="date-range-picker-panel">
      <div className="picker-header">
        <span className="picker-title">选择日期</span>
        <button className="picker-close-btn" onClick={onClose}>
          ×
        </button>
      </div>
      
      {/* 快捷选择按钮 */}
      <div className="date-shortcuts">
        {rangePresets.map((preset) => (
          <button
            key={preset.label}
            className="shortcut-btn"
            onClick={() => handleRangeChange(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Ant Design RangePicker */}
      <div className="range-picker-container">
        <RangePicker
          placeholder={['开始日期', '结束日期']}
          onChange={handleRangeChange}
          onOpenChange={(open) => {
            console.log('📅 RangePicker open state changed:', open);
          }}
          style={{ width: '100%' }}
          size="middle"
          getPopupContainer={() => document.body}
          popupStyle={{
            zIndex: 10003
          }}
        />
      </div>

      {/* 包含时间选项 */}
      <div className="picker-options">
        <label className="include-time-checkbox">
          <input
            type="checkbox"
            checked={includeTime}
            onChange={(e) => setIncludeTime(e.target.checked)}
          />
          包含具体时间
        </label>
      </div>

      <div className="picker-footer">
        <button className="picker-cancel-btn" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  );
};