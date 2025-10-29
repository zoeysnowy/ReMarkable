import React, { useState, useEffect, useRef } from 'react';
import { DatePicker, Button, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;

interface SimpleDateTimeRangePickerProps {
  onSelect?: (start: string | null, end: string | null) => void;
  onClose?: () => void;
}

const SimpleDateTimeRangePicker: React.FC<SimpleDateTimeRangePickerProps> = ({
  onSelect,
  onClose
}) => {
  const [selectedRange, setSelectedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setSelectedRange(dates);
    
    if (dates && dates[0] && dates[1]) {
      const startStr = dates[0].format('YYYY-MM-DD HH:mm:ss');
      const endStr = dates[1].format('YYYY-MM-DD HH:mm:ss');
      onSelect?.(startStr, endStr);
    } else {
      onSelect?.(null, null);
    }
  };

  const handleQuickSelect = (days: number) => {
    const end = dayjs();
    const start = end.subtract(days, 'day');
    const range: [Dayjs, Dayjs] = [start, end];
    setSelectedRange(range);
    
    const startStr = start.format('YYYY-MM-DD HH:mm:ss');
    const endStr = end.format('YYYY-MM-DD HH:mm:ss');
    onSelect?.(startStr, endStr);
  };

  const handleApply = () => {
    if (selectedRange && selectedRange[0] && selectedRange[1]) {
      const startStr = selectedRange[0].format('YYYY-MM-DD HH:mm:ss');
      const endStr = selectedRange[1].format('YYYY-MM-DD HH:mm:ss');
      onSelect?.(startStr, endStr);
    }
    onClose?.();
  };

  return (
    <div className="simple-datetime-range-picker">
      <div className="picker-header">
        <h4>选择日期时间</h4>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      {/* 快捷选择按钮 */}
      <div className="quick-select-buttons">
        <button onClick={() => handleQuickSelect(0)} className="quick-btn">今天</button>
        <button onClick={() => handleQuickSelect(1)} className="quick-btn">昨天</button>
        <button onClick={() => handleQuickSelect(7)} className="quick-btn">本周</button>
        <button onClick={() => handleQuickSelect(30)} className="quick-btn">本月</button>
      </div>
      
      <div className="picker-content" ref={pickerRef}>
        <RangePicker
          value={selectedRange}
          onChange={handleDateChange}
          showTime={{
            format: 'HH:mm:ss',
            defaultValue: [dayjs('00:00:00', 'HH:mm:ss'), dayjs('23:59:59', 'HH:mm:ss')]
          }}
          format="YYYY-MM-DD HH:mm:ss"
          placeholder={['开始时间', '结束时间']}
          style={{ width: '100%' }}
          getPopupContainer={() => {
            // 优先使用我们创建的 portal 容器
            const portalContainer = document.getElementById('datetime-picker-portal');
            if (portalContainer) {
              console.log('📅 Using portal container for popup');
              return portalContainer;
            }
            console.log('📅 Fallback to document.body');
            return document.body;
          }}
          popupClassName="datetime-range-popup"
          open={undefined} // 让 Ant Design 自己控制开关
          onOpenChange={(open) => {
            console.log('📅 Picker open state changed:', open);
            if (open) {
              // 当日历打开时，强制检查和显示
              setTimeout(() => {
                const portalContainer = document.getElementById('datetime-picker-portal');
                const dropdowns = portalContainer?.querySelectorAll('.ant-picker-dropdown') || 
                                document.querySelectorAll('.datetime-range-popup');
                
                console.log('📅 Portal container:', portalContainer);
                console.log('📅 Found dropdowns in portal:', dropdowns.length);
                
                dropdowns.forEach((dropdown, index) => {
                  const element = dropdown as HTMLElement;
                  console.log(`📅 Dropdown ${index}:`, {
                    element,
                    display: window.getComputedStyle(element).display,
                    visibility: window.getComputedStyle(element).visibility,
                    opacity: window.getComputedStyle(element).opacity,
                    position: window.getComputedStyle(element).position,
                    zIndex: window.getComputedStyle(element).zIndex,
                  });
                  
                  // 强制显示
                  element.style.display = 'block';
                  element.style.visibility = 'visible';
                  element.style.opacity = '1';
                  element.style.pointerEvents = 'auto';
                  element.style.zIndex = '100005';
                  
                  // 移除可能的隐藏类
                  element.classList.remove('ant-picker-dropdown-hidden');
                  
                  console.log(`📅 After forced styling dropdown ${index}:`, {
                    display: element.style.display,
                    visibility: element.style.visibility,
                    opacity: element.style.opacity,
                    zIndex: element.style.zIndex,
                  });
                });
                
                // 如果还是没有找到，检查全局
                if (dropdowns.length === 0) {
                  const globalDropdowns = document.querySelectorAll('.ant-picker-dropdown');
                  console.log('📅 Found global dropdowns:', globalDropdowns.length);
                  globalDropdowns.forEach((dropdown, index) => {
                    const element = dropdown as HTMLElement;
                    console.log(`📅 Global dropdown ${index}:`, element, window.getComputedStyle(element));
                  });
                }
              }, 100);
            }
          }}
        />
      </div>
      
      <div className="picker-actions">
        <Space>
          <Button onClick={onClose} size="small">
            取消
          </Button>
          <Button 
            type="primary" 
            onClick={handleApply} 
            size="small"
            disabled={!selectedRange || !selectedRange[0] || !selectedRange[1]}
          >
            确定
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default SimpleDateTimeRangePicker;