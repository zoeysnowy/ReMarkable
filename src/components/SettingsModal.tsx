import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [timerWidgetEnabled, setTimerWidgetEnabled] = useState(false);
  const [dailyStatsWidgetEnabled, setDailyStatsWidgetEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // 加载开机自启动设置
      if (window.electronAPI?.getLoginItemSettings) {
        const settings = await window.electronAPI.getLoginItemSettings();
        setAutoLaunch(settings.openAtLogin || false);
      }

      // 加载小组件配置
      if (window.electronAPI?.widget?.getConfig) {
        const timerConfig = await window.electronAPI.widget.getConfig('timer');
        const statsConfig = await window.electronAPI.widget.getConfig('dailyStats');
        setTimerWidgetEnabled(timerConfig?.enabled || false);
        setDailyStatsWidgetEnabled(statsConfig?.enabled || false);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoLaunchChange = async (enabled: boolean) => {
    setAutoLaunch(enabled);
    if (window.electronAPI?.setLoginItemSettings) {
      try {
        await window.electronAPI.setLoginItemSettings({
          openAtLogin: enabled,
          path: process.execPath
        });
      } catch (error) {
        console.error('设置开机自启动失败:', error);
      }
    }
  };

  const handleTimerWidgetChange = (enabled: boolean) => {
    setTimerWidgetEnabled(enabled);
    if (window.electronAPI?.widget?.toggle) {
      window.electronAPI.widget.toggle('timer', enabled);
    }
  };

  const handleDailyStatsWidgetChange = (enabled: boolean) => {
    setDailyStatsWidgetEnabled(enabled);
    if (window.electronAPI?.widget?.toggle) {
      window.electronAPI.widget.toggle('dailyStats', enabled);
    }
  };

  const handleApply = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>设置</h2>
          <button className="settings-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-modal-content">
          {loading ? (
            <div className="settings-loading">加载中...</div>
          ) : (
            <>
              <div className="settings-section">
                <h3>应用设置</h3>
                <div className="settings-item">
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={autoLaunch}
                      onChange={(e) => handleAutoLaunchChange(e.target.checked)}
                    />
                    <span>开机自启动</span>
                  </label>
                  <p className="settings-description">
                    应用程序将在系统启动时自动运行
                  </p>
                </div>
              </div>

              <div className="settings-section">
                <h3>桌面小组件</h3>
                <div className="settings-item">
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={timerWidgetEnabled}
                      onChange={(e) => handleTimerWidgetChange(e.target.checked)}
                    />
                    <span>计时器小组件</span>
                  </label>
                  <p className="settings-description">
                    在桌面显示独立的计时器窗口
                  </p>
                </div>

                <div className="settings-item">
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={dailyStatsWidgetEnabled}
                      onChange={(e) => handleDailyStatsWidgetChange(e.target.checked)}
                    />
                    <span>今日统计小组件</span>
                  </label>
                  <p className="settings-description">
                    在桌面显示今日统计窗口
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="settings-modal-footer">
          <button className="settings-button settings-button-primary" onClick={handleApply}>
            确定
          </button>
          <button className="settings-button" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
