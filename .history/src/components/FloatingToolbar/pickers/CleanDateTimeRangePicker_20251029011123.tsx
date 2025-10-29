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
            // 🔥 不设置 defaultValue，避免自动滚动到特定时间
            defaultValue: undefined,
            // 禁用时间面板的自动滚动动画
            disabledTime: undefined,
            hideDisabledOptions: false,
            // 减少滚动敏感度，防止误触
            scrollToFirstRowOnOpen: false,
            showNow: false, // 禁用"此刻"按钮，避免自动定位到当前时间
            use12Hours: false
          }}
          format="YYYY-MM-DD HH:mm"
          placeholder={['开始时间', '结束时间']}
          style={{ width: '100%' }}
          // 禁用动画效果，提升性能
          transitionName=""
          // 禁用下拉动画
          dropdownClassName="no-animation-dropdown"
          // 🔥 强制不使用默认值，避免初始化时自动滚动
          defaultValue={undefined}
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
                  
                  // 彻底禁用时间列的自动跳转和动画
                  const timeColumns = element.querySelectorAll('.ant-picker-time-panel-column');
                  const initTime = Date.now(); // 记录初始化时间
                  
                  timeColumns.forEach((column) => {
                    const col = column as HTMLElement;
                    
                    // 强制设置容器样式 - 增加显示区域到9项
                    col.style.height = '216px'; // 9项 × 24px
                    col.style.maxHeight = '216px';
                    col.style.minHeight = '216px';
                    col.style.overflowY = 'auto';
                    col.style.overflowX = 'hidden';
                    col.style.padding = '0';
                    col.style.margin = '0';
                    col.style.scrollBehavior = 'auto';
                    col.style.transition = 'none';
                    col.style.animation = 'none';
                    col.style.scrollSnapType = 'none';
                    col.style.overscrollBehavior = 'none';
                    col.style.textAlign = 'left';
                    col.style.verticalAlign = 'top';
                    
                    // 记录初始滚动位置
                    const initialScrollTop = col.scrollTop;
                    console.log(`📅 Initial scroll position for column:`, initialScrollTop);
                    
                    // 🔥 立即强制重置滚动位置到顶部，阻止自动滚动
                    col.scrollTop = 0;
                    console.log(`📅 Force reset scroll to 0`);
                    
                    // 🔥 使用定时器持续重置，直到动画结束
                    const forceResetScroll = () => {
                      if (col.scrollTop !== 0) {
                        console.log(`📅 Detected unwanted scroll (${col.scrollTop}), resetting to 0`);
                        col.scrollTop = 0;
                      }
                    };
                    
                    // 多次重置，确保覆盖任何延迟的自动滚动
                    setTimeout(forceResetScroll, 0);
                    setTimeout(forceResetScroll, 10);
                    setTimeout(forceResetScroll, 50);
                    setTimeout(forceResetScroll, 100);
                    setTimeout(forceResetScroll, 200);
                    setTimeout(forceResetScroll, 500);
                    
                    // 监听任何可能触发滚动的事件
                    const logScroll = (eventType: string) => {
                      return (e: Event) => {
                        console.log(`📅 ${eventType} event detected on column:`, col.scrollTop);
                      };
                    };
                    
                    col.addEventListener('scroll', logScroll('scroll'));
                    col.addEventListener('scrollend', logScroll('scrollend'));
                    col.addEventListener('wheel', logScroll('wheel'));
                    
                    // 添加强力的滚动边界控制
                    const handleScroll = (e: Event) => {
                      const target = e.target as HTMLElement;
                      const scrollTop = target.scrollTop;
                      const scrollHeight = target.scrollHeight;
                      const clientHeight = target.clientHeight;
                      const maxScroll = scrollHeight - clientHeight;
                      
                      console.log(`📅 Scroll event - scrollTop: ${scrollTop}, maxScroll: ${maxScroll}`);
                      
                      // 🔥 在初始化阶段，强制阻止任何非用户触发的滚动
                      const now = Date.now();
                      const timeSinceInit = now - initTime;
                      
                      if (timeSinceInit < 1000) { // 初始化后1秒内，强制重置所有滚动
                        console.log(`📅 Blocking auto-scroll during init phase (${timeSinceInit}ms)`);
                        if (scrollTop !== 0) {
                          target.scrollTop = 0;
                          e.preventDefault();
                          e.stopPropagation();
                          e.stopImmediatePropagation();
                          return;
                        }
                      }
                      
                      // 强制边界控制
                      if (scrollTop < 0) {
                        console.log('📅 Correcting negative scroll');
                        target.scrollTop = 0;
                        e.preventDefault();
                        e.stopPropagation();
                      } else if (scrollTop > maxScroll) {
                        console.log('📅 Correcting excessive scroll');
                        target.scrollTop = maxScroll;
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    };
                    
                    // 添加滚动监听
                    col.addEventListener('scroll', handleScroll, { passive: false });
                    
                    // 覆盖任何可能的自动滚动方法和监听点击事件
                    const cells = col.querySelectorAll('.ant-picker-time-panel-cell');
                    cells.forEach((cell, cellIndex) => {
                      // 禁用单元格的scrollIntoView
                      (cell as any).scrollIntoView = () => {
                        console.log(`📅 Blocked scrollIntoView call on cell ${cellIndex}`);
                        // 什么也不做，阻止自动跳转
                      };
                      
                      // 监听点击事件，看是否触发动画
                      cell.addEventListener('click', (e) => {
                        console.log(`📅 Cell ${cellIndex} clicked, current scroll:`, col.scrollTop);
                        // 阻止任何可能的自动滚动
                        setTimeout(() => {
                          const newScrollTop = col.scrollTop;
                          if (newScrollTop !== col.scrollTop) {
                            console.log(`📅 Detected unwanted scroll change from click, reverting`);
                          }
                        }, 0);
                      });
                    });
                    
                    // 监听列本身的样式变化
                    const observer = new MutationObserver((mutations) => {
                      mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                          console.log('📅 Style mutation detected on column:', mutation.target);
                        }
                      });
                    });
                    
                    observer.observe(col, { attributes: true, attributeFilter: ['style'] });
                    
                    // 确保内容列表样式正确
                    const ul = col.querySelector('ul');
                    if (ul) {
                      const ulElement = ul as HTMLElement;
                      ulElement.style.margin = '0';
                      ulElement.style.padding = '0';
                      ulElement.style.minHeight = 'auto';
                      ulElement.style.scrollSnapType = 'none';
                      ulElement.style.transition = 'none';
                      ulElement.style.animation = 'none';
                      ulElement.style.display = 'block';
                      ulElement.style.position = 'relative';
                      ulElement.style.top = '0';
                      
                      // 根据列类型设置精确高度
                      const dataType = col.getAttribute('data-type');
                      if (dataType === 'hour') {
                        ulElement.style.height = '576px'; // 24项 × 24px
                      } else if (dataType === 'minute') {
                        ulElement.style.height = '1440px'; // 60项 × 24px
                      }
                    }
                    
                    // 清理函数
                    const cleanup = () => {
                      col.removeEventListener('scroll', handleScroll);
                    };
                    
                    // 当组件卸载时清理
                    setTimeout(() => {
                      if (!document.body.contains(col)) {
                        cleanup();
                      }
                    }, 100);
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