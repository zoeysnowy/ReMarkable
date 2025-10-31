import React from 'react';
import './AppLayout.css';
import Logo from './Logo';
import { icons } from '../assets/icons';
import { formatTimeForStorage } from '../utils/timeUtils';

// 页面类型定义
export type PageType = 'home' | 'time' | 'log' | 'tag' | 'plan' | 'sync';

interface AppLayoutProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  children: React.ReactNode;
  globalTimer?: {
    isRunning: boolean;
    tagId: string;
    tagName: string;
    tagEmoji?: string;
    tagColor?: string;
    startTime: number;
    elapsedTime: number;
    isPaused: boolean;
  } | null;
  onTimerClick?: () => void;
  clickTrackerEnabled?: boolean;
  onClickTrackerToggle?: () => void;
  onSettingsClick?: () => void;
}

// Header 组件
interface HeaderProps {
  globalTimer?: {
    isRunning: boolean;
    tagId: string;
    tagName: string;
    tagEmoji?: string;
    tagColor?: string;
    startTime: number;
    elapsedTime: number;
    isPaused: boolean;
  } | null;
  onTimerClick?: () => void;
  onSettingsClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ globalTimer, onTimerClick, onSettingsClick }) => {
  
  // 格式化计时器显示
  const formatTimerDisplay = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // 如果没有到小时，只显示 MM:SS
    if (hours === 0) {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // 到小时了显示 HH:MM:SS
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 计算当前显示时间
  const getCurrentElapsed = () => {
    if (!globalTimer) return 0;
    if (globalTimer.isRunning) {
      return globalTimer.elapsedTime + (Date.now() - globalTimer.startTime);
    }
    return globalTimer.elapsedTime;
  };
  return (
    <header className="app-header">
      <div className="header-content">
        {/* Logo 区域 */}
        <div className="logo-section">
          <div className="logo-icon">
            <Logo />
          </div>
          <div className="logo-text">
            <h1>ReMarkable</h1>
          </div>
        </div>

        {/* 右侧工具栏 */}
        <div className="header-tools">
          {/* 全局计时器显示 - 紧凑两行布局 */}
          {globalTimer && (
            <div 
              className={`global-timer-compact ${globalTimer.isRunning ? 'running' : 'paused'}`}
              onClick={onTimerClick}
            >
              {/* 第一行：标签（使用标签颜色） */}
              <div 
                className="timer-tag-line"
                style={{ 
                  color: globalTimer.tagColor || '#8b5cf6'
                }}
              >
                {globalTimer.tagEmoji ? `${globalTimer.tagEmoji} ` : ''}
                {globalTimer.tagName}
              </div>
              
              {/* 第二行：计时（使用首页timer渐变色） */}
              <div 
                className="timer-time-line"
              >
                {formatTimerDisplay(getCurrentElapsed())}
              </div>
            </div>
          )}

          {/* 通知 */}
          <div className="notification-btn">
            <img 
              src={icons.notification} 
              alt="Notification"
              width="24"
              height="24"
            />
          </div>

          {/* 设置 */}
          <div className="setting-btn" onClick={onSettingsClick} style={{ cursor: 'pointer' }}>
            <img 
              src={icons.setting} 
              alt="Settings"
              width="24"
              height="24"
            />
          </div>

          {/* 用户头像 */}
          <div className="user-profile">
            <span>ZG</span>
          </div>
        </div>
      </div>
    </header>
  );
};

// Sidebar 导航组件
interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  clickTrackerEnabled?: boolean;
  onClickTrackerToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, clickTrackerEnabled, onClickTrackerToggle }) => {
  const menuItems = [
    { id: 'home' as PageType, label: '首页', icon: 'home' },
    { id: 'time' as PageType, label: '时光', icon: 'time' },
    { id: 'log' as PageType, label: '日志', icon: 'log' },
    { id: 'tag' as PageType, label: '标签', icon: 'tag' },
    { id: 'plan' as PageType, label: '计划', icon: 'plan' },
    { id: 'sync' as PageType, label: '同步', icon: 'sync' }
  ];

  // 处理导航点击
  const handleNavClick = (pageId: PageType, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      onPageChange(pageId);
    } catch (error) {
      console.error('[Sidebar] Error calling onPageChange:', error);
    }
  };

  // 原生事件处理作为备用方案
  const handleNativeClick = (pageId: PageType) => {
    return (event: any) => {
      if (typeof onPageChange === 'function') {
        onPageChange(pageId);
      } else {
        console.error('[Sidebar] onPageChange is not a function:', typeof onPageChange);
      }
    };
  };

  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={(e) => handleNavClick(item.id, e)}
            onTouchStart={handleNativeClick(item.id)}
            style={{ 
              pointerEvents: 'auto',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
            data-page={item.id}
            tabIndex={0}
            role="button"
            aria-label={`切换到${item.label}页面`}
          >
            <div className="nav-icon">
              <img 
                src={icons[item.icon as keyof typeof icons]} 
                alt={item.label}
                width="20"
                height="20"
                draggable={false}
                style={{ pointerEvents: 'none' }}
              />
            </div>
            <span className="nav-label" style={{ pointerEvents: 'none' }}>{item.label}</span>
          </button>
        ))}
        
        {/* Click Tracker 调试开关 */}
        {onClickTrackerToggle && (
          <div className="sidebar-divider"></div>
        )}
        {onClickTrackerToggle && (
          <button
            className={`nav-item debug-item ${clickTrackerEnabled ? 'active' : ''}`}
            onClick={onClickTrackerToggle}
            title="点击追踪调试工具"
          >
            <div className="nav-icon">
              <span style={{ fontSize: '16px' }}>🎯</span>
            </div>
            <span className="nav-label">调试</span>
          </button>
        )}
      </nav>
    </aside>
  );
};

// 底部状态栏组件  
const StatusBar: React.FC = () => {
  const [syncStatus, setSyncStatus] = React.useState({
    lastSync: null as Date | null,
    updatedEvents: 0,
    isConnected: false, // 默认未连接
    isSyncing: false,
    // 📊 详细同步统计
    syncFailed: 0,
    calendarCreated: 0,
    syncSuccess: 0
  });
  
  // 🔧 [FIX] 使用 ref 避免状态更新导致的重渲染
  const statusTextRef = React.useRef<HTMLSpanElement>(null);
  const lastUpdateRef = React.useRef<number>(0);

  // 🔧 [FIX] 优化：只在需要时加载初始状态（仅一次）
  React.useEffect(() => {
    const savedSyncTime = localStorage.getItem('lastSyncTime');
    const savedEventCount = localStorage.getItem('lastSyncEventCount');
    const isAuthenticated = localStorage.getItem('remarkable-outlook-authenticated') === 'true';
    
    if (savedSyncTime) {
      setSyncStatus({
        lastSync: new Date(savedSyncTime),
        updatedEvents: savedEventCount ? parseInt(savedEventCount) : 0,
        isConnected: isAuthenticated, // 🔧 从 localStorage 读取实际认证状态
        isSyncing: false
      });
    } else {
      // 没有同步记录，但仍需要设置认证状态
      setSyncStatus(prev => ({
        ...prev,
        isConnected: isAuthenticated
      }));
    }
    
    // 监听同步完成事件，更新状态栏时间
    const handleSyncCompleted = (event: any) => {
      const { timestamp } = event.detail;
      
      // 更新localStorage（使用本地时间格式）
      localStorage.setItem('lastSyncTime', formatTimeForStorage(timestamp));
      
      // 更新状态
      setSyncStatus(prev => ({
        ...prev,
        lastSync: timestamp,
        isSyncing: false
      }));
    };
    
    window.addEventListener('action-sync-completed', handleSyncCompleted);
    
    // 定期检查认证状态（每5秒）
    const checkAuth = setInterval(() => {
      const currentAuth = localStorage.getItem('remarkable-outlook-authenticated') === 'true';
      setSyncStatus(prev => {
        if (prev.isConnected !== currentAuth) {
          return { ...prev, isConnected: currentAuth };
        }
        return prev;
      });
    }, 5000);
    
    return () => {
      clearInterval(checkAuth);
      window.removeEventListener('action-sync-completed', handleSyncCompleted);
    };
  }, []); // 空依赖，只运行一次

  // 格式化同步状态：使用 useMemo 缓存，避免每次渲染都计算
  const formatSyncStatus = React.useCallback((lastSync: Date | null, updatedEvents: number, isSyncing: boolean) => {
    if (isSyncing) {
      return "正在同步...";
    }
    
    if (!lastSync) {
      return "尚未同步";
    }
    
    const now = Date.now();
    const syncTime = lastSync.getTime();
    const diffInMinutes = Math.floor((now - syncTime) / (1000 * 60));
    
    // 🎨 保留原有的详细格式
    const timeStr = lastSync.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    if (diffInMinutes < 1) {
      return `最后同步：${timeStr} 更新事件${updatedEvents}个`;
    } else if (diffInMinutes < 60) {
      return `最后同步：${timeStr} (${diffInMinutes}分钟前) 更新事件${updatedEvents}个`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      return `最后同步：${timeStr} (${hours}小时前) 更新事件${updatedEvents}个`;
    }
  }, []);

  // 🔧 初始文本
  const initialText = React.useMemo(() => {
    return formatSyncStatus(syncStatus.lastSync, syncStatus.updatedEvents, syncStatus.isSyncing);
  }, [syncStatus, formatSyncStatus]);

  // 🔧 [PERF] 使用 DOM 直接更新文本，避免 React 重渲染
  // 每 30 秒更新一次显示文本（不触发组件重渲染）
  React.useEffect(() => {
    if (!syncStatus.lastSync || syncStatus.isSyncing) return;
    
    const updateText = () => {
      if (!statusTextRef.current) return;
      
      const now = Date.now();
      // 🔧 限流：至少 30 秒更新一次
      if (now - lastUpdateRef.current < 30000) return;
      
      lastUpdateRef.current = now;
      const newText = formatSyncStatus(syncStatus.lastSync, syncStatus.updatedEvents, syncStatus.isSyncing);
      
      // 直接更新 DOM，不触发 React 重渲染
      if (statusTextRef.current.textContent !== newText) {
        statusTextRef.current.textContent = newText;
      }
    };
    
    // 每 30 秒更新一次
    const intervalId = setInterval(updateText, 30000);
    
    // 立即更新一次（以防启动时就过了很久）
    updateText();
    
    return () => clearInterval(intervalId);
  }, [syncStatus.lastSync, syncStatus.updatedEvents, syncStatus.isSyncing, formatSyncStatus]);

  return (
    <footer className="app-statusbar">
      <div className="status-content">
        <div className="sync-status">
          <img src={icons.sync} alt="Sync" className="sync-icon" />
          <span className="status-text" ref={statusTextRef}>
            {initialText}
          </span>
        </div>
        <div className="connection-indicators">
          <div className="outlook-connection">
            <img src={icons.outlook} alt="Outlook" className="outlook-icon" />
            <div className={`status-dot ${syncStatus.isConnected ? 'connected' : 'disconnected'}`}></div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// 主应用布局组件
const AppLayout: React.FC<AppLayoutProps> = ({ 
  currentPage, 
  onPageChange, 
  children, 
  globalTimer, 
  onTimerClick,
  clickTrackerEnabled,
  onClickTrackerToggle,
  onSettingsClick
}) => {
  return (
    <div className="app-layout">
      {/* Header */}
      <Header 
        globalTimer={globalTimer} 
        onTimerClick={onTimerClick}
        onSettingsClick={onSettingsClick}
      />
      
      {/* 侧边导航栏 */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={onPageChange}
        clickTrackerEnabled={clickTrackerEnabled}
        onClickTrackerToggle={onClickTrackerToggle}
      />
      
      {/* 主内容区 */}
      <main className="app-main">
        {children}
      </main>
      
      {/* 底部状态栏 */}
      <StatusBar />
    </div>
  );
};

export default AppLayout;