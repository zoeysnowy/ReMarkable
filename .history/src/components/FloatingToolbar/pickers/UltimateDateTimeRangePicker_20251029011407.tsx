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
    const originalScrollTo = Element.prototype.scrollTo;
    const originalScrollBy = Element.prototype.scrollBy;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const originalSetAttribute = Element.prototype.setAttribute;

    // 劫持所有时间面板元素的滚动方法
    const hijackTimeColumns = () => {
      const timeColumns = document.querySelectorAll('.ant-picker-time-panel-column');
      
      timeColumns.forEach((col) => {
        const element = col as HTMLElement;
        
        // 完全禁用所有滚动方法
        element.scrollTo = () => { console.log('🚫 BLOCKED scrollTo'); };
        element.scrollBy = () => { console.log('🚫 BLOCKED scrollBy'); };
        element.scrollIntoView = () => { console.log('🚫 BLOCKED scrollIntoView'); };
        
        // 劫持 scrollTop 属性
        let currentScrollTop = 0;
        Object.defineProperty(element, 'scrollTop', {
          get: () => currentScrollTop,
          set: (value: number) => {
            console.log(`🚫 BLOCKED scrollTop set to ${value}, keeping at 0`);
            currentScrollTop = 0;
            // 强制DOM保持在0位置
            element.style.scrollBehavior = 'auto';
            HTMLElement.prototype.scrollTop = 0;
          },
          enumerable: true,
          configurable: true
        });
        
        // 强制样式
        element.style.scrollTop = '0px';
        element.style.scrollBehavior = 'auto';
        element.style.transition = 'none';
        element.style.animation = 'none';
        
        // 劫击所有单元格的scrollIntoView
        const cells = element.querySelectorAll('.ant-picker-time-panel-cell');
        cells.forEach((cell) => {
          (cell as HTMLElement).scrollIntoView = () => { 
            console.log('🚫 BLOCKED cell scrollIntoView'); 
          };
        });
      });
    };

    // 持续监控和劫持
    const intervalId = setInterval(hijackTimeColumns, 50);
    
    // 清理函数
    return () => {
      clearInterval(intervalId);
      Element.prototype.scrollTo = originalScrollTo;
      Element.prototype.scrollBy = originalScrollBy;
      Element.prototype.scrollIntoView = originalScrollIntoView;
      Element.prototype.setAttribute = originalSetAttribute;
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
                  
                  // 🔥 最激进的方法：完全重写元素的行为
                  element.style.height = '216px';
                  element.style.maxHeight = '216px';
                  element.style.overflowY = 'auto';
                  element.style.scrollBehavior = 'auto';
                  element.style.transition = 'none !important';
                  element.style.animation = 'none !important';
                  
                  // 强制DOM保持在顶部
                  element.scrollTop = 0;
                  
                  // 禁用所有可能的滚动方法
                  Object.defineProperty(element, 'scrollTop', {
                    value: 0,
                    writable: false,
                    enumerable: true,
                    configurable: false
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