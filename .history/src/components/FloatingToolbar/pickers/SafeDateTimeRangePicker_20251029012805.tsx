import React, { useState, useRef, useEffect } from 'react';
import { DatePicker, Button, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;

interface SafeDateTimeRangePickerProps {
  onSelect?: (start: string | null, end: string | null) => void;
  onClose?: () => void;
}

const SafeDateTimeRangePicker: React.FC<SafeDateTimeRangePickerProps> = ({
  onSelect,
  onClose
}) => {
  const [selectedRange, setSelectedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 🔥 最安全的方法：只在关键时刻重置滚动位置
  useEffect(() => {
    const resetTimeColumnsScroll = () => {
      const timeColumns = document.querySelectorAll('.ant-picker-time-panel-column');
      
      timeColumns.forEach((col) => {
        const element = col as HTMLElement;
        
        // 温和地重置到顶部，不破坏原有功能
        if (element.scrollTop > 0) {
          console.log(`📅 Gently resetting scroll from ${element.scrollTop} to 0`);
          element.scrollTop = 0;
        }
        
        // 只设置必要的样式
        element.style.height = '216px';
        element.style.maxHeight = '216px';
        element.style.scrollBehavior = 'auto';
        element.style.transition = 'none';
        element.style.animation = 'none';
        
        // 温和地禁用单元格的 scrollIntoView
        const cells = element.querySelectorAll('.ant-picker-time-panel-cell');
        cells.forEach((cell) => {
          const cellElement = cell as HTMLElement;
          // 保存原始方法，然后重写
          const originalScrollIntoView = cellElement.scrollIntoView;
          cellElement.scrollIntoView = function(...args) {
            console.log('📅 Intercepted scrollIntoView, ignoring');
            // 不调用原始方法，静默忽略
          };
        });
      });
    };

    // 每隔短时间检查一次，但不过度干预
    const intervalId = setInterval(resetTimeColumnsScroll, 200);
    
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
    <div ref={containerRef} className="safe-datetime-range-picker">
      <div className="picker-content">
        <RangePicker
          value={selectedRange}
          onChange={handleDateChange}
          showTime={{
            format: 'HH:mm',
            // 🔥 关键：不设置任何默认值
            defaultValue: undefined,
            showNow: false,
            use12Hours: false,
            hideDisabledOptions: false,
          }}
          format="YYYY-MM-DD HH:mm"
          placeholder={['开始时间', '结束时间']}
          style={{ width: '100%' }}
          // 🔥 禁用所有动画
          transitionName=""
          dropdownClassName="safe-no-scroll-dropdown"
          // 🔥 确保没有默认值触发自动滚动
          defaultValue={undefined}
          allowClear={false}
          open={true}
          getPopupContainer={() => containerRef.current || document.body}
          popupClassName="safe-datetime-popup"
          onOpenChange={(open) => {
            if (open) {
              // 延迟执行，确保DOM完全渲染
              setTimeout(() => {
                const timeColumns = document.querySelectorAll('.ant-picker-time-panel-column');
                timeColumns.forEach((col) => {
                  const element = col as HTMLElement;
                  
                  // 安全地设置样式
                  element.style.height = '216px';
                  element.style.maxHeight = '216px';
                  element.style.overflowY = 'auto';
                  element.style.scrollBehavior = 'auto';
                  element.style.transition = 'none';
                  element.style.animation = 'none';
                  
                  // 温和地重置滚动位置
                  if (element.scrollTop !== 0) {
                    console.log(`📅 Resetting scroll position from ${element.scrollTop} to 0`);
                    element.scrollTop = 0;
                  }
                });
              }, 50); // 稍微延迟以确保DOM稳定
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

export default SafeDateTimeRangePicker;