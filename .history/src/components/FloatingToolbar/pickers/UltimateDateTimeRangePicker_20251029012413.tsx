import React, { useState, useRef, useEffect } from 'react';
import { DatePicker, Button, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;

interface UltimateDateTimeRangePickerProps {
  onSelect?: (start: string | null, end: string | null) => void;
  onClose?: () => void;
}

const UltimateDateTimeRangePicker: React.FC<UltimateDateTimeRangePickerProps> = ({
  onSelect,
  onClose
}) => {
  const [selectedRange, setSelectedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 🔥 全局劫持所有滚动相关方法
  useEffect(() => {
    // 劫持时间面板元素的滚动方法
    const hijackTimeColumns = () => {
      const timeColumns = document.querySelectorAll('.ant-picker-time-panel-column');
      
      timeColumns.forEach((col) => {
        const element = col as HTMLElement;
        
        // 🔥 安全地保存原始的 scrollTop descriptor
        const originalScrollTopDescriptor = Object.getOwnPropertyDescriptor(element, 'scrollTop') ||
                                            Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop') ||
                                            Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop');
        
        // 完全禁用所有滚动方法
        element.scrollTo = function() { 
          console.log('🚫 BLOCKED scrollTo'); 
          return;
        };
        element.scrollBy = function() { 
          console.log('🚫 BLOCKED scrollBy'); 
          return;
        };
        element.scrollIntoView = function() { 
          console.log('🚫 BLOCKED scrollIntoView'); 
          return;
        };
        
        // 🔥 安全地重写 scrollTop 属性，保持正确的 this 上下文
        try {
          Object.defineProperty(element, 'scrollTop', {
            get: function() {
              // 始终返回 0，表示在顶部
              return 0;
            },
            set: function(value: number) {
              console.log(`🚫 BLOCKED scrollTop set to ${value}, keeping at 0`);
              // 如果需要，可以调用原始的 setter 但强制设为 0
              if (originalScrollTopDescriptor && originalScrollTopDescriptor.set) {
                originalScrollTopDescriptor.set.call(this, 0);
              }
              return;
            },
            enumerable: true,
            configurable: true
          });
        } catch (error) {
          console.warn('Failed to override scrollTop:', error);
          // 降级方案：直接设置 scrollTop = 0
          element.scrollTop = 0;
        }
        
        // 强制样式
        element.style.scrollTop = '0px';
        element.style.scrollBehavior = 'auto';
        element.style.transition = 'none';
        element.style.animation = 'none';
        element.style.height = '216px';
        element.style.maxHeight = '216px';
        element.style.overflowY = 'auto';
        
        // 劫击所有单元格的scrollIntoView
        const cells = element.querySelectorAll('.ant-picker-time-panel-cell');
        cells.forEach((cell) => {
          (cell as HTMLElement).scrollIntoView = function() { 
            console.log('🚫 BLOCKED cell scrollIntoView'); 
            return;
          };
        });
      });
    };

    // 立即执行一次
    hijackTimeColumns();
    
    // 持续监控和劫持，但频率降低以避免性能问题
    const intervalId = setInterval(hijackTimeColumns, 100);
    
    // 清理函数
    return () => {
      clearInterval(intervalId);
    };
  }, []);

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

  const handleCancel = () => {
    setSelectedRange(null);
    onSelect?.(null, null);
    onClose?.();
  };

  return (
    <div ref={containerRef} className="simple-datetime-range-picker">
      <div className="picker-content">
        <RangePicker
          value={selectedRange}
          onChange={handleDateChange}
          showTime={{
            format: 'HH:mm',
            // 🔥 完全不设置任何默认值，避免自动滚动
            defaultValue: undefined,
            showNow: false,
            use12Hours: false,
            hideDisabledOptions: false,
          }}
          format="YYYY-MM-DD HH:mm"
          placeholder={['开始时间', '结束时间']}
          style={{ width: '100%' }}
          // 🔥 禁用所有动画和过渡效果
          transitionName=""
          dropdownClassName="ultimate-no-scroll-dropdown"
          // 🔥 不设置任何默认值
          defaultValue={undefined}
          allowClear={false}
          open={true}
          getPopupContainer={() => containerRef.current || document.body}
          popupClassName="ultimate-datetime-popup"
          onOpenChange={(open) => {
            if (open) {
              // 延迟执行，确保DOM已渲染
              setTimeout(() => {
                const timeColumns = document.querySelectorAll('.ant-picker-time-panel-column');
                timeColumns.forEach((col) => {
                  const element = col as HTMLElement;
                  
                  // 🔥 最温和的方法：只设置样式，不劫持属性
                  element.style.height = '216px';
                  element.style.maxHeight = '216px';
                  element.style.overflowY = 'auto';
                  element.style.scrollBehavior = 'auto';
                  element.style.transition = 'none !important';
                  element.style.animation = 'none !important';
                  
                  // 温和地重置滚动位置
                  try {
                    element.scrollTop = 0;
                  } catch (e) {
                    console.warn('Could not set scrollTop:', e);
                  }
                  
                  // 禁用单元格的 scrollIntoView（这个比较安全）
                  const cells = element.querySelectorAll('.ant-picker-time-panel-cell');
                  cells.forEach((cell) => {
                    const cellElement = cell as HTMLElement;
                    cellElement.scrollIntoView = function() { 
                      console.log('🚫 BLOCKED cell scrollIntoView'); 
                      return;
                    };
                  });
                });
              }, 0);
            }
          }}
        />
      </div>
      
      <div className="quick-select-buttons">
        <Space size="small" wrap>
          <Button size="small" onClick={() => handleQuickSelect(1)}>今天</Button>
          <Button size="small" onClick={() => handleQuickSelect(7)}>最近7天</Button>
          <Button size="small" onClick={() => handleQuickSelect(30)}>最近30天</Button>
        </Space>
      </div>
      
      <div className="action-buttons">
        <Space>
          <Button onClick={handleCancel}>取消</Button>
          <Button type="primary" onClick={handleApply}>确定</Button>
        </Space>
      </div>
    </div>
  );
};

export default UltimateDateTimeRangePicker;