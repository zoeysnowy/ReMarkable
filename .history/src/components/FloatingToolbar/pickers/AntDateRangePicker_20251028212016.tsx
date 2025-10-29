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
          style={{ width: '100%' }}
          size="middle"
          open={undefined}
          getPopupContainer={(triggerNode) => {
            // 让弹出面板挂载到 body，避免被父容器限制
            return document.body;
          }}
          dropdownClassName="headless-date-picker-dropdown"
          locale={{
            lang: {
              locale: 'zh_CN',
              yearFormat: 'YYYY年',
              dayFormat: 'D日',
              dateFormat: 'YYYY年M月D日',
              dateTimeFormat: 'YYYY年M月D日 HH时mm分ss秒',
              monthFormat: 'YYYY年M月',
              yearSelect: '选择年份',
              monthSelect: '选择月份',
              yearBeforeMonth: true,
              previousMonth: '上个月 (翻页上键)',
              nextMonth: '下个月 (翻页下键)',
              previousYear: '上一年 (Control键加左方向键)',
              nextYear: '下一年 (Control键加右方向键)',
              previousDecade: '上一年代',
              nextDecade: '下一年代',
              previousCentury: '上一世纪',
              nextCentury: '下一世纪',
            },
            timePickerLocale: {
              placeholder: '请选择时间',
              rangePlaceholder: ['开始时间', '结束时间'],
            },
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