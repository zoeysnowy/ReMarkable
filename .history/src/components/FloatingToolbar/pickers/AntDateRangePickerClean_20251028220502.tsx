import React, { useState } from 'react';
import { DatePicker, Button } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;

interface AntDateRangePickerProps {
  onSelect?: (start: string | null, end: string | null) => void;
  onClose?: () => void;
}

const AntDateRangePicker: React.FC<AntDateRangePickerProps> = ({
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

  return (
    <div className="ant-date-range-picker-wrapper">
      <div className="date-range-header">
        <h4>选择日期</h4>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      <div className="date-range-content">
        <RangePicker
          value={[selectedStartDate, selectedEndDate]}
          onChange={handleDateChange}
          placeholder={['开始日期', '结束日期']}
          getPopupContainer={() => document.body}
          popupClassName="ant-picker-dropdown-custom"
          style={{ 
            width: '100%',
            fontSize: '14px'
          }}
          renderExtraFooter={() => (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Button type="primary" size="small" onClick={handleApply}>
                确定
              </Button>
            </div>
          )}
        />
      </div>
    </div>
  );
};

export default AntDateRangePicker;