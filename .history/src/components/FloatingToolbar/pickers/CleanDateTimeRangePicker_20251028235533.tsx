import React, { useState, useRef } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div className="simple-datetime-range-picker" ref={containerRef}>
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
      
      <div className="picker-content">
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
          getPopupContainer={(triggerNode) => {
            // 让日历弹窗在当前的 Tippy 容器内显示
            console.log('📅 Getting container for trigger:', triggerNode);
            
            // 查找 Tippy 内容容器
            const tippyContent = triggerNode?.closest('.headless-date-tippy-content');
            if (tippyContent) {
              console.log('📅 Using tippy content as container');
              return tippyContent as HTMLElement;
            }
            
            // 查找当前组件容器
            if (containerRef.current) {
              console.log('📅 Using component container');
              return containerRef.current;
            }
            
            console.log('📅 Fallback to document.body');
            return document.body;
          }}
          popupClassName="datetime-range-popup-in-tippy"
          onOpenChange={(open) => {
            console.log('📅 DatePicker open changed:', open);
            if (open) {
              // 移除强制定位，让CSS控制位置
              setTimeout(() => {
                const allDropdowns = document.querySelectorAll('.datetime-range-popup-in-tippy');
                console.log('📅 Found themed dropdowns:', allDropdowns.length);
                
                allDropdowns.forEach((dropdown, index) => {
                  const element = dropdown as HTMLElement;
                  console.log(`📅 Dropdown ${index} classes:`, element.className);
                  
                  // 只移除隐藏类，不强制设置位置
                  element.classList.remove('ant-picker-dropdown-hidden', 'ant-slide-up-leave', 'ant-slide-up-leave-active');
                  element.classList.add('ant-slide-up-enter-active');
                });
              }, 10);
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