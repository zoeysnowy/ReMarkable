/**
 * SimpleDatePicker - 简单的日期选择器测试
 */

import React from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface SimpleDatePickerProps {
  onSelect: (start: Date, end: Date) => void;
  onClose: () => void;
}

export const SimpleDatePicker: React.FC<SimpleDatePickerProps> = ({
  onSelect,
  onClose,
}) => {
  console.log('🆕 SimpleDatePicker rendered');

  return (
    <div style={{ 
      padding: '20px', 
      background: 'white', 
      border: '2px solid blue',
      borderRadius: '8px',
      minWidth: '400px'
    }}>
      <h3>简单日期选择器测试</h3>
      
      <div style={{ marginBottom: '16px' }}>
        <RangePicker
          placeholder={['开始日期', '结束日期']}
          onChange={(dates) => {
            console.log('🆕 Simple picker dates changed:', dates);
            if (dates && dates[0] && dates[1]) {
              onSelect(dates[0].toDate(), dates[1].toDate());
            }
          }}
          onOpenChange={(open) => {
            console.log('🆕 Simple picker open changed:', open);
          }}
          style={{ width: '100%' }}
          size="large"
        />
      </div>
      
      <div style={{ textAlign: 'right' }}>
        <button 
          onClick={onClose}
          style={{
            padding: '8px 16px',
            background: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          关闭
        </button>
      </div>
    </div>
  );
};