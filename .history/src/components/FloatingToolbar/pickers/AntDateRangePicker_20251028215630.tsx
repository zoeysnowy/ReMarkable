/**
 * AntDateRangePicker - 基于 Ant Design 的日期范围选择器
 */

import React, { useState } from 'react';
import { DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import './DateRangePicker.css';

const { RangePicker } = DatePicker;

interface AntDateRangePickerProps {
  onSelect: (startDate: Date, endDate: Date) => void;
  onClose: () => void;
}

export const AntDateRangePicker: React.FC<AntDateRangePickerProps> = ({
  onSelect,
  onClose,
}) => {
  const [includeTime, setIncludeTime] = useState(false);

  console.log('🔧 AntDateRangePicker rendered');

  // 快捷选择选项
  const rangePresets = [
    {
      label: '今天',
      value: [dayjs(), dayjs()] as [Dayjs, Dayjs],
    },
    {
      label: '明天',
      value: [dayjs().add(1, 'day'), dayjs().add(1, 'day')] as [Dayjs, Dayjs],
    },
    {
      label: '本周',
      value: [dayjs().startOf('week'), dayjs().endOf('week')] as [Dayjs, Dayjs],
    },
    {
      label: '下周',
      value: [dayjs().add(1, 'week').startOf('week'), dayjs().add(1, 'week').endOf('week')] as [Dayjs, Dayjs],
    },
    {
      label: '本月',
      value: [dayjs().startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs],
    },
    {
      label: '下月',
      value: [dayjs().add(1, 'month').startOf('month'), dayjs().add(1, 'month').endOf('month')] as [Dayjs, Dayjs],
    },
  ];

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    console.log('📅 Range changed:', dates);
    if (dates && dates[0] && dates[1]) {
      onSelect(dates[0].toDate(), dates[1].toDate());
    }
  };

  return (
    <div className="date-range-picker-panel">
      <div className="picker-header">
        <span className="picker-title">选择日期</span>
        <button className="picker-close-btn" onClick={onClose}>
          ×
        </button>
      </div>
      
      {/* 快捷选择按钮 */}
      <div className="date-shortcuts">
        {rangePresets.map((preset) => (
          <button
            key={preset.label}
            className="shortcut-btn"
            onClick={() => handleRangeChange(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Ant Design RangePicker */}
      <div className="range-picker-container">
        <RangePicker
          placeholder={['开始日期', '结束日期']}
          onChange={handleRangeChange}
          onOpenChange={(open) => {
            console.log('� [DIAGNOSTIC] RangePicker open state changed:', open);
            
            if (open) {
              console.log('🔍 [DIAGNOSTIC] Picker is opening...');
              
              // 检查所有可能的弹出面板
              setTimeout(() => {
                const allDropdowns = document.querySelectorAll('.ant-picker-dropdown');
                console.log('🔍 [DIAGNOSTIC] Found dropdowns:', allDropdowns.length);
                
                allDropdowns.forEach((dropdown, index) => {
                  const element = dropdown as HTMLElement;
                  console.log(`� [DIAGNOSTIC] Dropdown ${index}:`, {
                    display: element.style.display,
                    visibility: element.style.visibility,
                    opacity: element.style.opacity,
                    zIndex: element.style.zIndex,
                    position: element.style.position,
                    left: element.style.left,
                    top: element.style.top,
                    width: element.style.width,
                    height: element.style.height,
                    className: element.className,
                    offsetParent: element.offsetParent,
                    clientHeight: element.clientHeight,
                    scrollHeight: element.scrollHeight
                  });
                  
                  // 强制设置样式
                  element.style.zIndex = '10005';
                  element.style.position = 'fixed';
                  element.style.visibility = 'visible';
                  element.style.opacity = '1';
                  element.style.display = 'block';
                  element.style.pointerEvents = 'auto';
                  
                  // 测试：添加明显的调试元素
                  if (!document.getElementById('debug-overlay')) {
                    const debugDiv = document.createElement('div');
                    debugDiv.id = 'debug-overlay';
                    debugDiv.innerHTML = '🔍 日历面板在这里！';
                    debugDiv.style.cssText = `
                      position: fixed;
                      top: 200px;
                      left: 200px;
                      width: 300px;
                      height: 200px;
                      background: red;
                      color: white;
                      z-index: 20000;
                      border: 5px solid yellow;
                      font-size: 20px;
                      padding: 20px;
                      box-shadow: 0 0 20px rgba(0,0,0,0.8);
                    `;
                    document.body.appendChild(debugDiv);
                    
                    setTimeout(() => {
                      document.body.removeChild(debugDiv);
                    }, 3000);
                  }
                  
                  console.log('🔍 [DIAGNOSTIC] Applied forced styles to dropdown', index);
                });
                
                // 检查是否有遮挡元素
                const picker = document.querySelector('.range-picker-container .ant-picker');
                if (picker) {
                  const rect = picker.getBoundingClientRect();
                  console.log('🔍 [DIAGNOSTIC] Picker position:', rect);
                  
                  const elementAtCenter = document.elementFromPoint(rect.left + rect.width/2, rect.bottom + 10);
                  console.log('🔍 [DIAGNOSTIC] Element below picker:', elementAtCenter);
                }
                
              }, 50);
              
              // 再次检查稍后
              setTimeout(() => {
                const dropdowns = document.querySelectorAll('.ant-picker-dropdown');
                console.log('🔍 [DIAGNOSTIC] After 200ms, dropdowns:', dropdowns.length);
                dropdowns.forEach((dropdown, index) => {
                  const computed = window.getComputedStyle(dropdown);
                  console.log(`🔍 [DIAGNOSTIC] Computed styles ${index}:`, {
                    display: computed.display,
                    visibility: computed.visibility,
                    opacity: computed.opacity,
                    zIndex: computed.zIndex,
                    position: computed.position
                  });
                });
              }, 200);
            } else {
              console.log('🔍 [DIAGNOSTIC] Picker is closing...');
            }
          }}
          onFocus={() => console.log('🔍 [DIAGNOSTIC] RangePicker focused')}
          onBlur={() => console.log('🔍 [DIAGNOSTIC] RangePicker blurred')}
          onClick={() => console.log('🔍 [DIAGNOSTIC] RangePicker clicked')}
          style={{ width: '100%' }}
          size="middle"
          styles={{
            popup: {
              root: {
                zIndex: 10005,
                position: 'fixed'
              }
            }
          }}
          open={undefined}
        />
      </div>

      {/* 包含时间选项 */}
      <div className="picker-options">
        <label className="include-time-checkbox">
          <input
            type="checkbox"
            checked={includeTime}
            onChange={(e) => setIncludeTime(e.target.checked)}
          />
          包含具体时间
        </label>
      </div>

      <div className="picker-footer">
        <button className="picker-cancel-btn" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  );
};