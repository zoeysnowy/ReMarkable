# SyncTargetPicker 性能修复与重构

> **修复日期**: 2025-11-12  
> **问题**: EventEditModal 疯狂闪烁 + 关闭后事件丢失 + 日历颜色未显示  
> **版本**: v1.7.5  
> **关联组件**: SyncTargetPicker, EventEditModal, PlanManager, App.tsx  

---

## 📋 问题描述

### 1. 疯狂闪烁问题
- **现象**: 打开 EventEditModal 时,整个 modal 疯狂闪烁,无法正常使用
- **频率**: 每秒数十次重渲染
- **影响**: 用户体验极差,无法编辑事件

### 2. 事件丢失问题
- **现象**: 关闭 EventEditModal 后,事件数据丢失
- **触发**: EventEditModal 频繁重渲染导致状态重置

### 3. 日历颜色问题
- **现象**: 日历列表显示正常,但所有日历图标都是灰色(默认色)
- **预期**: 应显示 Microsoft Calendar 的分组颜色(蓝色、绿色、橙色等)

---

## 🔍 根因分析

### 问题 1 & 2: 无限循环重渲染

**调用链追踪**:
```
App.tsx 
  → PlanManager (传入 availableCalendars={[]})
    → EventEditModal (接收并传递 availableCalendars)
      → SyncTargetPicker (接收 availableCalendars prop)
```

**触发机制**:
```typescript
// ❌ PlanManager.tsx (旧代码)
<EventEditModal
  microsoftService={microsoftService}
  availableCalendars={[]}  // 🔥 每次渲染都创建新的空数组引用!
/>

// ❌ SyncTargetPicker.tsx (旧代码)
const [availableCalendars, setAvailableCalendars] = useState(propCalendars || []);

useEffect(() => {
  const loadCalendars = async () => { /* 加载逻辑 */ };
  loadCalendars();
}, [microsoftService, propCalendars]); // 🔥 propCalendars 引用变化触发无限循环!
```

**无限循环流程**:
1. PlanManager 渲染,传入新的 `[]` 引用
2. EventEditModal 重渲染,传给 SyncTargetPicker 新的 `propCalendars`
3. SyncTargetPicker useEffect 检测到 `propCalendars` 变化,触发 loadCalendars
4. loadCalendars 调用 `setAvailableCalendars()`,触发 SyncTargetPicker 重渲染
5. SyncTargetPicker 重渲染触发 EventEditModal 重渲染
6. EventEditModal 重渲染触发 PlanManager 重渲染
7. 回到步骤 1,无限循环 ♻️

### 问题 3: 颜色映射缺失

**数据流**:
```typescript
// Microsoft Calendar API 返回
{
  id: "AAMkA...",
  name: "工作",
  color: "lightBlue"  // ⚠️ 颜色名称,非十六进制值
}

// ❌ SyncTargetPicker.tsx (旧代码)
const mappedCalendars = cachedCalendars.map((cal: any) => ({
  id: cal.id,
  name: cal.name,
  color: cal.color  // 直接使用 "lightBlue" → CSS 无法识别
}));

// ✅ 正确做法 (参考 CalendarMappingPicker)
color: convertMicrosoftColorToHex(cal.color)  // "lightBlue" → "#5194f0"
```

---

## ✅ 修复方案

### 1. 移除 Props 传递,改为内部加载

**架构对比**:

| 组件 | 旧架构 (❌) | 新架构 (✅) |
|------|-----------|-----------|
| **PlanManager** | 传入 `availableCalendars={[]}` | 不传 (移除 prop) |
| **App.tsx** | 传入 `availableCalendars={useMemo(...)}` | 不传 (移除 prop) |
| **EventEditModal** | 接收并传递 `availableCalendars` | 不传给 SyncTargetPicker |
| **SyncTargetPicker** | 接收 `propCalendars`,useState 初始化 | 自己从 `microsoftService` 加载 |

**修改点 1**: PlanManager.tsx (Line ~1920)
```diff
  <EventEditModal
    microsoftService={microsoftService}
-   availableCalendars={[]}  // ❌ 删除
+   // ✅ 移除 - 让 SyncTargetPicker 自己从 microsoftService 加载
  />
```

**修改点 2**: App.tsx (Line ~1635)
```diff
  <EventEditModal
    microsoftService={microsoftService}
-   availableCalendars={availableCalendars}  // ❌ 删除
+   // ✅ 移除 - 让 SyncTargetPicker 自己加载
  />
```

**修改点 3**: EventEditModal.tsx (Line ~1020)
```diff
  <SyncTargetPicker
    microsoftService={microsoftService}
-   availableCalendars={availableCalendars}  // ❌ 删除
-   availableTodoLists={availableTodoLists}  // ❌ 删除
+   // ✅ 移除 props - 让 SyncTargetPicker 自己加载
  />
```

### 2. 优化 SyncTargetPicker 加载逻辑

**核心修改**: SyncTargetPicker.tsx

```diff
+ import { useCallback } from 'react';

  // 🗓️ 日历列表状态
- const [availableCalendars, setAvailableCalendars] = useState(propCalendars || []);
+ const [availableCalendars, setAvailableCalendars] = useState([]);  // ✅ 不依赖 props
  const [loading, setLoading] = useState(false);
+ const hasLoadedRef = useRef(false);  // 🔒 防止重复加载

  // 🔄 加载日历列表（参考 CalendarMappingPicker 的实现）
- useEffect(() => {
-   const loadCalendars = async () => { /* ... */ };
-   loadCalendars();
- }, [microsoftService, propCalendars]);  // ❌ propCalendars 引用变化

+ const loadCalendars = useCallback(async () => {
+   if (hasLoadedRef.current) return;  // 防止重复加载
+   hasLoadedRef.current = true;
+   
+   // 优先使用传入的 prop (向后兼容)
+   if (propCalendars && propCalendars.length > 0) {
+     setAvailableCalendars(propCalendars);
+     return;
+   }
+   
+   // 从 microsoftService 加载
+   if (microsoftService?.getCachedCalendars) {
+     const cached = microsoftService.getCachedCalendars();
+     if (cached?.length > 0) {
+       setAvailableCalendars(mapCalendars(cached));
+     } else {
+       const { calendars } = await microsoftService.getAllCalendarData();
+       setAvailableCalendars(mapCalendars(calendars));
+     }
+   }
+ }, [microsoftService, propCalendars]);  // ✅ 稳定依赖

+ useEffect(() => {
+   loadCalendars();
+ }, [loadCalendars]);  // ✅ 只在 loadCalendars 变化时触发
```

**关键改进**:
1. ✅ **useCallback 包装**: 稳定 loadCalendars 引用
2. ✅ **hasLoadedRef**: 使用 ref 防止重复加载(即使 useEffect 多次触发)
3. ✅ **空初始状态**: useState([]) 不依赖 props
4. ✅ **缓存优先**: getCachedCalendars() → getAllCalendarData() 降级

### 3. 添加颜色转换函数

**新增**: SyncTargetPicker.tsx (文件顶部)
```typescript
// 🎨 将 Microsoft 颜色名称转换为十六进制颜色（参考 CalendarMappingPicker）
const convertMicrosoftColorToHex = (colorName?: string): string => {
  const colorMap: { [key: string]: string } = {
    'lightBlue': '#5194f0',
    'lightGreen': '#42b883', 
    'lightOrange': '#ff8c42',
    'lightGray': '#9ca3af',
    'lightYellow': '#f1c40f',
    'lightTeal': '#48c9b0',
    'lightPink': '#f48fb1',
    'lightBrown': '#a0826d',
    'lightRed': '#e74c3c',
    'maxColor': '#6366f1'
  };
  
  if (!colorName) return '#3b82f6';
  return colorMap[colorName] || '#3b82f6';
};
```

**应用颜色转换**:
```diff
  const mappedCalendars = cachedCalendars.map((cal: any) => ({
    id: cal.id,
    name: cal.name,
    displayName: cal.name,
-   color: cal.color  // ❌ 直接使用颜色名称
+   color: convertMicrosoftColorToHex(cal.color)  // ✅ 转换为十六进制
  }));
```

---

## 📊 对比 CalendarMappingPicker 架构

### 加载策略对比

| 特性 | CalendarMappingPicker ✅ | SyncTargetPicker (旧) ❌ | SyncTargetPicker (新) ✅ |
|------|------------------------|------------------------|------------------------|
| **加载时机** | `isVisible` 变化时 | 每次 props 变化 | mount 时 + useCallback |
| **依赖管理** | `useCallback` 包装 | 直接依赖 props | `useCallback` + Ref |
| **防重复加载** | `isVisible` 控制 | 无 | `hasLoadedRef` |
| **初始状态** | `[]` (空数组) | `propCalendars \|\| []` | `[]` (空数组) |
| **Props 传递** | 只传 `microsoftService` | 传 `availableCalendars` | 只传 `microsoftService` |
| **颜色转换** | `convertMicrosoftColorToHex()` | 无 | `convertMicrosoftColorToHex()` |
| **缓存策略** | Cache-first + Remote fallback | 同左 | 同左 |

### 数据流对比

**旧架构 (❌ 存在循环依赖)**:
```
App.tsx useMemo (空依赖) 
  → availableCalendars = []
    → PlanManager 接收
      → EventEditModal 接收
        → SyncTargetPicker 接收
          → useEffect 依赖 propCalendars
            → 触发重渲染 → 循环 ♻️
```

**新架构 (✅ 单向数据流)**:
```
App.tsx
  → microsoftService (稳定引用)
    → PlanManager 接收
      → EventEditModal 接收
        → SyncTargetPicker 接收
          → loadCalendars() 一次性加载
            → setAvailableCalendars() → 渲染完成 ✓
```

---

## 🧪 测试验证

### 测试清单

- [x] **闪烁问题**: 打开 EventEditModal,无闪烁
- [x] **日历加载**: 日历列表正确显示(10 个日历)
- [x] **颜色显示**: 日历图标显示正确颜色
  - "日历" → 粉色
  - "My Calendar Birthdays" → 蓝色
  - "#3x3_工作" → 青色
  - "#3x3_社交" → 绿色
  - etc.
- [x] **事件保存**: 关闭 modal 后事件不丢失
- [x] **模式切换**: Task ↔ Event 切换时日历列表正常显示
- [ ] **To Do Lists**: 待实现(目前无加载逻辑)

### Console 输出验证

**正常输出**:
```
📅 SyncTargetPicker - loadCalendars 开始执行 
  { hasPropCalendars: false, hasMicrosoftService: true, hasGetCachedMethod: true }
[MSCalendar] 📋 [Cache] Retrieved calendars from cache: 10 calendars
📅 SyncTargetPicker - getCachedCalendars 返回: 10
📅 SyncTargetPicker - 从缓存加载日历: 10 
  [ { id: "AAMkA...", name: "日历", color: "#f48fb1" }, { ... } ]
```

**异常输出** (应避免):
```
❌ 📅 SyncTargetPicker - loadCalendars 开始执行 (重复 N 次)
❌ 📝 EventEditModal - 初始化事件 (重复 N 次)
```

---

## 📝 遗留问题

### 1. To Do Lists 加载未实现

**现状**:
- `availableTodoLists` 状态存在,但无加载逻辑
- `microsoftService` 缺少 `getCachedTodoLists()` 方法
- Task 模式下 picker 显示空列表

**详细文档**: 
- 📄 [SYNCTARGETPICKER_TODO_LISTS_IMPLEMENTATION.md](./SYNCTARGETPICKER_TODO_LISTS_IMPLEMENTATION.md)

**待办清单**:
1. ✅ 在 `MicrosoftCalendarService` 添加 To Do Lists API:
   - `getCachedTodoLists()`
   - `getAllTodoListData()`
   - `setCachedTodoLists()`
   - `syncTodoListsFromRemote()`
2. ✅ 在 `SyncTargetPicker.loadCalendars()` 中添加 To Do Lists 加载逻辑
3. ✅ 在 `App.tsx` 初始化时同步 To Do Lists
4. ⏳ 添加 MSAL scope: `Tasks.ReadWrite`
5. ⏳ 实现单元测试和集成测试

**预估工时**: 6 小时

### 2. 颜色映射不完整

**现有映射**:
- 仅支持 10 种 Microsoft 预定义颜色
- 如果用户自定义颜色,会回退到默认蓝色 `#3b82f6`

**改进方案**:
- 如果 API 直接返回十六进制值,优先使用
- 扩展 colorMap 支持更多颜色

---

## 🔧 文件清单

### 修改的文件

| 文件路径 | 修改内容 | 行号 |
|---------|---------|------|
| `src/components/PlanManager.tsx` | 移除 `availableCalendars={[]}` | ~1920 |
| `src/App.tsx` | 移除 `availableCalendars={availableCalendars}` | ~1635 |
| `src/components/EventEditModal.tsx` | 移除 `availableCalendars` 和 `availableTodoLists` props | ~1020 |
| `src/components/EventEditModal/SyncTargetPicker.tsx` | 重构加载逻辑 + 添加颜色转换 | L1-L150 |

### 新增的代码

**SyncTargetPicker.tsx**:
- `convertMicrosoftColorToHex()` 函数 (L6-L23)
- `useCallback` 包装 `loadCalendars` (L82-L141)
- `hasLoadedRef` 防重复加载 (L79)
- 颜色转换调用 (L110, L127)

---

## 📚 参考文档

- [CalendarMappingPicker.tsx](../../src/features/Calendar/components/CalendarMappingPicker.tsx) - 参考实现
- [EventEditModal v2 PRD](../PRD/EVENTEDITMODAL_V2_PRD.md) - 产品需求
- [React useCallback 文档](https://react.dev/reference/react/useCallback) - Hooks 最佳实践

---

## 📌 总结

### 核心改进

1. ✅ **消除无限循环**: 移除 props 传递,改为内部加载
2. ✅ **稳定依赖管理**: useCallback + hasLoadedRef 防止重复触发
3. ✅ **颜色正确显示**: 添加 Microsoft 颜色名称 → 十六进制转换
4. ✅ **性能优化**: 单次加载,缓存优先,减少 API 调用

### 经验教训

1. **避免在渲染时创建新引用**: `availableCalendars={[]}` 每次都是新数组
2. **useEffect 依赖管理**: props 引用变化会触发无限循环
3. **参考成熟组件**: CalendarMappingPicker 提供了最佳实践
4. **颜色映射需要转换**: API 返回的颜色名称需要映射为 CSS 可用值

### 下一步

- [ ] 实现 To Do Lists 加载逻辑
- [ ] 添加 loading 状态 UI 反馈
- [ ] 考虑添加刷新按钮(手动同步)
- [ ] 优化错误处理和 fallback 机制
