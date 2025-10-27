import React, { useState, useRef, useEffect } from 'react';
import './CalendarPicker.css';

interface Calendar {
  id: string;
  name?: string;
  displayName?: string;
  color?: string;
  description?: string;
}

interface CalendarPickerProps {
  availableCalendars: Calendar[];
  selectedCalendarIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  placeholder?: string;
  maxSelection?: number;
  className?: string;
}

/**
 * 优雅的日历选择组件 - 类似于标签picker的设计
 */
export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  availableCalendars = [],
  selectedCalendarIds = [],
  onSelectionChange,
  placeholder = "选择日历分组...",
  maxSelection = 5,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 过滤日历列表
  const filteredCalendars = availableCalendars.filter(calendar => {
    const name = calendar.name || calendar.displayName || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 获取选中的日历
  const selectedCalendars = availableCalendars.filter(calendar => 
    selectedCalendarIds.includes(calendar.id)
  );

  // 切换日历选择
  const toggleCalendar = (calendarId: string) => {
    const isSelected = selectedCalendarIds.includes(calendarId);
    let newSelection: string[];

    if (isSelected) {
      // 取消选择
      newSelection = selectedCalendarIds.filter(id => id !== calendarId);
    } else {
      // 添加选择
      if (selectedCalendarIds.length >= maxSelection) {
        console.warn(`最多只能选择 ${maxSelection} 个日历`);
        return;
      }
      newSelection = [...selectedCalendarIds, calendarId];
    }

    onSelectionChange(newSelection);
  };

  // 移除选中的日历
  const removeCalendar = (calendarId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = selectedCalendarIds.filter(id => id !== calendarId);
    onSelectionChange(newSelection);
  };

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 获取日历显示名称
  const getCalendarName = (calendar: Calendar) => {
    return calendar.name || calendar.displayName || `日历 ${calendar.id.slice(-8)}`;
  };

  // 获取日历颜色
  const getCalendarColor = (calendar: Calendar) => {
    const color = calendar.color || '#3498db';
    console.log(`🎨 [CalendarPicker] Getting color for ${getCalendarName(calendar)}:`, color);
    return color;
  };

  return (
    <div className={`calendar-picker ${className}`} ref={dropdownRef}>
      {/* 选择器主体 */}
      <div 
        className={`calendar-picker-container ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        {/* 已选择的日历标签 */}
        {selectedCalendars.length > 0 ? (
          <div className="selected-calendars">
            {selectedCalendars.map(calendar => (
              <span 
                key={calendar.id}
                className="calendar-chip"
                style={{ 
                  backgroundColor: `${getCalendarColor(calendar)}15`,
                  borderColor: getCalendarColor(calendar),
                  color: getCalendarColor(calendar)
                }}
              >
                <span className="calendar-chip-dot" style={{ backgroundColor: getCalendarColor(calendar) }}></span>
                <span className="calendar-chip-name">{getCalendarName(calendar)}</span>
                <button
                  type="button"
                  className="calendar-chip-remove"
                  onClick={(e) => removeCalendar(calendar.id, e)}
                  aria-label={`移除 ${getCalendarName(calendar)}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="calendar-picker-placeholder">
            📅 {placeholder}
          </div>
        )}

        {/* 搜索输入框 */}
        <input
          ref={inputRef}
          type="text"
          className="calendar-search-input"
          placeholder={selectedCalendars.length > 0 ? "搜索更多日历..." : "搜索日历..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
        />

        {/* 下拉箭头 */}
        <div className={`calendar-picker-arrow ${isOpen ? 'open' : ''}`}>
          ▼
        </div>
      </div>

      {/* 下拉列表 */}
      {isOpen && (
        <div className="calendar-dropdown">
          <div className="calendar-dropdown-header">
            <span className="calendar-dropdown-title">
              选择日历分组 ({selectedCalendarIds.length}/{maxSelection})
            </span>
            <button
              type="button"
              className="calendar-dropdown-close"
              onClick={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
            >
              ×
            </button>
          </div>

          <div className="calendar-dropdown-content">
            {/* 清空选择 */}
            {selectedCalendarIds.length > 0 && (
              <div className="calendar-dropdown-section">
                <button
                  type="button"
                  className="calendar-clear-all"
                  onClick={() => onSelectionChange([])}
                >
                  🗑️ 清空所有选择
                </button>
              </div>
            )}

            {/* 日历列表 */}
            <div className="calendar-list">
              {filteredCalendars.length > 0 ? (
                filteredCalendars.map(calendar => {
                  const isSelected = selectedCalendarIds.includes(calendar.id);
                  const isDisabled = !isSelected && selectedCalendarIds.length >= maxSelection;

                  return (
                    <label
                      key={calendar.id}
                      className={`filter-item calendar-item ${isDisabled ? 'disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => !isDisabled && toggleCalendar(calendar.id)}
                        disabled={isDisabled}
                      />
                      <div className="calendar-content">
                        {/* 颜色圆点 */}
                        <span 
                          className="calendar-dot" 
                          style={{ backgroundColor: getCalendarColor(calendar) }}
                        ></span>
                        
                        {/* 日历名称 */}
                        <span className="calendar-name">{getCalendarName(calendar)}</span>
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="empty-message">
                  {searchQuery ? '没有找到匹配的日历' : '暂无日历'}
                </div>
              )}
            </div>
                      </div>

                      {isSelected && (
                        <div className="calendar-selected-indicator">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="no-calendars-found">
                  {searchQuery ? (
                    <>
                      🔍 未找到匹配的日历
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => setSearchQuery('')}
                      >
                        清空搜索
                      </button>
                    </>
                  ) : (
                    '📭 暂无可用日历'
                  )}
                </div>
              )}
            </div>

            {/* 可用日历数量提示 */}
            {availableCalendars.length > 0 && (
              <div className="calendar-dropdown-footer">
                共 {availableCalendars.length} 个可用日历
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};