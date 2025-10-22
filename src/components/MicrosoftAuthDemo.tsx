import React, { useState, useEffect } from 'react';
import { SimpleMicrosoftLogin } from './SimpleMicrosoftLogin';
import { simplifiedMicrosoftCalendarService } from '../services/SimplifiedMicrosoftCalendarService';
import './MicrosoftAuthDemo.css';

interface Calendar {
  id: string;
  name: string;
  color?: string;
}

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
}

/**
 * Microsoft认证演示组件
 * 展示简化的认证流程和基本的日历操作
 */
export const MicrosoftAuthDemo: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('');

  useEffect(() => {
    // 检查是否已经登录
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    const authenticated = simplifiedMicrosoftCalendarService.isUserAuthenticated();
    setIsAuthenticated(authenticated);
    if (authenticated) {
      setConnectionStatus('已连接到Microsoft账户');
      loadCalendars();
    }
  };

  const handleAuthSuccess = async (authResult: any) => {
    console.log('🎉 认证成功:', authResult);
    setIsAuthenticated(true);
    setError('');
    setConnectionStatus('认证成功，正在加载日历...');
    
    // 测试连接
    try {
      const connected = await simplifiedMicrosoftCalendarService.testConnection();
      if (connected) {
        setConnectionStatus('已成功连接到Microsoft Graph');
        await loadCalendars();
      } else {
        setConnectionStatus('连接测试失败');
      }
    } catch (error) {
      setConnectionStatus('连接测试出错');
      console.error('连接测试失败:', error);
    }
  };

  const handleAuthError = (error: Error) => {
    console.error('❌ 认证失败:', error);
    setError(`认证失败: ${error.message}`);
    setIsAuthenticated(false);
    setConnectionStatus('');
  };

  const loadCalendars = async () => {
    if (!isAuthenticated) return;
    
    setIsLoading(true);
    try {
      console.log('📅 加载日历列表...');
      const calendarList = await simplifiedMicrosoftCalendarService.getCalendars();
      
      const processedCalendars = calendarList.map((cal: any) => ({
        id: cal.id,
        name: cal.name,
        color: cal.color || '#3b82f6'
      }));
      
      setCalendars(processedCalendars);
      setConnectionStatus(`已加载 ${processedCalendars.length} 个日历`);
      
      // 默认选择第一个日历
      if (processedCalendars.length > 0) {
        setSelectedCalendar(processedCalendars[0].id);
      }
      
      console.log('✅ 日历列表加载成功:', processedCalendars);
    } catch (error) {
      console.error('❌ 加载日历失败:', error);
      setError(`加载日历失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvents = async (calendarId: string) => {
    if (!calendarId) return;
    
    setIsLoading(true);
    try {
      console.log('📝 加载事件列表...');
      
      // 获取最近30天的事件
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
      const eventList = await simplifiedMicrosoftCalendarService.getEvents(calendarId, startDate, endDate);
      
      const processedEvents = eventList.map((event: any) => ({
        id: event.id,
        subject: event.subject || '无标题',
        start: event.start,
        end: event.end,
        location: event.location
      }));
      
      setEvents(processedEvents);
      setConnectionStatus(`已加载 ${processedEvents.length} 个事件`);
      
      console.log('✅ 事件列表加载成功:', processedEvents);
    } catch (error) {
      console.error('❌ 加载事件失败:', error);
      setError(`加载事件失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalendarChange = (calendarId: string) => {
    setSelectedCalendar(calendarId);
    setEvents([]);
    if (calendarId) {
      loadEvents(calendarId);
    }
  };

  const handleLogout = () => {
    simplifiedMicrosoftCalendarService.logout();
    setIsAuthenticated(false);
    setCalendars([]);
    setEvents([]);
    setSelectedCalendar('');
    setConnectionStatus('');
    setError('');
  };

  const formatDateTime = (dateTimeString: string) => {
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return dateTimeString;
    }
  };

  return (
    <div className="microsoft-auth-demo">
      <div className="demo-header">
        <h1>Microsoft 日历认证演示</h1>
        <p>测试简化的Microsoft认证流程和日历API调用</p>
      </div>

      {/* 连接状态 */}
      {connectionStatus && (
        <div className="status-bar">
          <span className="status-indicator">🔗</span>
          <span>{connectionStatus}</span>
        </div>
      )}

      {/* 错误显示 */}
      {error && (
        <div className="error-bar">
          <span className="error-indicator">❌</span>
          <span>{error}</span>
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="loading-bar">
          <span className="loading-spinner"></span>
          <span>加载中...</span>
        </div>
      )}

      {!isAuthenticated ? (
        /* 未认证状态 - 显示登录组件 */
        <div className="auth-section">
          <SimpleMicrosoftLogin
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
          />
        </div>
      ) : (
        /* 已认证状态 - 显示日历功能 */
        <div className="main-content">
          {/* 顶部工具栏 */}
          <div className="toolbar">
            <div className="toolbar-left">
              <button onClick={loadCalendars} disabled={isLoading} className="btn-refresh">
                🔄 刷新日历
              </button>
              <button onClick={checkAuthStatus} disabled={isLoading} className="btn-test">
                🔍 测试连接
              </button>
            </div>
            <div className="toolbar-right">
              <button onClick={handleLogout} className="btn-logout">
                👋 登出
              </button>
            </div>
          </div>

          {/* 日历选择器 */}
          {calendars.length > 0 && (
            <div className="calendar-selector">
              <h3>选择日历</h3>
              <div className="calendar-grid">
                {calendars.map((calendar) => (
                  <div
                    key={calendar.id}
                    className={`calendar-item ${selectedCalendar === calendar.id ? 'selected' : ''}`}
                    onClick={() => handleCalendarChange(calendar.id)}
                  >
                    <div className="calendar-color" style={{ backgroundColor: calendar.color }}></div>
                    <span className="calendar-name">{calendar.name}</span>
                    {selectedCalendar === calendar.id && (
                      <span className="selected-indicator">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 事件列表 */}
          {selectedCalendar && (
            <div className="events-section">
              <h3>日历事件</h3>
              {events.length > 0 ? (
                <div className="events-list">
                  {events.map((event) => (
                    <div key={event.id} className="event-item">
                      <div className="event-header">
                        <h4 className="event-title">{event.subject}</h4>
                        <span className="event-id">ID: {event.id.substring(0, 20)}...</span>
                      </div>
                      <div className="event-details">
                        <div className="event-time">
                          <span className="time-label">开始:</span>
                          <span>{formatDateTime(event.start.dateTime)}</span>
                        </div>
                        <div className="event-time">
                          <span className="time-label">结束:</span>
                          <span>{formatDateTime(event.end.dateTime)}</span>
                        </div>
                        {event.location?.displayName && (
                          <div className="event-location">
                            <span className="location-label">位置:</span>
                            <span>{event.location.displayName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-events">
                  <p>这个日历中没有找到事件</p>
                  <p>尝试选择其他日历或检查日期范围</p>
                </div>
              )}
            </div>
          )}

          {/* 调试信息 */}
          <div className="debug-section">
            <details>
              <summary>调试信息</summary>
              <div className="debug-content">
                <h5>认证状态:</h5>
                <ul>
                  <li>已认证: {isAuthenticated ? '是' : '否'}</li>
                  <li>日历数量: {calendars.length}</li>
                  <li>选中日历: {selectedCalendar || '无'}</li>
                  <li>事件数量: {events.length}</li>
                </ul>
                
                <h5>日历列表:</h5>
                <pre>{JSON.stringify(calendars, null, 2)}</pre>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};