import React, { useState, useEffect } from 'react';
import { formatDisplayDateTime, formatTimeForStorage } from '../utils/timeUtils';
import CalendarGroupManager from './CalendarGroupManager';

interface CalendarSyncProps {
  syncManager: any;
  microsoftService: any;
  onSettingsChange?: (settingKey: string, value: any) => void;
  onTagsUpdated?: (tags: any[]) => void;
}

const CalendarSync: React.FC<CalendarSyncProps> = ({ 
  syncManager, 
  microsoftService,
  onSettingsChange,
  onTagsUpdated
}) => {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [showCalendarManager, setShowCalendarManager] = useState(false);
  const [showElectronAuth, setShowElectronAuth] = useState(false);

  // 检测是否在 Electron 环境
  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  // 加载用户信息
  useEffect(() => {
    if (microsoftService?.isSignedIn()) {
      loadUserInfo();
    }
  }, [microsoftService]);

  const loadUserInfo = async () => {
    try {
      const info = await microsoftService.getUserInfo();
      setUserInfo(info);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  const handleConnect = async () => {
    if (isElectron) {
      // 在 Electron 环境中显示特殊的认证界面
      setShowElectronAuth(true);
      return;
    }

    setIsConnecting(true);
    setSyncMessage('');
    
    try {
      const success = await microsoftService.signIn();
      if (success) {
        await loadUserInfo();
        setSyncMessage('✅ 成功连接到 Microsoft Calendar!');
        
        // 🔧 修复：检查方法是否存在再调用
        if (syncManager) {
          if (typeof syncManager.isActive === 'function' && !syncManager.isActive()) {
            if (typeof syncManager.start === 'function') {
              syncManager.start();
            }
          }
        }
      } else {
        setSyncMessage('❌ 连接失败，请重试');
      }
    } catch (error) {
      console.error('Connection error:', error);
      setSyncMessage(`❌ 连接失败: ${error}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleElectronAuthComplete = async (authResult: any) => {
    setShowElectronAuth(false);
    setSyncMessage('✅ 认证成功！正在初始化...');
    
    try {
      // 🔧 Electron 环境：重新加载令牌
      if (microsoftService && typeof (microsoftService as any).reloadToken === 'function') {
        const reloaded = await (microsoftService as any).reloadToken();
        if (reloaded) {
          console.log('✅ [Electron] 令牌重新加载成功');
          setSyncMessage('✅ 认证成功！');
        } else {
          console.error('❌ [Electron] 令牌重新加载失败');
          setSyncMessage('⚠️ 认证成功，但初始化失败，请刷新页面');
          return;
        }
      }
      
      // 加载用户信息
      await loadUserInfo();
      
      // 启动同步
      if (syncManager) {
        if (typeof syncManager.isActive === 'function' && !syncManager.isActive()) {
          if (typeof syncManager.start === 'function') {
            syncManager.start();
          }
        }
      }
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      setSyncMessage(`❌ 初始化失败: ${error}`);
    }
  };

  const handleElectronAuthError = (error: Error) => {
    console.error('❌ 认证失败:', error);
    setSyncMessage(`❌ 认证失败: ${error.message}`);
  };

  const handleDisconnect = async () => {
    try {
      // 🔧 修复：检查方法是否存在再调用
      if (syncManager) {
        if (typeof syncManager.isActive === 'function' && syncManager.isActive()) {
          if (typeof syncManager.stop === 'function') {
            syncManager.stop();
          } else if (typeof syncManager.stopSync === 'function') {
            syncManager.stopSync(); // 兼容性支持
          }
        }
      }
      
      await microsoftService.signOut();
      setUserInfo(null);
      setSyncMessage('已断开 Microsoft Calendar 连接');
    } catch (error) {
      console.error('Disconnect error:', error);
      setSyncMessage(`断开连接失败: ${error}`);
    }
  };

  const handleForceSync = async () => {
    if (!microsoftService?.isSignedIn()) {
      setSyncMessage('❌ 请先连接 Microsoft Calendar');
      return;
    }

    try {
      setSyncMessage('🔄 正在同步...');
      
      if (syncManager && typeof syncManager.forceSync === 'function') {
        await syncManager.forceSync();
        setSyncMessage('✅ 手动同步完成!');
      } else {
        setSyncMessage('❌ 同步管理器未初始化或方法不存在');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncMessage(`❌ 同步失败: ${error}`);
    }
  };

  // 🔧 安全的方法调用辅助函数
  const safeCall = (obj: any, method: string, ...args: any[]) => {
    if (obj && typeof obj[method] === 'function') {
      try {
        return obj[method](...args);
      } catch (error) {
        console.error(`Error calling ${method}:`, error);
        return false;
      }
    }
    return false;
  };

  // 🔧 安全获取同步状态
  const getSyncStatus = () => {
    if (!syncManager) return { isActive: false, lastSync: 'N/A' };
    
    const isActive = safeCall(syncManager, 'isActive') || false;
    let lastSync = 'N/A';
    
    try {
      if (typeof syncManager.getLastSyncTime === 'function') {
        const lastSyncTime = syncManager.getLastSyncTime();
        lastSync = lastSyncTime instanceof Date ? lastSyncTime.toLocaleString() : String(lastSyncTime);
      }
    } catch (error) {
      console.error('Error getting last sync time:', error);
    }
    
    return { isActive, lastSync };
  };

  const syncStatus = getSyncStatus();

  // 如果在 Electron 环境且显示认证界面
  if (showElectronAuth) {
    return (
      <div className="calendar-sync">
        <div className="sync-header" style={{ marginBottom: '16px' }}>
          <h3>🔄 Microsoft 账户登录</h3>
          <button 
            onClick={() => setShowElectronAuth(false)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← 返回
          </button>
        </div>
        
        {isElectron && (
          <div style={{
            backgroundColor: '#e8f4fd',
            border: '1px solid #b3d9f7',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <strong>🖥️ 桌面版应用</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#004085' }}>
              推荐使用 <strong>🪟 窗口登录</strong>，在应用内完成登录，无需额外操作。
            </p>
          </div>
        )}

        <SimpleMicrosoftLogin 
          onSuccess={handleElectronAuthComplete}
          onError={handleElectronAuthError}
        />
      </div>
    );
  }

  return (
    <div className="calendar-sync">
      <div className="sync-header">
        <h3>🔄 智能日历同步</h3>
        <div className="connected-count">
          {microsoftService?.isSignedIn() ? (
            <span className="status connected">已连接</span>
          ) : (
            <span className="status disconnected">未连接</span>
          )}
        </div>
      </div>

      {/* 同步消息 */}
      {syncMessage && (
        <div className={`sync-message ${syncMessage.includes('✅') ? 'success' : 'error'}`}>
          <p>{syncMessage}</p>
          <small>时间: {formatDisplayDateTime(formatTimeForStorage(new Date()))}</small>
        </div>
      )}

      {/* Microsoft Calendar 连接 */}
      <div className="providers-list">
        <div className="provider-item">
          <div className="provider-info">
            <div className="provider-icon">📅</div>
            <div className="provider-details">
              <h4>Microsoft Outlook Calendar</h4>
              <p>同步日程安排和计时记录</p>
              <div className={`status ${microsoftService?.isSignedIn() ? 'connected' : 'disconnected'}`}>
                {microsoftService?.isSignedIn() ? '已连接' : '未连接'}
              </div>
              {userInfo && (
                <div className="user-info" style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>
                  <div>👤 {userInfo.displayName}</div>
                  <div style={{ marginTop: '2px' }}>📧 {userInfo.mail || userInfo.userPrincipalName}</div>
                </div>
              )}
            </div>
          </div>
          
          <div className="provider-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            {!microsoftService?.isSignedIn() ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="btn btn-connect"
              >
                {isConnecting ? '连接中...' : '连接'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleForceSync}
                  className="btn btn-sync"
                  style={{ minWidth: '90px' }}
                >
                  立即同步
                </button>
                <button
                  onClick={() => setShowCalendarManager(true)}
                  className="btn btn-calendar-manage"
                  style={{ minWidth: '90px' }}
                >
                  📅 日历管理
                </button>
                <button
                  onClick={handleDisconnect}
                  className="btn btn-disconnect"
                  style={{ minWidth: '90px' }}
                >
                  断开连接
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 同步状态显示 */}
      {syncManager && (
        <div className={`real-time-sync-status ${syncStatus.isActive ? 'active' : 'inactive'}`}>
          <span>
            {syncStatus.isActive ? 
              '🔄 智能同步已启用 (每20秒执行冲突解决同步)' : 
              '⏸️ 智能同步已暂停'
            }
          </span>
          <button
            className={`sync-toggle-btn ${syncStatus.isActive ? 'stop' : ''}`}
            onClick={() => {
              if (syncStatus.isActive) {
                // 🔧 修复：安全调用 stop 方法
                if (safeCall(syncManager, 'stop')) {
                  setSyncMessage('智能同步已暂停');
                } else if (safeCall(syncManager, 'stopSync')) {
                  setSyncMessage('智能同步已暂停');
                } else {
                  setSyncMessage('❌ 无法停止同步');
                }
              } else {
                // 🔧 修复：安全调用 start 方法
                if (safeCall(syncManager, 'start')) {
                  setSyncMessage('智能同步已启动');
                } else if (safeCall(syncManager, 'startSync')) {
                  setSyncMessage('智能同步已启动');
                } else {
                  setSyncMessage('❌ 无法启动同步');
                }
              }
            }}
          >
            {syncStatus.isActive ? '暂停同步' : '启动同步'}
          </button>
        </div>
      )}

      {/* 同步信息说明 */}
      <div className="sync-info">
        <h4>🔬 智能同步机制说明</h4>
        <ul>
          <li>📥 <strong>第1步</strong>：从 Outlook 获取全量数据同步到缓存</li>
          <li>📝 <strong>第2步</strong>：将本地期间内的修改合并到缓存</li>
          <li>💾 <strong>第3步</strong>：用缓存数据更新本地存储</li>
          <li>📤 <strong>第4步</strong>：将缓存变更同步到 Outlook</li>
          <li>⚡ <strong>冲突解决</strong>：本地修改优先，避免数据丢失</li>
          <li>🕒 <strong>版本控制</strong>：基于时间戳的智能冲突检测</li>
        </ul>
      </div>

      {/* 调试信息 */}
      {syncManager && (
        <div className="sync-debug" style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
          <h4>🔍 同步状态</h4>
          <p>同步模式: 智能冲突解决</p>
          <p>运行状态: {syncStatus.isActive ? '运行中' : '已停止'}</p>
          <p>最后同步: {syncStatus.lastSync}</p>
          <p>同步间隔: 20秒</p>
          <small>请打开浏览器控制台查看详细的4步同步日志</small>
          
          {/* 🔧 调试信息：显示可用方法 */}
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', color: '#007bff' }}>📋 调试：可用方法</summary>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#6c757d' }}>
              {syncManager && Object.getOwnPropertyNames(Object.getPrototypeOf(syncManager))
                .filter(name => typeof syncManager[name] === 'function')
                .map(method => (
                  <div key={method}>✅ {method}()</div>
                ))
              }
            </div>
          </details>
        </div>
      )}

      {/* 日历分组管理器 */}
      <CalendarGroupManager
        microsoftService={microsoftService}
        isOpen={showCalendarManager}
        onClose={() => setShowCalendarManager(false)}
      />
    </div>
  );
};

export default CalendarSync;