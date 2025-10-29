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
      const startStr = dates[0].format('YYYY-MM-DD HH:mm');
      const endStr = dates[1].format('YYYY-MM-DD HH:mm');
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
    
    const startStr = start.format('YYYY-MM-DD HH:mm');
    const endStr = end.format('YYYY-MM-DD HH:mm');
    onSelect?.(startStr, endStr);
  };

  const handleApply = () => {
    if (selectedRange && selectedRange[0] && selectedRange[1]) {
      const startStr = selectedRange[0].format('YYYY-MM-DD HH:mm');
      const endStr = selectedRange[1].format('YYYY-MM-DD HH:mm');
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
            format: 'HH:mm',
            defaultValue: [dayjs('00:00', 'HH:mm'), dayjs('23:59', 'HH:mm')],
            // 禁用时间面板的自动滚动动画
            disabledTime: undefined,
            hideDisabledOptions: false,
            // 减少滚动敏感度，防止误触
            scrollToFirstRowOnOpen: false
          }}
          format="YYYY-MM-DD HH:mm"
          placeholder={['开始时间', '结束时间']}
          style={{ width: '100%' }}
          // 禁用动画效果，提升性能
          transitionName=""
          getPopupContainer={(triggerNode) => {
            console.log('📅 Getting container for trigger:', triggerNode);
            
            // 尝试找到开始日期输入框的包装器
            const startInputWrapper = triggerNode?.querySelector('.ant-picker-input:first-child') as HTMLElement;
            if (startInputWrapper) {
              console.log('📅 Found start input wrapper, using it for positioning');
              return startInputWrapper;
            }
            
            // 如果触发元素是 RangePicker 本身，返回它的第一个输入区域
            if (triggerNode?.classList.contains('ant-picker-range')) {
              const firstInput = triggerNode.querySelector('.ant-picker-input') as HTMLElement;
              if (firstInput) {
                console.log('📅 Using first input area for positioning');
                return firstInput;
              }
              console.log('📅 Using range picker container');
              return triggerNode as HTMLElement;
            }
            
            // 查找最近的 picker content 容器
            const pickerContent = triggerNode?.closest('.picker-content');
            if (pickerContent) {
              console.log('📅 Using picker content as container');
              return pickerContent as HTMLElement;
            }
            
            console.log('📅 Fallback to component container');
            return containerRef.current || document.body;
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
                  
                  // 强制重置时间列的滚动位置和容器
                  const timeColumns = element.querySelectorAll('.ant-picker-time-panel-column');
                  timeColumns.forEach((column) => {
                    const col = column as HTMLElement;
                    
                    // 重置滚动位置
                    col.scrollTop = 0;
                    
                    // 强制设置容器样式
                    col.style.height = '192px';
                    col.style.maxHeight = '192px';
                    col.style.overflowY = 'auto';
                    col.style.padding = '0';
                    col.style.margin = '0';
                    
                    // 确保内容列表样式正确
                    const ul = col.querySelector('ul');
                    if (ul) {
                      (ul as HTMLElement).style.margin = '0';
                      (ul as HTMLElement).style.padding = '0';
                      (ul as HTMLElement).style.minHeight = 'auto';
                    }
                  });
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