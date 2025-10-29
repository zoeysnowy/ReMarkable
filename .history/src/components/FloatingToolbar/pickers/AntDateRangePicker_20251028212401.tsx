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
    {
      label: '下周',
      value: [dayjs().add(1, 'week').startOf('week'), dayjs().add(1, 'week').endOf('week')] as [Dayjs, Dayjs],
    },
    {
      label: '本月',
      value: [dayjs().startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs],
    },
  ];

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
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
          showTime={includeTime}
          format={includeTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'}
          placeholder={['开始日期', '结束日期']}
          onChange={handleRangeChange}
          onClick={handlePickerClick}
          style={{ width: '100%' }}
          size="middle"
          open={undefined}
          getPopupContainer={(triggerNode) => {
            // 让弹出面板挂载到 body，避免被父容器限制
            return document.body;
          }}
          classNames={{
            popup: {
              root: 'headless-date-picker-dropdown'
            }
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