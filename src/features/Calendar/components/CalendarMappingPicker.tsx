import React, { useState, useEffect } from 'react';

interface CalendarMapping {
  calendarId: string;
  calendarName: string;
  color?: string;
}

interface CalendarMappingPickerProps {
  onSelect: (mapping: CalendarMapping) => void;
  onClose: () => void;
  position: { x: number; y: number };
  currentMapping?: CalendarMapping;
  isVisible: boolean;
  microsoftService?: any; // MicrosoftCalendarService 实例
  googleService?: any; // 未来的 GoogleCalendarService 实例
  icloudService?: any; // 未来的 iCloudCalendarService 实例
  availableCalendars?: CalendarMapping[]; // 已同步的日历列表
}

// 将Microsoft颜色名称转换为十六进制颜色
const convertMicrosoftColorToHex = (colorName?: string): string => {
  const colorMap: { [key: string]: string } = {
    'lightBlue': '#5194f0',
    'lightGreen': '#42b883', 
    'lightOrange': '#ff8c42',
    'lightGray': '#9ca3af',
    'lightYellow': '#f1c40f',
    'lightTeal': '#48c9b0',
    'lightPink': '#f48fb1',
    'lightBrown': '#a0826d',
    'lightRed': '#e74c3c',
    'maxColor': '#6366f1'
  };
  
  if (!colorName) return '#3b82f6';
  return colorMap[colorName] || '#3b82f6';
};

// 获取日历提供商名称的工具函数
const getCalendarProviderName = (service: any): string => {
  if (service && service.constructor.name === 'MicrosoftCalendarService') {
    return 'Outlook';
  }
  // 未来可以添加:
  // if (service && service.constructor.name === 'GoogleCalendarService') return 'Google';
  // if (service && service.constructor.name === 'iCloudCalendarService') return 'iCloud';
  return 'Unknown';
};

// 日历映射选择器组件
const CalendarMappingPicker: React.FC<CalendarMappingPickerProps> = ({
  onSelect,
  onClose,
  position,
  currentMapping,
  isVisible,
  microsoftService,
  googleService,
  icloudService,
  availableCalendars: propCalendars
}) => {
  const [availableCalendars, setAvailableCalendars] = useState<CalendarMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState<boolean>(false);
  
  // 拖拽相关状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentPosition, setCurrentPosition] = useState(position);

  // 默认选项（仅包含"不映射"选项）
  const defaultOptions: CalendarMapping[] = [
    { calendarId: 'none', calendarName: '不映射到日历', color: '#6b7280' }
  ];

  // 提取为函数，供登录后复用
  const loadCalendars = React.useCallback(async () => {
      let allCalendars: CalendarMapping[] = [];
      
      // 优先使用传入的日历列表
      if (propCalendars && propCalendars.length > 0) {
        // 为传入的日历添加提供商前缀（如果还没有的话）
        const formattedCalendars = propCalendars.map(cal => ({
          ...cal,
          calendarName: cal.calendarName.includes(':') ? cal.calendarName : `Outlook: ${cal.calendarName}`
        }));
        setAvailableCalendars([...formattedCalendars, ...defaultOptions]);
        setRequiresLogin(false);
        return;
      }

      setLoading(true);
      setError(null);
      setRequiresLogin(false);
      
      try {
        // 未登录时直接提示登录，不再尝试远程获取，避免“页面卡住无提示”
        if (microsoftService && typeof microsoftService.isSignedIn === 'function' && !microsoftService.isSignedIn()) {
          setRequiresLogin(true);
          setAvailableCalendars(defaultOptions);
          setError('需要登录后才能读取日历列表');
          return;
        }

        // Microsoft 日历 - 使用缓存优先策略
        if (microsoftService && typeof microsoftService.getCachedCalendars === 'function') {
          const providerName = getCalendarProviderName(microsoftService);
          
          // 优先从缓存获取
          const cachedCalendars = microsoftService.getCachedCalendars();
          
          if (cachedCalendars && cachedCalendars.length > 0) {
            const mappedCalendars = cachedCalendars.map((cal: any) => ({
              calendarId: cal.id,
              calendarName: `${providerName}: ${cal.name}`,
              color: convertMicrosoftColorToHex(cal.color)
            }));
            allCalendars.push(...mappedCalendars);
          } else {
            // 缓存为空，尝试从远程获取并缓存
            try {
              const { calendars } = await microsoftService.getAllCalendarData();
              const mappedCalendars = calendars.map((cal: any) => ({
                calendarId: cal.id,
                calendarName: `${providerName}: ${cal.name}`,
                color: convertMicrosoftColorToHex(cal.color)
              }));
              allCalendars.push(...mappedCalendars);
            } catch (remoteError) {
              console.warn('📋 [CalendarMappingPicker] Remote fetch failed, using offline mode');
              setError('当前处于离线模式，显示默认选项');
            }
          }
        }

        // 未来可以添加 Google 和 iCloud 支持:
        // if (googleService && typeof googleService.getAllCalendars === 'function') { ... }
        // if (icloudService && typeof icloudService.getAllCalendars === 'function') { ... }
        
        // 添加"不映射"选项
        setAvailableCalendars([...allCalendars, ...defaultOptions]);
        
        if (allCalendars.length === 0) {
          setError('没有找到已同步的日历');
        }
      } catch (err) {
        console.warn('Failed to load calendars:', err);
        setAvailableCalendars(defaultOptions);
        setError('无法连接到日历服务，显示默认选项');
      } finally {
        setLoading(false);
      }
  }, [microsoftService, googleService, icloudService, propCalendars, defaultOptions]);

  // 加载可用日历
  useEffect(() => {
    if (isVisible) {
      loadCalendars();
    }
  }, [isVisible, loadCalendars]);

  const handleCalendarSelect = (calendar: CalendarMapping) => {
    onSelect(calendar);
    onClose();
  };

  const handleRefreshCalendars = async () => {
    if (!microsoftService || typeof microsoftService.syncCalendarGroupsFromRemote !== 'function') {
      setError('同步服务不可用');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const { calendars } = await microsoftService.syncCalendarGroupsFromRemote();
      
      const providerName = getCalendarProviderName(microsoftService);
      const mappedCalendars = calendars.map((cal: any) => ({
        calendarId: cal.id,
        calendarName: `${providerName}: ${cal.name}`,
        color: convertMicrosoftColorToHex(cal.color)
      }));
      
      setAvailableCalendars([...mappedCalendars, ...defaultOptions]);
    } catch (error) {
      console.error('❌ [CalendarMappingPicker] Manual refresh failed:', error);
      setError('同步失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!microsoftService || typeof microsoftService.signIn !== 'function') {
      setError('登录服务不可用');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ok = await microsoftService.signIn();
      // 某些环境（Electron）可能需要手动刷新或随后 reloadToken
      if (ok || (await microsoftService.reloadToken?.())) {
        setRequiresLogin(false);
        await loadCalendars();
      } else {
        setError('登录未完成，请在完成登录后重试');
      }
    } catch (e) {
      console.error('❌ 登录失败:', e);
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 拖拽事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - currentPosition.x,
      y: e.clientY - currentPosition.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newPosition = {
        x: Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 300)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 400))
      };
      setCurrentPosition(newPosition);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 监听全局鼠标事件
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // 当组件的position prop改变时，更新内部位置状态
  React.useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  if (!isVisible) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.3)'
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          position: 'absolute',
          left: currentPosition.x,
          top: currentPosition.y,
          width: '300px',
          maxHeight: '400px',
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          border: '1px solid #e2e8f0',
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 - 可拖拽 */}
        <div 
          style={{
            padding: '16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            cursor: 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleMouseDown}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: '600', fontSize: '16px' }}>选择日历映射</span>
            {microsoftService && (() => {
              const syncMeta = microsoftService.getSyncMeta();
              return syncMeta && (
                <span style={{ 
                  fontSize: '12px', 
                  color: syncMeta.isOfflineMode ? '#dc2626' : '#16a34a',
                  backgroundColor: syncMeta.isOfflineMode ? '#fef2f2' : '#f0fdf4',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: `1px solid ${syncMeta.isOfflineMode ? '#fecaca' : '#bbf7d0'}`
                }}>
                  {syncMeta.isOfflineMode ? '离线模式' : '已同步'}
                </span>
              );
            })()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {microsoftService && (
              <button 
                onClick={handleRefreshCalendars}
                disabled={loading}
                style={{
                  background: 'none',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  padding: '4px 8px',
                  color: '#64748b',
                  borderRadius: '4px',
                  opacity: loading ? 0.5 : 1
                }}
                title="从服务器同步最新日历"
              >
                🔄 刷新
              </button>
            )}
            <button onClick={onClose} style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
              color: '#64748b',
              borderRadius: '4px'
            }}>×</button>
          </div>
        </div>
        
        {/* 内容区域 */}
        <div style={{ padding: '12px', maxHeight: '320px', overflowY: 'auto' }}>
          {requiresLogin && (
            <div style={{
              padding: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              backgroundColor: '#fff7ed',
              marginBottom: '12px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#9a3412', marginBottom: '8px' }}>
                需要登录以读取您的日历
              </div>
              <div style={{ fontSize: '12px', color: '#7c2d12', marginBottom: '12px' }}>
                您尚未连接 Microsoft 账户。请先登录，再为标签选择映射的日历。
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  连接 Microsoft 账户
                </button>
                <button
                  onClick={onClose}
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}
          {error && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#dc2626'
            }}>
              {error}
            </div>
          )}
          
          {loading ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              加载中...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {availableCalendars.map((calendar) => (
                <button
                  key={calendar.calendarId}
                  onClick={() => handleCalendarSelect(calendar)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    border: currentMapping?.calendarId === calendar.calendarId 
                      ? '2px solid #3b82f6' 
                      : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    backgroundColor: currentMapping?.calendarId === calendar.calendarId 
                      ? '#eff6ff' 
                      : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    if (currentMapping?.calendarId !== calendar.calendarId) {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentMapping?.calendarId !== calendar.calendarId) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  {/* 颜色指示器 */}
                  <div 
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: calendar.color || '#3b82f6',
                      flexShrink: 0
                    }}
                  />
                  
                  {/* 日历名称 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '500',
                      color: '#1f2937'
                    }}>
                      {calendar.calendarName}
                    </div>
                    {calendar.calendarId === 'none' && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6b7280',
                        marginTop: '2px'
                      }}>
                        标签不会同步到任何日历
                      </div>
                    )}
                  </div>
                  
                  {/* 选中指示器 */}
                  {currentMapping?.calendarId === calendar.calendarId && (
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '10px'
                    }}>
                      ✓
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* 说明文字 */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          日历信息已缓存到本地，支持离线使用。点击"🔄 刷新"可同步最新的日历数据。
        </div>
      </div>
    </div>
  );
};

export default CalendarMappingPicker;