import React, { useState } from 'react';
import FloatingButton, { FloatingButtonAction } from '../components/FloatingButton';
import './FloatingButtonDemo.css';

const FloatingButtonDemo: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 10));
  };

  // Demo 1: 基础用法 - Plan 页面风格
  const planActions: FloatingButtonAction[] = [
    {
      id: 'quick-task',
      label: '快速任务',
      icon: '⚡',
      onClick: () => addLog('点击了：快速任务'),
    },
    {
      id: 'scheduled-task',
      label: '计划任务',
      icon: '📅',
      onClick: () => addLog('点击了：计划任务'),
    },
    {
      id: 'routine',
      label: '日常事项',
      icon: '🔄',
      onClick: () => addLog('点击了：日常事项'),
    },
    {
      id: 'goal',
      label: '目标',
      icon: '🎯',
      onClick: () => addLog('点击了：目标'),
    },
  ];

  // Demo 2: Log 页面风格
  const logActions: FloatingButtonAction[] = [
    {
      id: 'time-entry',
      label: '记录时间',
      icon: '⏱️',
      onClick: () => addLog('点击了：记录时间'),
    },
    {
      id: 'journal',
      label: '日志',
      icon: '📝',
      onClick: () => addLog('点击了：日志'),
    },
    {
      id: 'mood',
      label: '心情',
      icon: '😊',
      onClick: () => addLog('点击了：心情'),
    },
    {
      id: 'photo',
      label: '照片',
      icon: '📷',
      onClick: () => addLog('点击了：照片'),
      disabled: true, // 演示禁用状态
    },
  ];

  // Demo 3: 自定义颜色
  const colorActions: FloatingButtonAction[] = [
    {
      id: 'urgent',
      label: '紧急',
      icon: '🔴',
      onClick: () => addLog('点击了：紧急'),
      color: '#FF3B30',
    },
    {
      id: 'important',
      label: '重要',
      icon: '🟠',
      onClick: () => addLog('点击了：重要'),
      color: '#FF9500',
    },
    {
      id: 'normal',
      label: '普通',
      icon: '🟢',
      onClick: () => addLog('点击了：普通'),
      color: '#34C759',
    },
  ];

  // Demo 4: 横向展开
  const horizontalActions: FloatingButtonAction[] = [
    {
      id: 'left',
      label: '向左',
      icon: '←',
      onClick: () => addLog('点击了：向左'),
    },
    {
      id: 'up',
      label: '向上',
      icon: '↑',
      onClick: () => addLog('点击了：向上'),
    },
    {
      id: 'down',
      label: '向下',
      icon: '↓',
      onClick: () => addLog('点击了：向下'),
    },
    {
      id: 'right',
      label: '向右',
      icon: '→',
      onClick: () => addLog('点击了：向右'),
    },
  ];

  return (
    <div className="floating-button-demo">
      <div className="demo-header">
        <h1>FloatingButton 组件演示</h1>
        <p className="demo-description">
          基于 Tippy.js + Headless UI 的浮动操作按钮组件
        </p>
      </div>

      <div className="demo-sections">
        {/* 说明区域 */}
        <section className="demo-section">
          <h2>📖 使用说明</h2>
          <div className="info-card">
            <p>本页面展示了 FloatingButton 组件的各种用法：</p>
            <ul>
              <li>屏幕四个角落各有一个浮动按钮</li>
              <li>点击主按钮可展开子操作菜单</li>
              <li>鼠标悬停在按钮上可看到提示文本</li>
              <li>点击子操作按钮会在日志区域显示记录</li>
              <li>支持不同的颜色、方向、位置配置</li>
            </ul>
          </div>
        </section>

        {/* 配置说明 */}
        <section className="demo-section">
          <h2>⚙️ 当前演示配置</h2>
          <div className="config-grid">
            <div className="config-card">
              <h3>右下角 - Plan 风格</h3>
              <ul>
                <li>位置: bottom-right</li>
                <li>方向: up（向上展开）</li>
                <li>颜色: #007AFF（蓝色）</li>
                <li>操作数: 4 个</li>
              </ul>
            </div>

            <div className="config-card">
              <h3>左下角 - Log 风格</h3>
              <ul>
                <li>位置: bottom-left</li>
                <li>方向: up（向上展开）</li>
                <li>颜色: #FF9500（橙色）</li>
                <li>操作数: 4 个（含禁用项）</li>
              </ul>
            </div>

            <div className="config-card">
              <h3>右上角 - 自定义颜色</h3>
              <ul>
                <li>位置: top-right</li>
                <li>方向: down（向下展开）</li>
                <li>颜色: #5856D6（紫色）</li>
                <li>每个操作独立颜色</li>
              </ul>
            </div>

            <div className="config-card">
              <h3>左上角 - 横向展开</h3>
              <ul>
                <li>位置: top-left</li>
                <li>方向: right（向右展开）</li>
                <li>颜色: #34C759（绿色）</li>
                <li>横向布局演示</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 操作日志 */}
        <section className="demo-section">
          <h2>📝 操作日志</h2>
          <div className="log-container">
            {logs.length === 0 ? (
              <p className="log-empty">点击浮动按钮的子操作，这里将显示日志记录</p>
            ) : (
              <ul className="log-list">
                {logs.map((log, index) => (
                  <li key={index} className="log-item">
                    {log}
                  </li>
                ))}
              </ul>
            )}
            {logs.length > 0 && (
              <button
                className="clear-logs-btn"
                onClick={() => setLogs([])}
              >
                清空日志
              </button>
            )}
          </div>
        </section>

        {/* 代码示例 */}
        <section className="demo-section">
          <h2>💻 代码示例</h2>
          <div className="code-example">
            <pre>
              <code>{`import FloatingButton from './components/FloatingButton';

function MyPage() {
  const actions = [
    {
      id: 'task',
      label: '添加任务',
      icon: '📝',
      onClick: () => console.log('添加任务'),
    },
    {
      id: 'event',
      label: '添加事件',
      icon: '📅',
      onClick: () => console.log('添加事件'),
    },
  ];

  return (
    <div>
      <FloatingButton
        icon="+"
        actions={actions}
        position="bottom-right"
        expandDirection="up"
        color="#007AFF"
        tooltip="快速操作"
      />
    </div>
  );
}`}</code>
            </pre>
          </div>
        </section>
      </div>

      {/* 浮动按钮实例 */}
      {/* 右下角 - Plan 风格 */}
      <FloatingButton
        label="+"
        actions={planActions}
        position="bottom-right"
        expandDirection="up"
        color="#007AFF"
        tooltip="Plan 页面快速操作"
      />

      {/* 左下角 - Log 风格 */}
      <FloatingButton
        label="+"
        actions={logActions}
        position="bottom-left"
        expandDirection="up"
        color="#FF9500"
        tooltip="Log 页面快速记录"
      />

      {/* 右上角 - 自定义颜色 */}
      <FloatingButton
        label="★"
        actions={colorActions}
        position="top-right"
        expandDirection="down"
        color="#5856D6"
        tooltip="优先级设置"
      />

      {/* 左上角 - 横向展开 */}
      <FloatingButton
        label="⊕"
        actions={horizontalActions}
        position="top-left"
        expandDirection="right"
        color="#34C759"
        tooltip="方向导航"
      />
    </div>
  );
};

export default FloatingButtonDemo;
