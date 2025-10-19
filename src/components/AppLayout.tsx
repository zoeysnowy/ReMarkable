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
    startTime: number;
    elapsedTime: number;
    isPaused: boolean;
  } | null;
  onTimerClick?: () => void;
  clickTrackerEnabled?: boolean;
  onClickTrackerToggle?: () => void;
}

// Header 组件
interface HeaderProps {
  globalTimer?: {
    isRunning: boolean;
    tagId: string;
    tagName: string;
    startTime: number;
    elapsedTime: number;
    isPaused: boolean;
  } | null;
  onTimerClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ globalTimer, onTimerClick }) => {
  
  // 格式化计时器显示
  const formatTimerDisplay = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
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
          {/* 全局计时器显示 */}
          {globalTimer && (
            <div 
              className={`global-timer ${globalTimer.isRunning ? 'running' : 'paused'}`}
              onClick={onTimerClick}
            >
              <div className="timer-indicator">
                {globalTimer.isRunning ? '🟢' : '⏸️'}
              </div>
              <div className="timer-info">
                <div className="timer-text">专注中</div>
                <div className="timer-display">
                  {formatTimerDisplay(getCurrentElapsed())}
                </div>
              </div>
              <div className="timer-tag">
                {globalTimer.tagName}
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
          <div className="setting-btn">
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

  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onPageChange(item.id)}
          >
            <div className="nav-icon">
              <img 
                src={icons[item.icon as keyof typeof icons]} 
                alt={item.label}
                width="20"
                height="20"
              />
            </div>
            <span className="nav-label">{item.label}</span>
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
    isConnected: true,
    isSyncing: false
  });

  // 检查localStorage中的同步状态
  React.useEffect(() => {
    const savedSyncTime = localStorage.getItem('lastSyncTime');
    const savedEventCount = localStorage.getItem('lastSyncEventCount');
    
    if (savedSyncTime) {
      setSyncStatus(prev => ({
        ...prev,
        lastSync: new Date(savedSyncTime),
        updatedEvents: savedEventCount ? parseInt(savedEventCount) : 0
      }));
    }
  }, []);

  // 模拟同步过程的函数
  const performSync = React.useCallback(() => {
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    
    // 模拟同步延迟
    setTimeout(() => {
      const now = new Date();
      const eventCount = Math.floor(Math.random() * 10) + 1; // 随机1-10个事件
      
      setSyncStatus({
        lastSync: now,
        updatedEvents: eventCount,
        isConnected: true,
        isSyncing: false
      });
      
      // 保存到localStorage
      localStorage.setItem('lastSyncTime', formatTimeForStorage(now)); // 🔧 使用本地时间格式化
      localStorage.setItem('lastSyncEventCount', eventCount.toString());
    }, 2000); // 2秒同步延迟
  }, []);

  // 每30秒自动同步一次（在实际应用中可以调整频率）
  React.useEffect(() => {
    const syncInterval = setInterval(performSync, 30000);
    return () => clearInterval(syncInterval);
  }, [performSync]);

  const formatSyncStatus = () => {
    if (syncStatus.isSyncing) {
      return "正在同步...";
    }
    
    if (!syncStatus.lastSync) {
      return "尚未同步";
    }
    
    const now = new Date();
    const syncTime = syncStatus.lastSync;
    const diffInMinutes = Math.floor((now.getTime() - syncTime.getTime()) / (1000 * 60));
    
    let timeStr = syncTime.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    if (diffInMinutes < 1) {
      return `最后同步：${timeStr} 更新事件${syncStatus.updatedEvents}个`;
    } else if (diffInMinutes < 60) {
      return `最后同步：${timeStr} (${diffInMinutes}分钟前) 更新事件${syncStatus.updatedEvents}个`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      return `最后同步：${timeStr} (${hours}小时前) 更新事件${syncStatus.updatedEvents}个`;
    }
  };

  return (
    <footer className="app-statusbar">
      <div className="status-content">
        <div className="sync-status">
          <img src={icons.sync} alt="Sync" className="sync-icon" />
          <span className="status-text">
            {formatSyncStatus()}
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
  onClickTrackerToggle
}) => {
  return (
    <div className="app-layout">
      {/* Header */}
      <Header globalTimer={globalTimer} onTimerClick={onTimerClick} />
      
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