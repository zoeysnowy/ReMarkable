import React, { useState, useEffect } from 'react';
import PlanItemEditor, { PlanItem } from '../components/PlanItemEditor';
import FloatingButton from '../components/FloatingButton';
import { Event } from '../types';
import './PlanItemEditorDemo.css';

const PlanItemEditorDemo: React.FC = () => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<PlanItem | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [createdEvents, setCreatedEvents] = useState<Event[]>([]);
  const [availableTags] = useState<string[]>([
    '工作',
    '学习',
    '运动',
    '娱乐',
    '健康',
    '家庭',
    '阅读',
    '编程',
  ]);

  // 🔄 监听 UnifiedTimeline 事件变化
  useEffect(() => {
    const handleEventsChanged = (e: CustomEvent) => {
      console.log('📢 [Demo] 接收到事件变更通知:', e.detail);
      // 刷新事件列表
      loadEventsFromStorage();
    };

    window.addEventListener('local-events-changed' as any, handleEventsChanged);
    
    return () => {
      window.removeEventListener('local-events-changed' as any, handleEventsChanged);
    };
  }, []);

  // 📖 从 localStorage 加载事件
  const loadEventsFromStorage = () => {
    try {
      const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
      const taskEvents = events.filter((e: Event) => e.isTask);
      setCreatedEvents(taskEvents);
      console.log('📖 [Demo] 已加载事件:', taskEvents.length);
    } catch (error) {
      console.error('❌ [Demo] 加载事件失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    loadEventsFromStorage();
  }, []);

  // 示例数据
  const sampleItems: PlanItem[] = [
    {
      id: 'sample-1',
      title: '完成项目报告',
      content: '需要整理本季度的数据，制作PPT，准备5分钟演讲',
      tags: ['工作', '文档编辑'],
      color: '#000000',
      backgroundColor: '#FFF3E0',
      emoji: '📊',
      bulletStyle: 'checkbox',
      startTime: '2025-10-28T14:00',
      endTime: '2025-10-28T16:00',
      duration: 3600,
      priority: 'high',
      isCompleted: false,
      notes: '参考案例：xxx.xxx.com/xxx',
    },
    {
      id: 'sample-2',
      title: '健身计划',
      content: '30分钟跑步 + 20分钟力量训练',
      tags: ['运动', '健康'],
      color: '#34C759',
      backgroundColor: '#E8F5E9',
      emoji: '💪',
      bulletStyle: 'dot',
      startTime: '2025-10-28T18:00',
      endTime: '2025-10-28T19:00',
      duration: 1800,
      priority: 'medium',
      isCompleted: false,
    },
    {
      id: 'sample-3',
      title: '学习 React 新特性',
      content: '深入了解 React 19 的新功能和性能优化',
      tags: ['学习', '编程'],
      color: '#007AFF',
      backgroundColor: '#E3F2FD',
      emoji: '⚛️',
      bulletStyle: 'number',
      priority: 'medium',
      isCompleted: true,
      duration: 7200,
    },
  ];

  const handleOpenEditor = (item?: PlanItem) => {
    setCurrentItem(item || null);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setCurrentItem(null);
  };

  const handleSaveItem = (item: PlanItem) => {
    setPlanItems((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) => (p.id === item.id ? item : p));
      }
      return [...prev, item];
    });
    console.log('💾 [Demo] 保存计划项:', item);
    
    // 如果有时间，提示用户
    if (item.startTime) {
      console.log('✅ [Demo] 计划项包含时间，已创建 UnifiedTimeline 事件');
    }
  };

  const handleEventCreated = (event: Event) => {
    console.log('🎉 [Demo] 事件已创建并同步到 UnifiedTimeline:', event);
    setCreatedEvents((prev) => [...prev, event]);
  };

  const handleDeleteItem = (id: string) => {
    setPlanItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCreateTag = (tagName: string) => {
    console.log('🏷️ 创建新标签:', tagName);
  };

  const getBulletIcon = (style?: string) => {
    switch (style) {
      case 'dot': return '●';
      case 'number': return '1.';
      case 'checkbox': return '☑';
      default: return '';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#007AFF';
      case 'low': return '#34C759';
      default: return '#999999';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0分钟';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  // FloatingButton 操作
  const planActions = [
    {
      id: 'new-plan',
      label: '新建计划',
      icon: '➕',
      onClick: () => handleOpenEditor(),
    },
    {
      id: 'sample-1',
      label: '示例：工作任务',
      icon: '📊',
      onClick: () => handleOpenEditor(sampleItems[0]),
    },
    {
      id: 'sample-2',
      label: '示例：健身计划',
      icon: '💪',
      onClick: () => handleOpenEditor(sampleItems[1]),
    },
    {
      id: 'sample-3',
      label: '示例：学习计划',
      icon: '⚛️',
      onClick: () => handleOpenEditor(sampleItems[2]),
    },
  ];

  return (
    <div className="plan-editor-demo">
      {/* 顶部说明 */}
      <div className="demo-header">
        <h1>📝 Plan 编辑器演示</h1>
        <p className="demo-subtitle">
          参考 TagManager 设计，支持富文本编辑、标签、计时器等功能
        </p>
      </div>

      {/* 功能介绍 */}
      <div className="demo-content">
        <section className="demo-section">
          <h2>✨ 主要特性</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>富文本编辑</h3>
              <p>支持字体颜色、背景颜色、Emoji、项目符号</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏷️</div>
              <h3>标签管理</h3>
              <p>多标签选择，支持创建新标签</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏰</div>
              <h3>时间管理</h3>
              <p>开始/结束时间选择，支持时长计算</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏱️</div>
              <h3>内置计时器</h3>
              <p>实时计时，自动累计总时长</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>优先级设置</h3>
              <p>低、中、高、紧急四个级别</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>响应式设计</h3>
              <p>适配桌面端和移动端</p>
            </div>
          </div>
        </section>

        {/* 快速开始 */}
        <section className="demo-section">
          <h2>🚀 快速开始</h2>
          <div className="quick-start">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>点击右下角浮动按钮</h3>
                <p>选择"新建计划"或查看示例</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>填写计划内容</h3>
                <p>输入标题、描述，选择标签</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>使用编辑工具</h3>
                <p>点击编辑器右下角的浮动按钮，选择 Emoji、颜色等</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>设置时间和优先级</h3>
                <p>在右侧面板设置时间、启动计时器、选择优先级</p>
              </div>
            </div>
          </div>
        </section>

        {/* 已创建的计划 */}
        <section className="demo-section">
          <h2>📋 已创建的计划项 ({planItems.length})</h2>
          {planItems.length === 0 ? (
            <div className="empty-state">
              <p className="empty-icon">📝</p>
              <p className="empty-text">还没有创建任何计划项</p>
              <p className="empty-hint">点击右下角的浮动按钮开始创建吧！</p>
            </div>
          ) : (
            <div className="plan-items-list">
              {planItems.map((item) => (
                <div
                  key={item.id}
                  className={`plan-item-card ${item.isCompleted ? 'completed' : ''}`}
                  style={{ 
                    borderLeftColor: getPriorityColor(item.priority),
                    backgroundColor: item.backgroundColor 
                  }}
                >
                  <div className="plan-item-header">
                    {item.emoji && <span className="item-emoji">{item.emoji}</span>}
                    <div className="plan-item-title-wrapper">
                      {item.bulletStyle && item.bulletStyle !== 'none' && (
                        <span className="item-bullet">{getBulletIcon(item.bulletStyle)}</span>
                      )}
                      <h3 className="item-title" style={{ color: item.color }}>
                        {item.title}
                      </h3>
                    </div>
                    <span
                      className="item-priority"
                      style={{ backgroundColor: getPriorityColor(item.priority) }}
                    >
                      {item.priority?.toUpperCase()}
                    </span>
                  </div>

                  {item.content && (
                    <p className="item-content" style={{ color: item.color }}>
                      {item.content}
                    </p>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <div className="item-tags">
                      {item.tags.map((tag) => (
                        <span key={tag} className="item-tag">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="item-meta">
                    {item.startTime && (
                      <span className="meta-item">
                        ⏰ {new Date(item.startTime).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    {item.duration && (
                      <span className="meta-item">
                        ⏱️ {formatDuration(item.duration)}
                      </span>
                    )}
                  </div>

                  <div className="item-actions">
                    <button
                      className="item-action-btn"
                      onClick={() => handleOpenEditor(item)}
                    >
                      ✏️ 编辑
                    </button>
                    <button
                      className="item-action-btn delete"
                      onClick={() => handleDeleteItem(item.id)}
                    >
                      🗑️ 删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 🆕 UnifiedTimeline 事件显示 */}
        <section className="demo-section">
          <h2>🗓️ UnifiedTimeline 事件 ({createdEvents.length})</h2>
          <div className="timeline-info">
            <p>
              ℹ️ 当计划项包含明确的时间点时，会自动创建 UnifiedTimeline 事件，
              可以在 TimeCalendar 和 DesktopCalendarWidget 中查看。
            </p>
          </div>
          {createdEvents.length === 0 ? (
            <div className="empty-state">
              <p className="empty-icon">🗓️</p>
              <p className="empty-text">还没有创建带时间的事件</p>
              <p className="empty-hint">在编辑器右侧面板设置开始时间，即可创建事件</p>
            </div>
          ) : (
            <div className="events-list">
              {createdEvents.map((event) => (
                <div key={event.id} className="event-card">
                  <div className="event-header">
                    <h4 className="event-title">{event.title}</h4>
                    <span className="event-badge">
                      {event.isAllDay ? '全天' : '定时'}
                    </span>
                  </div>
                  {event.description && (
                    <p className="event-description">{event.description}</p>
                  )}
                  <div className="event-meta">
                    <span className="meta-item">
                      📅 {new Date(event.startTime).toLocaleString('zh-CN')}
                    </span>
                    {event.location && (
                      <span className="meta-item">📍 {event.location}</span>
                    )}
                  </div>
                  {event.tags && event.tags.length > 0 && (
                    <div className="event-tags">
                      {event.tags.map((tag) => (
                        <span key={tag} className="event-tag">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="event-sync-status">
                    <span className={`sync-badge sync-${event.syncStatus}`}>
                      {event.syncStatus === 'pending' && '⏳ 待同步'}
                      {event.syncStatus === 'synced' && '✅ 已同步'}
                      {event.syncStatus === 'error' && '❌ 同步失败'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
                  </div>

                  <div className="item-actions">
                    <button
                      className="item-action-btn"
                      onClick={() => handleOpenEditor(item)}
                    >
                      ✏️ 编辑
                    </button>
                    <button
                      className="item-action-btn delete"
                      onClick={() => handleDeleteItem(item.id)}
                    >
                      🗑️ 删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 代码示例 */}
        <section className="demo-section">
          <h2>💻 使用示例</h2>
          <div className="code-block">
            <pre>
              <code>{`import PlanItemEditor from './components/PlanItemEditor';

function MyPlanPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);

  const handleSave = (item) => {
    console.log('保存计划:', item);
    // 保存到数据库或状态管理
  };

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>
        创建新计划
      </button>

      <PlanItemEditor
        item={currentItem}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
        availableTags={['工作', '学习', '运动']}
        onCreateTag={(tag) => console.log('新标签:', tag)}
      />
    </div>
  );
}`}</code>
            </pre>
          </div>
        </section>

        {/* API 文档 */}
        <section className="demo-section">
          <h2>📖 API 文档</h2>
          <div className="api-table">
            <table>
              <thead>
                <tr>
                  <th>属性</th>
                  <th>类型</th>
                  <th>说明</th>
                  <th>必填</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>item</code></td>
                  <td>PlanItem | null</td>
                  <td>要编辑的计划项，为 null 时创建新项</td>
                  <td>否</td>
                </tr>
                <tr>
                  <td><code>isOpen</code></td>
                  <td>boolean</td>
                  <td>是否显示编辑器</td>
                  <td>是</td>
                </tr>
                <tr>
                  <td><code>onClose</code></td>
                  <td>() =&gt; void</td>
                  <td>关闭编辑器的回调</td>
                  <td>是</td>
                </tr>
                <tr>
                  <td><code>onSave</code></td>
                  <td>(item: PlanItem) =&gt; void</td>
                  <td>保存计划项的回调</td>
                  <td>是</td>
                </tr>
                <tr>
                  <td><code>availableTags</code></td>
                  <td>string[]</td>
                  <td>可选的标签列表</td>
                  <td>否</td>
                </tr>
                <tr>
                  <td><code>onCreateTag</code></td>
                  <td>(tag: string) =&gt; void</td>
                  <td>创建新标签的回调</td>
                  <td>否</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* FloatingButton */}
      <FloatingButton
        icon="➕"
        actions={planActions}
        position="bottom-right"
        expandDirection="up"
        color="#007AFF"
        tooltip="Plan 操作"
      />

      {/* PlanItemEditor */}
      <PlanItemEditor
        item={currentItem}
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        onSave={handleSaveItem}
        availableTags={availableTags}
        onCreateTag={handleCreateTag}
      />
    </div>
  );
};

export default PlanItemEditorDemo;
