import React from 'react';
import DesktopCalendarWidget from '../components/DesktopCalendarWidgetV3';
import './DesktopCalendarTest.css';

/**
 * 桌面日历组件测试页面
 * 用于展示和测试新的基于TimeCalendar的桌面日历组件
 */
const DesktopCalendarTest: React.FC = () => {
  return (
    <div className="desktop-calendar-test">
      {/* 页面标题 */}
      <header className="test-header">
        <h1>🖥️ 桌面日历组件测试</h1>
        <p>基于 TimeCalendar 的完整桌面日历小部件</p>
      </header>

      {/* 测试区域 */}
      <main className="test-content">
        {/* 默认样式的桌面日历 */}
        <section className="test-section">
          <h2>默认桌面日历</h2>
          <div className="widget-container default">
            <DesktopCalendarWidgetV3 />
          </div>
        </section>

        {/* 自定义样式的桌面日历 */}
        <section className="test-section">
          <h2>自定义样式桌面日历</h2>
          <div className="widget-container custom">
            <DesktopCalendarWidgetV3 
              style={{
                width: '800px',
                height: '600px',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }}
            />
          </div>
        </section>

        {/* 紧凑模式的桌面日历 */}
        <section className="test-section">
          <h2>紧凑模式桌面日历</h2>
          <div className="widget-container compact">
            <DesktopCalendarWidgetV3 
              className="compact-calendar"
              style={{
                width: '400px',
                height: '300px',
                backgroundColor: 'rgba(30, 30, 30, 0.9)',
                color: '#ffffff'
              }}
            />
          </div>
        </section>
      </main>

      {/* 功能说明 */}
      <footer className="test-info">
        <h3>✨ 新功能特性</h3>
        <ul>
          <li>✅ 完整的事件显示和管理</li>
          <li>✅ 日历分组筛选功能</li>
          <li>✅ 标签筛选和管理</li>
          <li>✅ 可调节的背景透明度</li>
          <li>✅ 响应式设计和自定义样式</li>
          <li>✅ 完整的同步功能</li>
        </ul>
      </footer>
    </div>
  );
};

export default DesktopCalendarTest;