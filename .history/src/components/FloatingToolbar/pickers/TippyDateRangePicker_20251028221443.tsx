import React, { useState } from 'react';
import { DatePicker, Button } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;

interface TippyDateRangePickerProps {
  onSelect?: (start: string | null, end: string | null) => void;
  onClose?: () => void;
}

const TippyDateRangePicker: React.FC<TippyDateRangePickerProps> = ({
  onSelect,
  onClose
}) => {
  const [selectedStartDate, setSelectedStartDate] = useState<Dayjs | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Dayjs | null>(null);

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates) {
      const [start, end] = dates;
      setSelectedStartDate(start);
      setSelectedEndDate(end);
      
      // 如果两个日期都选择了，立即应用
      if (start && end) {
        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');
        onSelect?.(startStr, endStr);
      }
    } else {
      setSelectedStartDate(null);
      setSelectedEndDate(null);
      onSelect?.(null, null);
    }
  };

  const handleApply = () => {
    if (selectedStartDate && selectedEndDate) {
      const startStr = selectedStartDate.format('YYYY-MM-DD');
      const endStr = selectedEndDate.format('YYYY-MM-DD');
      onSelect?.(startStr, endStr);
    }
    onClose?.();
  };

  const handleCancel = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
    onClose?.();
  };

  // 快捷日期选择
  const handleQuickSelect = (days: number) => {
    const end = dayjs();
    const start = end.subtract(days, 'day');
    setSelectedStartDate(start);
    setSelectedEndDate(end);
    
    const startStr = start.format('YYYY-MM-DD');
    const endStr = end.format('YYYY-MM-DD');
    onSelect?.(startStr, endStr);
  };

  return (
    <div className="tippy-date-range-picker">
      <div className="date-range-header">
        <h4>选择日期</h4>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      {/* 快捷选择按钮 */}
      <div className="quick-select-buttons">
        <button onClick={() => handleQuickSelect(0)} className="quick-btn">今天</button>
        <button onClick={() => handleQuickSelect(1)} className="quick-btn">昨天</button>
        <button onClick={() => handleQuickSelect(7)} className="quick-btn">本周</button>
        <button onClick={() => handleQuickSelect(30)} className="quick-btn">本月</button>
        <button onClick={() => handleQuickSelect(90)} className="quick-btn">下月</button>
      </div>
      
      <div className="date-range-content">
        <RangePicker
          value={[selectedStartDate, selectedEndDate]}
          onChange={handleDateChange}
          placeholder={['开始日期', '结束日期']}
          getPopupContainer={() => document.body}
          popupClassName="ant-picker-dropdown-in-tippy"
          style={{ 
            width: '100%',
            fontSize: '14px'
          }}
          format="YYYY-MM-DD"
          allowClear
        />
      </div>
      
      <div className="date-range-actions">
        <Button onClick={handleCancel} size="small">
          取消
        </Button>
        <Button 
          type="primary" 
          onClick={handleApply} 
          size="small"
          disabled={!selectedStartDate || !selectedEndDate}
        >
          确定
        </Button>
      </div>
    </div>
  );
};

export default TippyDateRangePicker;