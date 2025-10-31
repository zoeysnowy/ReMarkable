# PlanItemEditor 组件使用指南

## 📋 概述

`PlanItemEditor` 是一个功能完整的计划项编辑器组件，参考 TagManager 的设计风格，专为 Plan 页面设计。支持富文本编辑、标签管理、时间设置、计时器等功能。

## ✨ 核心特性

### 🎨 富文本编辑
- **字体颜色**: 8 种预设颜色 + 自定义颜色选择器
- **背景颜色**: 8 种预设背景 + 自定义背景选择器
- **Emoji 表情**: 完整的 Emoji 选择器（中文界面）
- **项目符号**: 无、圆点、数字、复选框四种样式

### 🏷️ 标签管理
- 多标签选择
- 实时创建新标签
- 标签视觉化显示
- 快速删除标签

### ⏰ 时间管理
- 开始时间选择器
- 结束时间选择器
- 自动计算时长
- datetime-local 原生控件

### ⏱️ 内置计时器
- 实时计时功能
- 暂停/继续支持
- 重置功能
- 自动累计总时长
- HH:MM:SS 格式显示

### 🎯 优先级管理
- 低 (Low) - 绿色
- 中 (Medium) - 蓝色
- 高 (High) - 橙色
- 紧急 (Urgent) - 红色

### 📱 其他特性
- 响应式设计（桌面端 + 移动端）
- 深色模式适配
- 流畅动画效果
- 键盘快捷键支持
- 备注功能
- 详细设置面板

---

## 🚀 快速开始

### 1. 基础使用

```tsx
import React, { useState } from 'react';
import PlanItemEditor, { PlanItem } from './components/PlanItemEditor';

function MyPlanPage() {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<PlanItem | null>(null);

  const handleSave = (item: PlanItem) => {
    console.log('保存计划项:', item);
    // 保存到数据库或状态管理
  };

  return (
    <div>
      <button onClick={() => setIsEditorOpen(true)}>
        新建计划
      </button>

      <PlanItemEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSave}
        availableTags={['工作', '学习', '运动']}
      />
    </div>
  );
}
```

### 2. 编辑现有项目

```tsx
const existingItem: PlanItem = {
  id: 'plan-123',
  title: '完成项目报告',
  content: '需要整理数据和制作PPT',
  tags: ['工作', '文档'],
  color: '#000000',
  backgroundColor: '#FFF3E0',
  emoji: '📊',
  bulletStyle: 'checkbox',
  startTime: '2025-10-28T14:00',
  endTime: '2025-10-28T16:00',
  priority: 'high',
};

<PlanItemEditor
  item={existingItem}
  isOpen={isOpen}
  onClose={handleClose}
  onSave={handleSave}
  availableTags={tags}
/>
```

### 3. 配合 FloatingButton 使用

```tsx
import FloatingButton from './components/FloatingButton';

const planActions = [
  {
    id: 'new-plan',
    label: '新建计划',
    icon: '➕',
    onClick: () => setIsEditorOpen(true),
  },
  {
    id: 'quick-task',
    label: '快速任务',
    icon: '⚡',
    onClick: () => handleQuickTask(),
  },
];

<FloatingButton
  actions={planActions}
  position="bottom-right"
  expandDirection="up"
  color="#007AFF"
  tooltip="Plan 操作"
/>
```

---

## 📖 API 文档

### PlanItemEditorProps

| 属性 | 类型 | 说明 | 必填 | 默认值 |
|------|------|------|------|--------|
| `item` | `PlanItem \| null` | 要编辑的计划项，null 时创建新项 | 否 | `null` |
| `isOpen` | `boolean` | 是否显示编辑器 | 是 | - |
| `onClose` | `() => void` | 关闭编辑器的回调 | 是 | - |
| `onSave` | `(item: PlanItem) => void` | 保存计划项的回调 | 是 | - |
| `availableTags` | `string[]` | 可选的标签列表 | 否 | `[]` |
| `onCreateTag` | `(tagName: string) => void` | 创建新标签的回调 | 否 | - |

### PlanItem 接口

```typescript
interface PlanItem {
  id: string;                                    // 唯一标识
  title: string;                                 // 标题
  content: string;                               // 内容描述
  tags: string[];                                // 标签数组
  color?: string;                                // 字体颜色
  backgroundColor?: string;                      // 背景颜色
  emoji?: string;                                // Emoji 表情
  bulletStyle?: 'none' | 'dot' | 'number' | 'checkbox';  // 项目符号
  startTime?: string;                            // 开始时间 (ISO 8601)
  endTime?: string;                              // 结束时间 (ISO 8601)
  duration?: number;                             // 时长（秒）
  isCompleted?: boolean;                         // 是否完成
  priority?: 'low' | 'medium' | 'high' | 'urgent';  // 优先级
  reminders?: string[];                          // 提醒列表
  notes?: string;                                // 备注
}
```

---

## 🎨 使用场景

### 场景 1: Plan 页面 - 日程管理

```tsx
function PlanPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);

  const handleCreatePlan = () => {
    setCurrentItem(null);
    setIsEditorOpen(true);
  };

  const handleEditPlan = (plan: PlanItem) => {
    setCurrentItem(plan);
    setIsEditorOpen(true);
  };

  const handleSavePlan = (plan: PlanItem) => {
    setPlans(prev => {
      const exists = prev.find(p => p.id === plan.id);
      if (exists) {
        return prev.map(p => p.id === plan.id ? plan : p);
      }
      return [...prev, plan];
    });
  };

  return (
    <div className="plan-page">
      <div className="plans-list">
        {plans.map(plan => (
          <PlanCard 
            key={plan.id} 
            plan={plan} 
            onEdit={() => handleEditPlan(plan)}
          />
        ))}
      </div>

      <FloatingButton
        actions={[
          { id: 'new', label: '新建', icon: '➕', onClick: handleCreatePlan }
        ]}
      />

      <PlanItemEditor
        item={currentItem}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSavePlan}
        availableTags={['工作', '学习', '生活']}
      />
    </div>
  );
}
```

### 场景 2: 待办事项管理

```tsx
function TodoList() {
  const [todos, setTodos] = useState<PlanItem[]>([]);

  const quickTodoActions = [
    {
      id: 'urgent-todo',
      label: '紧急待办',
      icon: '🔴',
      onClick: () => {
        setCurrentItem({
          id: `todo-${Date.now()}`,
          title: '',
          content: '',
          tags: ['待办'],
          priority: 'urgent',
          bulletStyle: 'checkbox',
        } as PlanItem);
        setIsEditorOpen(true);
      },
    },
    {
      id: 'normal-todo',
      label: '普通待办',
      icon: '📝',
      onClick: () => {
        setCurrentItem({
          id: `todo-${Date.now()}`,
          title: '',
          content: '',
          tags: ['待办'],
          priority: 'medium',
          bulletStyle: 'checkbox',
        } as PlanItem);
        setIsEditorOpen(true);
      },
    },
  ];

  return (
    <div>
      {/* 待办列表 */}
      <FloatingButton actions={quickTodoActions} />
      <PlanItemEditor {...editorProps} />
    </div>
  );
}
```

### 场景 3: 时间跟踪

```tsx
function TimeTracking() {
  const [activities, setActivities] = useState<PlanItem[]>([]);

  const handleStartTracking = (activityType: string) => {
    const newActivity: PlanItem = {
      id: `activity-${Date.now()}`,
      title: activityType,
      content: '',
      tags: ['时间追踪'],
      startTime: new Date().toISOString(),
      duration: 0,
      priority: 'medium',
    };
    setCurrentItem(newActivity);
    setIsEditorOpen(true);
  };

  return (
    <div>
      <button onClick={() => handleStartTracking('编程')}>
        开始编程计时
      </button>
      <PlanItemEditor {...editorProps} />
    </div>
  );
}
```

---

## 🎯 最佳实践

### 1. 数据持久化

```tsx
import { PersistentStorage } from './utils/persistentStorage';
import { STORAGE_KEYS } from './constants/storage';

const savePlans = (plans: PlanItem[]) => {
  PersistentStorage.setItem(STORAGE_KEYS.PLANS, plans, {
    encrypt: false,
    ttl: null,
  });
};

const loadPlans = (): PlanItem[] => {
  return PersistentStorage.getItem(STORAGE_KEYS.PLANS) || [];
};
```

### 2. 标签管理集成

```tsx
import { TagService } from './services/TagService';

const tagService = new TagService();

const handleCreateTag = (tagName: string) => {
  const newTag = {
    id: `tag-${Date.now()}`,
    name: tagName,
    color: '#007AFF',
  };
  tagService.addTag(newTag);
  setAvailableTags(prev => [...prev, tagName]);
};
```

### 3. 优先级颜色统一

```tsx
// utils/priorityUtils.ts
export const getPriorityColor = (priority: string) => {
  const colors = {
    urgent: '#FF3B30',
    high: '#FF9500',
    medium: '#007AFF',
    low: '#34C759',
  };
  return colors[priority] || '#999999';
};
```

### 4. 时间格式化

```tsx
// utils/timeUtils.ts
export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}小时${m}分钟`;
  }
  return `${m}分钟`;
};

export const formatDateTime = (isoString: string) => {
  return new Date(isoString).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
```

### 5. 性能优化

```tsx
import { useCallback, useMemo } from 'react';

function PlanPage() {
  // 使用 useCallback 优化回调
  const handleSave = useCallback((item: PlanItem) => {
    setPlans(prev => [...prev, item]);
  }, []);

  // 使用 useMemo 优化标签列表
  const availableTags = useMemo(() => {
    const allTags = plans.flatMap(p => p.tags);
    return [...new Set(allTags)];
  }, [plans]);

  return <PlanItemEditor onSave={handleSave} availableTags={availableTags} />;
}
```

---

## 🛠️ 自定义样式

### 修改主题颜色

```css
/* PlanItemEditor.css */

/* 修改主色调 */
.plan-btn-save {
  background-color: #FF9500; /* 改为橙色 */
}

/* 修改圆角 */
.plan-item-editor-container {
  border-radius: 12px; /* 更小的圆角 */
}

/* 修改字体 */
.plan-title-input {
  font-family: 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
}
```

### 自定义优先级样式

```css
/* 添加闪烁效果（紧急任务） */
.plan-priority-badge[style*="FF3B30"] {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## 🔍 故障排除

### 问题 1: Emoji 选择器不显示

**原因**: 缺少 `@emoji-mart/react` 或 `@emoji-mart/data` 依赖

**解决**:
```bash
npm install @emoji-mart/react @emoji-mart/data --legacy-peer-deps
```

### 问题 2: 计时器不工作

**原因**: 组件卸载时未清理定时器

**解决**: 组件已内置 cleanup，确保使用最新版本

### 问题 3: 时间选择器在移动端显示异常

**原因**: 不同浏览器对 `datetime-local` 支持不同

**解决**: 可以集成第三方时间选择器（如 `react-datepicker`）

### 问题 4: 样式冲突

**原因**: 全局样式覆盖了组件样式

**解决**: 提高选择器优先级或使用 CSS Modules

```css
/* 提高优先级 */
.plan-item-editor-overlay .plan-item-editor-container {
  /* 样式 */
}
```

---

## 📝 更新日志

### v1.0.0 (2025-10-28)
- ✅ 初始版本发布
- ✅ 完整的富文本编辑功能
- ✅ 标签管理系统
- ✅ 时间选择和计时器
- ✅ 优先级管理
- ✅ 响应式设计
- ✅ 深色模式支持

---

## 🚀 路线图

### 即将推出
- [ ] 拖拽上传图片/附件
- [ ] Markdown 编辑支持
- [ ] 子任务/清单功能
- [ ] 提醒/通知系统
- [ ] 模板系统
- [ ] 导入/导出功能
- [ ] 协作编辑
- [ ] 历史版本

---

## 💡 技巧和窍门

### 技巧 1: 快速创建带标签的任务

```tsx
const createTaggedTask = (title: string, tags: string[]) => {
  const newItem: PlanItem = {
    id: `task-${Date.now()}`,
    title,
    content: '',
    tags,
    bulletStyle: 'checkbox',
    priority: 'medium',
  };
  handleSave(newItem);
};

// 使用
createTaggedTask('Review PR #123', ['工作', '代码审查']);
```

### 技巧 2: 批量设置优先级

```tsx
const setAllPriority = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
  setPlans(prev => prev.map(p => ({ ...p, priority })));
};
```

### 技巧 3: 自动标签建议

```tsx
const suggestTags = (title: string): string[] => {
  const keywords = {
    '会议': ['工作', '会议'],
    '锻炼': ['健康', '运动'],
    '学习': ['学习', '自我提升'],
  };
  
  for (const [key, tags] of Object.entries(keywords)) {
    if (title.includes(key)) {
      return tags;
    }
  }
  return [];
};
```

---

## 📞 支持

如有问题或建议，请：
1. 查看本文档的故障排除部分
2. 查看组件源码中的注释
3. 运行演示页面查看效果
4. 联系开发团队

---

**祝你使用愉快！** 🎉
