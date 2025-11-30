# GoldenLayout 实施计划

> **创建时间**: 2025-12-01  
> **关联文档**: [TimeLog_&_Description_PRD.md](./TimeLog_&_Description_PRD.md)  
> **架构决策**: GoldenLayout 作为 ReMarkable App 通用布局系统

---

## 📋 总览

### 战略定位

GoldenLayout 不仅是 TimeLog 的标签页组件，而是 **ReMarkable App 的通用布局管理基础设施**。

**三大应用场景**:
1. **TimeLog 页面**: 多标签编辑、弹出窗口、分屏对比
2. **Homepage Dashboard**: 自由配置的仪表盘
3. **Windows Desktop Widgets**: 桌面悬浮小组件

### 投资回报分析

| 维度 | 传统方案 | GoldenLayout 方案 | 优势 |
|------|---------|------------------|------|
| 开发时间 | 每个功能单独开发（4-6周） | 一次封装，处处复用（2-3周） | **节省 50%+ 时间** |
| 代码量 | 多套布局管理代码 | 统一的布局系统 | **减少 60%+ 代码** |
| 用户体验 | 不一致 | 统一交互模式 | **降低学习成本** |
| 维护成本 | 多处维护 | 单点维护 | **降低 70%+ 维护成本** |

---

## 🎯 实施计划（3 Phases，8-10 周）

### Phase 1: TimeLog 标签页功能（2-3 周）

**目标**: 在 TimeLog 页面实现多标签编辑功能

**📐 Figma 设计规格分析** (Node ID: 486-2661)

当前 TimeLog 页面固定布局：
```
┌─────────┬──────────────┬──────────────────────────┬────────────┐
│ Left    │ Content      │ Main Timeline            │ Right FAB  │
│ Sidebar │ Selection    │ 时光日志                   │ (Floating) │
│ 96px    │ 342px        │ 905px                    │ 80px       │
│         │              │                          │            │
│ 首页    │ 📅 Calendar  │ 2025.10.18（周六）        │ 记录此刻    │
│ [时光]  │ 🔍 Search    │ ┌─────────────────────┐  │ 语音记录    │
│ 日志    │ 标签/事项/   │ │ 10:00 - 12:00       │  │ 图片       │
│ 标签    │ 收藏/New     │ │ 🎙️ 议程讨论          │  │ 音频       │
│ 计划    │              │ │ #👜工作/#🧐文档编辑  │  │ 视频       │
│ 追踪    │ #🔮Remarkable│ │ Zoey Gong; Jenny... │  │ 文档       │
│ 同步    │   开发 (3/7) │ │ 静安嘉里中心2座...   │  │ 项目       │
│         │ #🔮PRD文档   │ │ 太强了！居然直接...   │  │ 网页收藏    │
│         │   (3/7)      │ └─────────────────────┘  │ 导出       │
│         │ #🔮码代码    │                          │            │
│         │   (3/7)      │ 10:00 - 12:00           │            │
│         │              │ 🎓 准备演讲稿            │            │
│         │              │ #👜工作/#🧐文档编辑      │            │
│         │              │ ...                     │            │
└─────────┴──────────────┴──────────────────────────┴────────────┘
│ 最后同步：2025-10-13 00:28:43  更新事件3个  ☁️🔴📧          │
└──────────────────────────────────────────────────────────────────┘
```

**GoldenLayout 改造目标**：
1. ✅ 保留固定布局作为默认视图
2. ✅ "内容选取"面板可拖拽成悬浮窗或隐藏
3. ✅ "时光日志"主区域支持标签页切换
4. ✅ 事件卡片可双击弹出编辑窗口
5. ✅ 支持分屏对比不同时间段的日志
6. ✅ 布局配置可保存（localStorage）

#### Week 1: 安装和封装 GoldenLayout

**步骤 1.1: 安装依赖**

```bash
# 安装 GoldenLayout v2.6.0（稳定版）
npm install golden-layout@2.6.0

# 安装类型定义
npm install --save-dev @types/golden-layout

# 安装 React 18 相关依赖（如果未安装）
npm install react@18 react-dom@18
```

**步骤 1.2: 创建 GoldenLayout 封装组件**

```typescript
// src/components/layout/GoldenLayoutWrapper.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import GoldenLayout, { ComponentContainer, ComponentConfig } from 'golden-layout';
import 'golden-layout/dist/css/goldenlayout-base.css';
import 'golden-layout/dist/css/goldenlayout-dark-theme.css';
import './GoldenLayoutWrapper.css';

// 布局配置接口
export interface LayoutConfig {
  content: any[];
  settings?: {
    showPopoutIcon?: boolean;     // 显示弹出图标
    showMaximiseIcon?: boolean;   // 显示最大化图标
    showCloseIcon?: boolean;      // 显示关闭图标
    constrainDragToContainer?: boolean; // 限制拖拽在容器内
  };
  dimensions?: {
    borderWidth?: number;
    minItemHeight?: number;
    minItemWidth?: number;
    headerHeight?: number;
    dragProxyWidth?: number;
    dragProxyHeight?: number;
  };
}

// 组件注册接口
export interface ComponentRegistration {
  name: string;
  component: React.ComponentType<any>;
}

// Props 接口
export interface GoldenLayoutWrapperProps {
  config: LayoutConfig;
  components: ComponentRegistration[];
  onLayoutChange?: (config: any) => void;
  onComponentDestroy?: (componentName: string, state: any) => void;
  className?: string;
}

export const GoldenLayoutWrapper: React.FC<GoldenLayoutWrapperProps> = ({
  config,
  components,
  onLayoutChange,
  onComponentDestroy,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<GoldenLayout | null>(null);
  const rootsRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    // 创建 GoldenLayout 实例
    const layout = new GoldenLayout(config, containerRef.current);

    // 注册所有组件
    components.forEach(({ name, component: Component }) => {
      layout.registerComponent(name, (container: ComponentContainer, state: any) => {
        const element = container.getElement()[0];
        const rootId = `${name}-${Math.random().toString(36).substr(2, 9)}`;

        // 使用 React 18 的 createRoot API
        const root = ReactDOM.createRoot(element);
        rootsRef.current.set(rootId, root);

        // 渲染 React 组件
        root.render(
          <Component 
            {...state} 
            container={container}
            onUpdate={(newState: any) => {
              // 更新组件状态
              container.setState(newState);
            }}
          />
        );

        // 监听容器销毁事件
        container.on('destroy', () => {
          // 清理 React root
          const rootToUnmount = rootsRef.current.get(rootId);
          if (rootToUnmount) {
            rootToUnmount.unmount();
            rootsRef.current.delete(rootId);
          }

          // 触发销毁回调
          if (onComponentDestroy) {
            onComponentDestroy(name, container.getState());
          }
        });

        // 监听容器大小变化
        container.on('resize', () => {
          // 触发 React 组件重新渲染（如果需要）
          root.render(
            <Component 
              {...state} 
              container={container}
              onUpdate={(newState: any) => container.setState(newState)}
            />
          );
        });
      });
    });

    // 监听布局状态变化
    if (onLayoutChange) {
      layout.on('stateChanged', () => {
        const currentConfig = layout.toConfig();
        onLayoutChange(currentConfig);
      });
    }

    // 初始化布局
    layout.init();
    layoutRef.current = layout;

    // 清理函数
    return () => {
      // 清理所有 React roots
      rootsRef.current.forEach(root => root.unmount());
      rootsRef.current.clear();

      // 销毁布局
      if (layoutRef.current) {
        layoutRef.current.destroy();
        layoutRef.current = null;
      }
    };
  }, [config, components, onLayoutChange, onComponentDestroy]);

  return (
    <div 
      ref={containerRef} 
      className={`golden-layout-container ${className || ''}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
```

**步骤 1.3: 创建样式文件**

```css
/* src/components/layout/GoldenLayoutWrapper.css */

/* 基础容器样式 */
.golden-layout-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 深色主题（默认）*/
.golden-layout-container {
  --gl-color-bg: #1e1e1e;
  --gl-color-text: #e0e0e0;
  --gl-color-border: #333;
  --gl-color-tab-active: #2d2d2d;
  --gl-color-tab-hover: #252525;
  --gl-color-tab-bg: #1e1e1e;
  --gl-color-header-bg: #252525;
}

/* 浅色主题 */
.golden-layout-container.light-theme {
  --gl-color-bg: #ffffff;
  --gl-color-text: #333333;
  --gl-color-border: #ddd;
  --gl-color-tab-active: #f5f5f5;
  --gl-color-tab-hover: #e8e8e8;
  --gl-color-tab-bg: #ffffff;
  --gl-color-header-bg: #f9f9f9;
}

/* 自定义标签页样式 */
.golden-layout-container .lm_header {
  background: var(--gl-color-header-bg);
  border-bottom: 1px solid var(--gl-color-border);
}

.golden-layout-container .lm_header .lm_tab {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  padding: 8px 12px;
  background: var(--gl-color-tab-bg);
  color: var(--gl-color-text);
  border-right: 1px solid var(--gl-color-border);
  transition: background 0.2s;
}

.golden-layout-container .lm_header .lm_tab:hover {
  background: var(--gl-color-tab-hover);
}

.golden-layout-container .lm_header .lm_tab.lm_active {
  background: var(--gl-color-tab-active);
  border-bottom: 2px solid #0078d4;
}

.golden-layout-container .lm_header .lm_tab .lm_title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 4px;
}

/* 关闭按钮样式 */
.golden-layout-container .lm_header .lm_tab .lm_close_tab {
  width: 16px;
  height: 16px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.golden-layout-container .lm_header .lm_tab:hover .lm_close_tab {
  opacity: 1;
}

/* 内容区域样式 */
.golden-layout-container .lm_content {
  background: var(--gl-color-bg);
  overflow: auto;
}

/* 拖拽代理样式 */
.golden-layout-container .lm_dragProxy {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--gl-color-border);
  background: var(--gl-color-bg);
  opacity: 0.8;
}

/* 分割线样式 */
.golden-layout-container .lm_splitter {
  background: var(--gl-color-border);
  opacity: 0.3;
  transition: opacity 0.2s;
}

.golden-layout-container .lm_splitter:hover {
  opacity: 1;
  background: #0078d4;
}

/* 弹出窗口样式 */
.golden-layout-container .lm_popin {
  cursor: pointer;
}

.golden-layout-container .lm_popin:hover {
  background: var(--gl-color-tab-hover);
}
```

---

#### Week 2: 实现 TimeLog 标签页容器

**步骤 2.1: 创建 EventLogEditor 组件**

```typescript
// src/pages/TimeLog/EventLogEditor.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ComponentContainer } from 'golden-layout';
import { EventService } from '@/services/EventService';
import { Event } from '@/types/Event';
import { SlateEditor } from '@/components/editor/SlateEditor';
import './EventLogEditor.css';

export interface EventLogEditorProps {
  eventId: string;
  container: ComponentContainer;
  onUpdate: (state: any) => void;
}

export const EventLogEditor: React.FC<EventLogEditorProps> = ({
  eventId,
  container,
  onUpdate,
}) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 加载事件数据
  useEffect(() => {
    const loadEvent = async () => {
      const eventData = await EventService.getEventById(eventId);
      setEvent(eventData);
    };
    loadEvent();
  }, [eventId]);

  // 监听内容变化
  const handleChange = useCallback((newContent: any) => {
    setIsDirty(true);
    
    // 更新标签标题（显示未保存标记）
    const currentTitle = container.tab?.element?.find('.lm_title')?.text() || '';
    if (!currentTitle.endsWith(' ●')) {
      container.setTitle(`${currentTitle} ●`);
    }
  }, [container]);

  // 保存事件
  const handleSave = useCallback(async () => {
    if (!event || !isDirty) return;

    setIsSaving(true);
    try {
      await EventService.updateEvent(eventId, {
        eventlog: event.eventlog,
        updatedAt: new Date(),
      });
      
      setIsDirty(false);
      
      // 移除未保存标记
      const currentTitle = container.tab?.element?.find('.lm_title')?.text() || '';
      container.setTitle(currentTitle.replace(' ●', ''));
      
      // 显示保存成功提示
      console.log('✅ 保存成功');
    } catch (error) {
      console.error('❌ 保存失败', error);
    } finally {
      setIsSaving(false);
    }
  }, [event, eventId, isDirty, container]);

  // 键盘快捷键：Ctrl+S 保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (!event) {
    return <div className="event-log-editor-loading">加载中...</div>;
  }

  return (
    <div className="event-log-editor">
      {/* 工具栏 */}
      <div className="event-log-editor-toolbar">
        <div className="toolbar-left">
          <span className="event-emoji">{event.emoji || '📝'}</span>
          <h3 className="event-title">{event.title || 'Untitled Event'}</h3>
        </div>
        <div className="toolbar-right">
          {isDirty && <span className="dirty-indicator">未保存</span>}
          <button 
            onClick={handleSave} 
            disabled={!isDirty || isSaving}
            className="btn-save"
          >
            {isSaving ? '保存中...' : '保存 (Ctrl+S)'}
          </button>
        </div>
      </div>

      {/* Slate 编辑器 */}
      <div className="event-log-editor-content">
        <SlateEditor
          value={event.eventlog ? JSON.parse(event.eventlog) : []}
          onChange={handleChange}
          placeholder="开始记录..."
        />
      </div>
    </div>
  );
};
```

**步骤 2.2: 创建 TimeLogTabsContainer**

```typescript
// src/pages/TimeLog/TimeLogTabsContainer.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { GoldenLayoutWrapper, LayoutConfig } from '@/components/layout/GoldenLayoutWrapper';
import { EventLogEditor } from './EventLogEditor';
import { EventService } from '@/services/EventService';
import './TimeLogTabsContainer.css';

interface TimeLogTab {
  id: string;
  eventId: string;
  title: string;
  emoji?: string;
}

export const TimeLogTabsContainer: React.FC = () => {
  const [tabs, setTabs] = useState<TimeLogTab[]>([]);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);

  // 从 localStorage 恢复布局
  useEffect(() => {
    const savedLayout = localStorage.getItem('timelog-layout');
    if (savedLayout) {
      try {
        const config = JSON.parse(savedLayout);
        setLayoutConfig(config);
      } catch (error) {
        console.error('恢复布局失败', error);
      }
    }
  }, []);

  // 打开新标签
  const openTab = useCallback((eventId: string) => {
    const event = EventService.getEventById(eventId);
    if (!event) {
      console.error('Event not found:', eventId);
      return;
    }

    const newTab: TimeLogTab = {
      id: `tab-${eventId}`,
      eventId,
      title: event.title || 'Untitled Event',
      emoji: event.emoji,
    };

    setTabs(prev => {
      // 检查是否已存在
      if (prev.find(t => t.eventId === eventId)) {
        console.log('标签已存在，激活该标签');
        return prev;
      }
      return [...prev, newTab];
    });

    // 更新布局配置
    setLayoutConfig(prev => {
      if (!prev) {
        // 首次创建布局
        return {
          settings: {
            showPopoutIcon: true,
            showMaximiseIcon: true,
            showCloseIcon: true,
          },
          content: [{
            type: 'stack',
            content: [{
              type: 'component',
              componentName: 'eventEditor',
              componentState: { eventId, tabId: newTab.id },
              title: `${newTab.emoji || '📝'} ${newTab.title}`,
              isClosable: true,
            }]
          }]
        };
      }

      // 添加新标签到现有 stack
      const newConfig = JSON.parse(JSON.stringify(prev));
      const stack = newConfig.content[0];
      
      // 检查是否已存在（避免重复）
      const exists = stack.content.some((item: any) => 
        item.componentState?.eventId === eventId
      );
      
      if (!exists) {
        stack.content.push({
          type: 'component',
          componentName: 'eventEditor',
          componentState: { eventId, tabId: newTab.id },
          title: `${newTab.emoji || '📝'} ${newTab.title}`,
          isClosable: true,
        });
      }

      return newConfig;
    });
  }, []);

  // 保存布局配置
  const handleLayoutChange = useCallback((config: any) => {
    localStorage.setItem('timelog-layout', JSON.stringify(config));
  }, []);

  // 监听组件销毁（标签关闭）
  const handleComponentDestroy = useCallback((componentName: string, state: any) => {
    if (componentName === 'eventEditor' && state.eventId) {
      setTabs(prev => prev.filter(t => t.eventId !== state.eventId));
      console.log('标签已关闭:', state.eventId);
    }
  }, []);

  // 暴露 openTab 方法给外部（通过 Context 或 Event）
  useEffect(() => {
    // 监听打开标签事件
    const handleOpenTabEvent = (event: CustomEvent) => {
      const { eventId } = event.detail;
      openTab(eventId);
    };

    window.addEventListener('openTimeLogTab', handleOpenTabEvent as EventListener);
    return () => {
      window.removeEventListener('openTimeLogTab', handleOpenTabEvent as EventListener);
    };
  }, [openTab]);

  // 组件注册
  const components = [
    {
      name: 'eventEditor',
      component: EventLogEditor,
    },
  ];

  if (!layoutConfig) {
    return (
      <div className="timelog-tabs-empty">
        <div className="empty-state">
          <h2>📝 开始编辑</h2>
          <p>点击左侧事件卡片开始记录日志</p>
          <div className="empty-tips">
            <p>💡 小提示：</p>
            <ul>
              <li>可以同时打开多个事件标签</li>
              <li>拖拽标签到浏览器外可以创建独立窗口</li>
              <li>支持分屏对比不同事件</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="timelog-tabs-container">
      <GoldenLayoutWrapper
        config={layoutConfig}
        components={components}
        onLayoutChange={handleLayoutChange}
        onComponentDestroy={handleComponentDestroy}
      />
    </div>
  );
};
```

---

#### Week 3: 集成和测试

**步骤 3.1: 集成到 TimeLog 页面**

```typescript
// src/pages/TimeLog.tsx (修改)
import React, { useState, useCallback } from 'react';
import { ContentSelectionPanel } from '@/components/ContentSelectionPanel';
import { TimeLogTabsContainer } from './TimeLog/TimeLogTabsContainer';
import './TimeLog.css';

export const TimeLog: React.FC = () => {
  // 处理事件卡片点击
  const handleEventClick = useCallback((eventId: string) => {
    // 触发打开标签事件
    const event = new CustomEvent('openTimeLogTab', {
      detail: { eventId }
    });
    window.dispatchEvent(event);
  }, []);

  return (
    <div className="timelog-page">
      {/* 左侧：内容选择面板 */}
      <div className="timelog-sidebar">
        <ContentSelectionPanel
          onEventClick={handleEventClick}
        />
      </div>

      {/* 中间：标签页容器 */}
      <div className="timelog-main">
        <TimeLogTabsContainer />
      </div>

      {/* 右侧：操作按钮（保留原设计）*/}
      <div className="timelog-actions">
        <button className="action-btn" title="新建事件">
          <span>➕</span>
        </button>
        <button className="action-btn" title="搜索">
          <span>🔍</span>
        </button>
        <button className="action-btn" title="设置">
          <span>⚙️</span>
        </button>
      </div>
    </div>
  );
};
```

**步骤 3.2: 测试清单**

- [ ] 标签页打开/关闭/切换
- [ ] 多标签同时编辑
- [ ] 未保存提示（标签标题显示 ●）
- [ ] Ctrl+S 快捷键保存
- [ ] 布局持久化（刷新页面后恢复）
- [ ] 拖拽标签排序
- [ ] 拖拽标签创建分屏
- [ ] 弹出窗口功能
- [ ] 性能测试（同时打开 10+ 标签）

---

### 📐 Figma 设计实现指南 (Phase 1 详细规格)

> **Figma 文件**: https://www.figma.com/design/T0WLjzvZMqEnpX79ILhSNQ/ReMarkable-0.1?node-id=486-2661  
> **设计稿截图**: 已提取 TimeLog v1 完整设计规格

#### 布局结构映射

**1. 固定布局（默认视图）**

```typescript
// src/pages/TimeLog/TimeLogLayout.tsx
export const DEFAULT_TIMELOG_LAYOUT: LayoutConfig = {
  settings: {
    showPopoutIcon: true,
    showMaximiseIcon: true,
    showCloseIcon: true,
    constrainDragToContainer: false, // 允许拖拽到外部创建弹窗
  },
  dimensions: {
    borderWidth: 5,
    minItemHeight: 200,
    minItemWidth: 300,
    headerHeight: 32,
  },
  content: [{
    type: 'row',
    content: [
      // 左侧：内容选取面板（可拖拽成浮窗）
      {
        type: 'component',
        componentName: 'contentSelectionPanel',
        componentState: {},
        title: '内容选取',
        isClosable: true,
        width: 25, // 342px / 1344px ≈ 25%
      },
      // 右侧：时光日志主区域（标签容器）
      {
        type: 'stack',
        content: [{
          type: 'component',
          componentName: 'timelineView',
          componentState: { date: '2025-10-18' },
          title: '时光日志',
          isClosable: false, // 主视图不可关闭
        }],
        width: 75, // 905px / 1344px ≈ 75%
      }
    ]
  }]
};
```

**2. 事件卡片点击交互**

```typescript
// src/components/ContentSelectionPanel/EventCard.tsx
export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  const handleClick = (e: React.MouseEvent) => {
    // 单击：在主区域打开标签（或激活已有标签）
    onClick(event.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 双击：弹出独立编辑窗口
    const popupEvent = new CustomEvent('openEventPopup', {
      detail: { 
        eventId: event.id,
        position: { x: e.clientX, y: e.clientY }
      }
    });
    window.dispatchEvent(popupEvent);
  };

  return (
    <div 
      className="event-card"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-event-id={event.id}
    >
      {/* Figma 设计规格：
          - 高度: 每个事件卡片约 188px
          - 内边距: 20px
          - 边框: 1px solid rgba(229, 231, 235, 0.5)
          - 圆角: 10px
      */}
      <div className="event-time">
        {/* 10:00 - 12:00 格式 */}
        <span>{formatTime(event.startTime)}</span>
        <span className="time-divider">—</span>
        <span>{formatTime(event.endTime)}</span>
        <span className="event-duration">{calculateDuration(event)}</span>
      </div>
      
      <div className="event-header">
        <span className="event-emoji">{event.emoji}</span>
        <h3 className="event-title">{event.title}</h3>
        <span className="sync-indicator">
          {event.syncSource === 'outlook' && '☁️'}
          {event.syncStatus === 'syncing' && '🔄'}
        </span>
      </div>
      
      <div className="event-tags">
        {event.tags.map(tag => (
          <span key={tag.id} className="tag" style={{ color: tag.color }}>
            #{tag.emoji}{tag.name}
          </span>
        ))}
      </div>
      
      {event.attendees && (
        <div className="event-attendees">
          <span className="icon">👥</span>
          <span className="text">{event.attendees.join('; ')}</span>
        </div>
      )}
      
      {event.location && (
        <div className="event-location">
          <span className="icon">📍</span>
          <span className="text">{event.location}</span>
        </div>
      )}
      
      <div className="event-description">
        {truncate(event.description, 120)}
      </div>
    </div>
  );
};
```

**3. 标签页布局状态**

```typescript
// 状态 A: 单标签默认视图
┌────────────────────────────────────────┐
│ [时光日志]                              │
│ ┌────────────────────────────────────┐ │
│ │ 2025.10.18（周六）                  │ │
│ │ 10:00 - 12:00                      │ │
│ │ 🎙️ 议程讨论                        │ │
│ │ ...                                │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘

// 状态 B: 多标签编辑
┌────────────────────────────────────────┐
│ [2025.10.18] [2025.10.19 ●] [📝 会议纪要] │
│ ┌────────────────────────────────────┐ │
│ │ 🎓 准备演讲稿                       │ │
│ │ ┌─────────────────────────────┐   │ │
│ │ │ [Slate Editor 编辑区]       │   │ │
│ │ │ 光标位置                     │   │ │
│ │ └─────────────────────────────┘   │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘

// 状态 C: 分屏对比
┌────────────────────────────────────────┐
│ [2025.10.18] [2025.10.19]              │
│ ┌─────────────────┬──────────────────┐ │
│ │ 议程讨论         │ 准备演讲稿        │ │
│ │ 10:00-12:00     │ 10:00-12:00      │ │
│ │ ...             │ ...              │ │
│ └─────────────────┴──────────────────┘ │
└────────────────────────────────────────┘

// 状态 D: 弹出窗口
[浏览器主窗口]          [独立弹窗]
TimeLog Page         ┌──────────────┐
                     │ 📝 会议纪要   │
                     │ [Slate Editor]│
                     │ ...          │
                     └──────────────┘
```

**4. 样式规格（CSS Variables）**

```css
/* src/pages/TimeLog/TimeLog.css */
:root {
  /* Figma 设计 Token */
  --timelog-sidebar-width: 342px;
  --timelog-main-width: 905px;
  --timelog-left-nav-width: 96px;
  --timelog-right-fab-width: 80px;
  
  /* 事件卡片 */
  --event-card-padding: 20px;
  --event-card-gap: 12px;
  --event-card-border: 1px solid rgba(229, 231, 235, 0.5);
  --event-card-radius: 10px;
  --event-card-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
  
  /* 标签颜色映射 */
  --tag-work: #a855f7; /* #👜工作 */
  --tag-doc: #3b82f6;  /* #🧐文档编辑 */
  --tag-code: #10b981; /* #🔮码代码 */
  
  /* GoldenLayout 主题覆盖 */
  --gl-tab-height: 32px;
  --gl-border-color: #e5e7eb;
  --gl-selected-tab-bg: linear-gradient(to right, #a855f7, #3b82f6);
  --gl-selected-tab-color: #ffffff;
}

.timelog-page {
  display: grid;
  grid-template-columns: var(--timelog-left-nav-width) var(--timelog-sidebar-width) 1fr var(--timelog-right-fab-width);
  height: 100vh;
  background: #f3f4f6;
}

/* GoldenLayout 容器样式覆盖 */
.timelog-tabs-container .lm_goldenlayout {
  background: white;
  border-radius: 20px;
  box-shadow: 0px 10px 10px 32px rgba(0, 0, 0, 0.1);
}

.timelog-tabs-container .lm_header {
  background: linear-gradient(to right, #a855f7, #3b82f6);
  border-radius: 20px 20px 0 0;
}

.timelog-tabs-container .lm_tab.lm_active {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-weight: 600;
}

.timelog-tabs-container .lm_content {
  background: white;
  overflow: auto;
}
```

**5. 动画和交互**

```typescript
// src/pages/TimeLog/animations.ts
export const TIMELOG_ANIMATIONS = {
  // 标签切换动画
  tabSwitch: {
    duration: 200,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // 拖拽反馈
  dragStart: {
    scale: 1.05,
    opacity: 0.8,
    cursor: 'grabbing',
  },
  
  // 弹出窗口动画
  popupOpen: {
    duration: 300,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)', // ease-out-expo
    transform: 'scale(0.9) translateY(20px)',
  },
  
  // 保存成功提示
  saveSuccess: {
    duration: 2000,
    fadeIn: 200,
    fadeOut: 500,
  },
};
```

**6. 性能优化点**

```typescript
// src/pages/TimeLog/optimization.ts
export const TIMELOG_PERFORMANCE = {
  // 虚拟滚动配置（处理大量事件）
  virtualScroll: {
    itemHeight: 188, // 事件卡片高度
    overscanCount: 3, // 预渲染3个卡片
    threshold: 20,    // 超过20个事件启用虚拟滚动
  },
  
  // 标签限制
  maxTabs: 10, // 最多同时打开10个标签
  warnThreshold: 7, // 7个标签时提示性能影响
  
  // 自动保存
  autoSaveDelay: 2000, // 2秒防抖
  batchSize: 50, // 批量保存最多50个变更
  
  // 布局缓存
  layoutCacheKey: 'timelog-layout-v1',
  layoutCacheTTL: 7 * 24 * 60 * 60 * 1000, // 7天
};
```

---

### Phase 2: Homepage Dashboard（3-4 周）

**目标**: 实现可自由配置的仪表盘

#### Week 1: 设计组件库

**创建 Dashboard 组件**

```typescript
// src/components/dashboard/TimeStatsWidget.tsx
import React from 'react';
import { ComponentContainer } from 'golden-layout';
import './TimeStatsWidget.css';

export interface TimeStatsWidgetProps {
  container: ComponentContainer;
}

export const TimeStatsWidget: React.FC<TimeStatsWidgetProps> = ({ container }) => {
  return (
    <div className="widget time-stats">
      <div className="widget-header">
        <h3>📊 时间统计</h3>
        <button className="widget-settings">⚙️</button>
      </div>
      
      <div className="widget-content">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">今日工作时长</span>
            <span className="stat-value">5h 23m</span>
            <span className="stat-trend">+15%</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">本周专注时长</span>
            <span className="stat-value">32h 15m</span>
            <span className="stat-trend">+8%</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">本月完成事件</span>
            <span className="stat-value">47</span>
            <span className="stat-trend">+22%</span>
          </div>
        </div>
        
        <div className="stats-chart">
          {/* 可以集成 recharts 或 Chart.js */}
        </div>
      </div>
    </div>
  );
};
```

```typescript
// src/components/dashboard/TaskReminderWidget.tsx
export const TaskReminderWidget: React.FC = () => {
  return (
    <div className="widget task-reminder">
      <div className="widget-header">
        <h3>✅ 任务提醒</h3>
        <span className="badge">5</span>
      </div>
      
      <div className="widget-content">
        <ul className="task-list">
          <li className="task-item urgent">
            <span className="task-checkbox">☐</span>
            <span className="task-title">准备演讲稿</span>
            <span className="task-deadline">还剩 2h</span>
          </li>
          <li className="task-item">
            <span className="task-checkbox">☐</span>
            <span className="task-title">Review PR #123</span>
            <span className="task-deadline">今天</span>
          </li>
          <li className="task-item">
            <span className="task-checkbox">☐</span>
            <span className="task-title">更新文档</span>
            <span className="task-deadline">明天</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
```

#### Week 2-3: 实现 Dashboard 配置器

```typescript
// src/pages/Homepage/DashboardManager.tsx
import React, { useState, useCallback } from 'react';
import { GoldenLayoutWrapper, LayoutConfig } from '@/components/layout/GoldenLayoutWrapper';
import * as Widgets from '@/components/dashboard';
import './DashboardManager.css';

interface DashboardPreset {
  name: string;
  config: LayoutConfig;
}

export const DashboardManager: React.FC = () => {
  const [presets, setPresets] = useState<DashboardPreset[]>([
    {
      name: 'default',
      config: {
        content: [{
          type: 'row',
          content: [
            {
              type: 'component',
              componentName: 'timeStats',
              title: '📊 时间统计',
              width: 33,
            },
            {
              type: 'component',
              componentName: 'taskReminder',
              title: '✅ 任务提醒',
              width: 33,
            },
            {
              type: 'component',
              componentName: 'countdown',
              title: '⏱️ 倒计时',
              width: 34,
            },
          ]
        }]
      }
    },
  ]);
  
  const [activePreset, setActivePreset] = useState('default');
  
  const currentConfig = presets.find(p => p.name === activePreset)?.config || null;
  
  // 组件注册
  const components = [
    { name: 'timeStats', component: Widgets.TimeStatsWidget },
    { name: 'taskReminder', component: Widgets.TaskReminderWidget },
    { name: 'countdown', component: Widgets.CountdownWidget },
    { name: 'eventTree', component: Widgets.EventTreeWidget },
    { name: 'calendar', component: Widgets.CalendarWidget },
    { name: 'report', component: Widgets.ReportWidget },
  ];
  
  // 保存布局
  const handleLayoutChange = useCallback((config: any) => {
    setPresets(prev => {
      const index = prev.findIndex(p => p.name === activePreset);
      if (index >= 0) {
        prev[index].config = config;
        return [...prev];
      }
      return prev;
    });
    
    localStorage.setItem('dashboard-presets', JSON.stringify(presets));
  }, [activePreset, presets]);
  
  return (
    <div className="dashboard-manager">
      <div className="dashboard-toolbar">
        <select 
          value={activePreset} 
          onChange={(e) => setActivePreset(e.target.value)}
        >
          <option value="default">默认布局</option>
          <option value="work">工作模式</option>
          <option value="review">回顾模式</option>
        </select>
        
        <button onClick={() => {/* 新建布局 */}}>新建布局</button>
        <button onClick={() => {/* 重置布局 */}}>重置</button>
      </div>
      
      {currentConfig && (
        <GoldenLayoutWrapper
          config={currentConfig}
          components={components}
          onLayoutChange={handleLayoutChange}
        />
      )}
    </div>
  );
};
```

#### Week 4: 组件市场

**实现组件拖拽添加功能**

```typescript
// src/pages/Homepage/ComponentMarket.tsx
export const ComponentMarket: React.FC = () => {
  const availableComponents = [
    { id: 'timeStats', name: '时间统计', icon: '📊' },
    { id: 'taskReminder', name: '任务提醒', icon: '✅' },
    { id: 'countdown', name: '倒计时', icon: '⏱️' },
    { id: 'eventTree', name: '项目树', icon: '🌲' },
    { id: 'calendar', name: '日历', icon: '📅' },
    { id: 'report', name: '报表', icon: '📈' },
  ];
  
  return (
    <div className="component-market">
      <h3>组件库</h3>
      <div className="component-grid">
        {availableComponents.map(comp => (
          <div 
            key={comp.id}
            className="component-card"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('component', comp.id);
            }}
          >
            <span className="component-icon">{comp.icon}</span>
            <span className="component-name">{comp.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

### Phase 3: Windows Desktop Widgets（2-3 周）

**目标**: 支持桌面悬浮小组件

#### Week 1-2: Electron 窗口集成

**修改 Electron 主进程**

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain, screen } from 'electron';

let widgetWindows: Map<string, BrowserWindow> = new Map();

// 创建桌面 Widget
function createWidget(widgetId: string, config: any) {
  const { width = 300, height = 200, x, y } = config;
  
  // 获取屏幕尺寸
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  const win = new BrowserWindow({
    width,
    height,
    x: x || screenWidth - width - 20,
    y: y || 20,
    frame: false,              // 无边框
    transparent: true,         // 透明背景
    alwaysOnTop: true,         // 始终置顶
    skipTaskbar: true,         // 不显示在任务栏
    resizable: true,           // 可调整大小
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/widget?id=${widgetId}`);
  
  // 保存窗口引用
  widgetWindows.set(widgetId, win);
  
  // 监听窗口关闭
  win.on('closed', () => {
    widgetWindows.delete(widgetId);
    
    // 保存窗口位置
    const bounds = win.getBounds();
    saveWidgetPosition(widgetId, bounds);
  });
  
  // 监听窗口移动
  win.on('move', () => {
    const bounds = win.getBounds();
    saveWidgetPosition(widgetId, bounds);
  });
}

// 保存 Widget 位置
function saveWidgetPosition(widgetId: string, bounds: any) {
  const positions = JSON.parse(localStorage.getItem('widget-positions') || '{}');
  positions[widgetId] = bounds;
  localStorage.setItem('widget-positions', JSON.stringify(positions));
}

// IPC 通信
ipcMain.on('create-widget', (event, widgetId, config) => {
  // 恢复保存的位置
  const positions = JSON.parse(localStorage.getItem('widget-positions') || '{}');
  const savedPosition = positions[widgetId];
  
  createWidget(widgetId, {
    ...config,
    ...savedPosition,
  });
});

ipcMain.on('close-widget', (event, widgetId) => {
  const win = widgetWindows.get(widgetId);
  if (win) {
    win.close();
  }
});

ipcMain.on('toggle-widget', (event, widgetId) => {
  const win = widgetWindows.get(widgetId);
  if (win) {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
    }
  }
});
```

#### Week 2: Widget 路由和渲染

```typescript
// src/pages/Widget.tsx
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import * as Widgets from '@/components/dashboard';
import './Widget.css';

export const WidgetPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const widgetId = searchParams.get('id');

  const renderWidget = () => {
    switch (widgetId) {
      case 'timer':
        return <Widgets.TimerWidget />;
      case 'quick-note':
        return <Widgets.QuickNoteWidget />;
      case 'stats':
        return <Widgets.TimeStatsWidget />;
      default:
        return <div>Unknown widget: {widgetId}</div>;
    }
  };

  return (
    <div className="desktop-widget">
      {/* 拖拽句柄 */}
      <div className="widget-handle" data-draggable>
        <span className="widget-dots">⋮⋮</span>
      </div>
      
      {/* Widget 内容 */}
      <div className="widget-body">
        {renderWidget()}
      </div>
    </div>
  );
};
```

#### Week 3: 系统托盘管理

```typescript
// electron/tray.ts
import { Tray, Menu, nativeImage } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../assets/tray-icon.png')
  );
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏 Widgets',
      type: 'submenu',
      submenu: [
        {
          label: '⏱️ 专注计时器',
          type: 'checkbox',
          checked: false,
          click: (menuItem) => {
            if (menuItem.checked) {
              createWidget('timer', { width: 300, height: 150 });
            } else {
              closeWidget('timer');
            }
          }
        },
        {
          label: '📋 快速笔记',
          type: 'checkbox',
          checked: false,
          click: (menuItem) => {
            if (menuItem.checked) {
              createWidget('quick-note', { width: 400, height: 300 });
            } else {
              closeWidget('quick-note');
            }
          }
        },
        {
          label: '📊 今日统计',
          type: 'checkbox',
          checked: false,
          click: (menuItem) => {
            if (menuItem.checked) {
              createWidget('stats', { width: 350, height: 200 });
            } else {
              closeWidget('stats');
            }
          }
        },
      ]
    },
    { type: 'separator' },
    {
      label: '打开主窗口',
      click: () => {
        // 打开主窗口
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('ReMarkable');
  tray.setContextMenu(contextMenu);
}
```

---

## 📊 风险评估和缓解策略

### 风险 1: 学习曲线陡峭

**影响**: 开发时间可能超出预期（+1-2 周）

**缓解措施**:
1. Week 0: 团队成员阅读 GoldenLayout 官方文档
2. 构建简单 Demo 熟悉 API
3. 参考官方示例：https://github.com/golden-layout/golden-layout/tree/master/examples
4. 安排技术分享会，集体学习

### 风险 2: React 集成复杂

**影响**: 组件生命周期管理困难，可能导致内存泄漏

**缓解措施**:
1. 使用 React 18 的 `createRoot` API
2. 严格管理清理函数（`container.on('destroy')`）
3. 使用 React DevTools 监控组件挂载/卸载
4. 编写单元测试确保组件正确清理

### 风险 3: 版本升级问题

**影响**: v3.0 不向后兼容，未来升级困难

**缓解措施**:
1. 锁定版本为 `2.6.0`（在 package.json 中使用精确版本）
2. 不要盲目升级到 v3.0（等稳定后评估）
3. 关注 GitHub Issues 获取最新信息
4. 创建升级评估文档

### 风险 4: Bundle 体积增大

**影响**: 首屏加载变慢（+50KB gzipped）

**缓解措施**:
1. 使用 Lazy Loading
```typescript
const GoldenLayoutWrapper = lazy(() => 
  import('@/components/layout/GoldenLayoutWrapper')
);
```
2. Code Splitting（按页面拆分）
3. 只在需要时加载 GoldenLayout
4. 使用 Webpack Bundle Analyzer 分析优化

### 风险 5: 性能问题

**影响**: 同时打开多个标签/组件时卡顿

**缓解措施**:
1. 使用虚拟滚动（react-window）
2. 防抖布局保存（debounce 1s）
3. 懒加载组件内容
4. 限制同时打开的标签数量（最多 20 个）

---

## ✅ 成功指标

### Phase 1 (TimeLog)
- ✅ 用户可以同时编辑 ≥3 个事件
- ✅ 标签拖拽排序流畅（60fps）
- ✅ 布局配置自动保存和恢复
- ✅ 弹出窗口功能可用
- ✅ 未保存提示准确
- ✅ 性能：打开 10 个标签无明显卡顿

### Phase 2 (Homepage)
- ✅ 支持 ≥6 种预设组件
- ✅ 用户可自定义 ≥3 套布局
- ✅ 组件拖拽调整大小无卡顿
- ✅ 布局持久化准确
- ✅ 组件市场易用性评分 ≥4.5/5

### Phase 3 (Desktop Widgets)
- ✅ 支持 ≥3 种桌面小组件
- ✅ Widget 位置记忆准确率 100%
- ✅ 系统托盘交互流畅
- ✅ 多显示器支持正常
- ✅ Widget 启动时间 <500ms

---

## 📚 技术参考

### GoldenLayout 官方资源
- GitHub: https://github.com/golden-layout/golden-layout
- 文档: https://golden-layout.com/docs/
- 示例: https://github.com/golden-layout/golden-layout/tree/master/examples

### React 集成参考
- React 18 createRoot: https://react.dev/reference/react-dom/client/createRoot
- React 生命周期: https://react.dev/learn/lifecycle-of-reactive-effects

### 性能优化参考
- react-window: https://github.com/bvaughn/react-window
- Code Splitting: https://react.dev/reference/react/lazy
- Bundle Analysis: https://github.com/webpack-contrib/webpack-bundle-analyzer

---

## 📅 时间线总结

| Phase | 周数 | 里程碑 |
|-------|------|--------|
| Phase 1 | Week 1-3 | TimeLog 标签页功能完成 |
| Phase 2 | Week 4-7 | Homepage Dashboard 完成 |
| Phase 3 | Week 8-10 | Desktop Widgets 完成 |

**总计**: 8-10 周

---

## 👥 团队分工建议

| 角色 | 职责 | 时间投入 |
|------|------|---------|
| 前端工程师 A | GoldenLayout 封装、TimeLog 集成 | 3 周 |
| 前端工程师 B | Dashboard 组件开发 | 4 周 |
| Electron 工程师 | Desktop Widgets、系统托盘 | 3 周 |
| UI/UX 设计师 | 组件设计、交互优化 | 持续 |
| QA 测试工程师 | 功能测试、性能测试 | 持续 |

---

**文档结束**
