# SyncTargetPicker - To Do Lists 功能待实现

> **当前状态**: UI 已预留,后端 API 未实现  
> **优先级**: P1 (影响 Task 模式功能完整性)  
> **预估工时**: 4-6 小时  

---

## 📋 当前状态

### 已实现 ✅
- UI 状态管理: `availableTodoLists` state 已定义
- 双模式切换: `isTask` 判断逻辑完整
- 选择器 UI: 可复用 Calendar Picker 的组件
- 数据保存: `todoListIds` 字段已在 Event 类型中定义

### 未实现 ❌
- **MicrosoftCalendarService 缺少 API**:
  - ❌ `getCachedTodoLists()` - 从缓存获取 To Do Lists
  - ❌ `getAllTodoListData()` - 从 Microsoft Graph API 获取
  - ❌ `setCachedTodoLists()` - 写入缓存
  - ❌ `syncTodoListsFromRemote()` - 远程同步
- **SyncTargetPicker 缺少加载逻辑**: 
  - ❌ `loadTodoLists()` 函数
  - ❌ useEffect 触发加载
- **颜色映射**: 
  - ❌ To Do Lists 是否有颜色属性?(需要验证 API)

---

## 🔧 实现方案

### 1. 扩展 MicrosoftCalendarService

**新增方法** (`src/services/MicrosoftCalendarService.ts`):

```typescript
/**
 * 从缓存获取 To Do Lists
 */
getCachedTodoLists(): TodoList[] {
  try {
    const cached = localStorage.getItem('remarkable-todolists-cache');
    if (!cached) return [];
    
    const parsed = JSON.parse(cached);
    console.log('[MSTodo] 📋 [Cache] Retrieved todo lists from cache:', parsed.length, 'lists');
    return parsed;
  } catch (error) {
    console.error('[MSTodo] ❌ Failed to get cached todo lists:', error);
    return [];
  }
}

/**
 * 写入 To Do Lists 缓存
 */
setCachedTodoLists(todoLists: TodoList[]): void {
  try {
    localStorage.setItem('remarkable-todolists-cache', JSON.stringify(todoLists));
    console.log('[MSTodo] 💾 [Cache] Saved todo lists to cache:', todoLists.length, 'lists');
  } catch (error) {
    console.error('[MSTodo] ❌ Failed to cache todo lists:', error);
  }
}

/**
 * 从 Microsoft Graph API 获取所有 To Do Lists
 * API: GET https://graph.microsoft.com/v1.0/me/todo/lists
 */
async getAllTodoListData(): Promise<{ todoLists: TodoList[] }> {
  if (!this.isSignedIn()) {
    throw new Error('User is not signed in');
  }

  try {
    const response = await this.client
      .api('/me/todo/lists')
      .get();

    const todoLists = response.value.map((list: any) => ({
      id: list.id,
      name: list.displayName,
      isOwner: list.isOwner,
      isShared: list.isShared,
      wellknownListName: list.wellknownListName, // "none", "defaultList", "flaggedEmails"
    }));

    console.log('[MSTodo] 📥 Fetched todo lists from remote:', todoLists.length, 'lists');
    this.setCachedTodoLists(todoLists);
    
    return { todoLists };
  } catch (error) {
    console.error('[MSTodo] ❌ Failed to fetch todo lists:', error);
    throw error;
  }
}

/**
 * 同步 To Do Lists (远程 → 本地缓存)
 */
async syncTodoListsFromRemote(): Promise<{ todoLists: TodoList[] }> {
  console.log('[MSTodo] 🔄 Starting todo lists sync...');
  
  const { todoLists } = await this.getAllTodoListData();
  
  console.log('[MSTodo] ✅ Todo lists sync complete:', todoLists.length, 'lists');
  return { todoLists };
}
```

**类型定义** (`src/types.ts`):
```typescript
export interface TodoList {
  id: string;
  name: string;
  isOwner?: boolean;
  isShared?: boolean;
  wellknownListName?: 'none' | 'defaultList' | 'flaggedEmails';
  color?: string; // 如果 API 返回颜色
}
```

### 2. 扩展 SyncTargetPicker 加载逻辑

**修改**: `src/components/EventEditModal/SyncTargetPicker.tsx`

```typescript
// 🔄 从 microsoftService 加载日历和待办列表
const loadCalendars = useCallback(async () => {
  if (hasLoadedRef.current) return;
  hasLoadedRef.current = true;

  console.log('📅 SyncTargetPicker - loadCalendars 开始执行');

  // ... 现有的日历加载逻辑 ...

  // 🆕 加载 To Do Lists
  if (microsoftService && typeof microsoftService.getCachedTodoLists === 'function') {
    setLoading(true);
    try {
      // 优先从缓存获取
      const cachedTodoLists = microsoftService.getCachedTodoLists();
      console.log('📋 SyncTargetPicker - getCachedTodoLists 返回:', cachedTodoLists?.length || 0);
      
      if (cachedTodoLists && cachedTodoLists.length > 0) {
        const mappedTodoLists = cachedTodoLists.map((list: any) => ({
          id: list.id,
          name: list.name,
          displayName: list.name,
          color: list.color || '#3b82f6' // To Do Lists 可能没有颜色,使用默认蓝色
        }));
        setAvailableTodoLists(mappedTodoLists);
        console.log('📋 SyncTargetPicker - 从缓存加载待办列表:', mappedTodoLists.length);
      } else {
        // 缓存为空,尝试从远程获取
        console.log('📋 SyncTargetPicker - 缓存为空,尝试从远程获取...');
        try {
          const { todoLists } = await microsoftService.getAllTodoListData();
          const mappedTodoLists = todoLists.map((list: any) => ({
            id: list.id,
            name: list.name,
            displayName: list.name,
            color: list.color || '#3b82f6'
          }));
          setAvailableTodoLists(mappedTodoLists);
          console.log('📋 SyncTargetPicker - 从远程加载待办列表:', mappedTodoLists.length);
        } catch (error) {
          console.warn('📋 SyncTargetPicker - 远程获取失败,使用空列表:', error);
          setAvailableTodoLists([]);
        }
      }
    } catch (error) {
      console.error('📋 SyncTargetPicker - 加载待办列表出错:', error);
      setAvailableTodoLists([]);
    } finally {
      setLoading(false);
    }
  } else {
    console.warn('📋 SyncTargetPicker - 没有 microsoftService 或缺少 getCachedTodoLists 方法');
    setAvailableTodoLists([]);
  }
}, [microsoftService, propCalendars, propTodoLists]);
```

### 3. 初始化时同步 To Do Lists

**修改**: `src/App.tsx` (在 microsoftService 初始化后)

```typescript
useEffect(() => {
  const initializeMicrosoftService = async () => {
    if (microsoftService && microsoftService.isSignedIn()) {
      try {
        // 同步日历
        await microsoftService.syncCalendarGroupsFromRemote();
        
        // 🆕 同步 To Do Lists
        await microsoftService.syncTodoListsFromRemote();
        
        console.log('✅ Microsoft services initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Microsoft services:', error);
      }
    }
  };

  initializeMicrosoftService();
}, [microsoftService]);
```

---

## 📊 API 参考

### Microsoft Graph API: To Do Lists

**Endpoint**: `GET /me/todo/lists`

**Response**:
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users('...')/todo/lists",
  "value": [
    {
      "id": "AAMkADVjNWQ5ZTA2...",
      "displayName": "Tasks",
      "isOwner": true,
      "isShared": false,
      "wellknownListName": "defaultList"
    },
    {
      "id": "AAMkADVjNWQ5ZTA2...",
      "displayName": "工作任务",
      "isOwner": true,
      "isShared": false,
      "wellknownListName": "none"
    }
  ]
}
```

**Documentation**: 
- [List todoTaskLists](https://learn.microsoft.com/en-us/graph/api/todo-list-lists?view=graph-rest-1.0)

---

## 🧪 测试计划

### 单元测试
- [ ] `getCachedTodoLists()` 从空缓存返回 `[]`
- [ ] `setCachedTodoLists()` 正确写入 localStorage
- [ ] `getAllTodoListData()` 正确映射 API 响应

### 集成测试
- [ ] 首次加载时从远程获取 To Do Lists
- [ ] 二次加载时从缓存读取
- [ ] Task 模式下 picker 显示 To Do Lists
- [ ] Event 模式下 picker 显示 Calendars
- [ ] 选择 To Do List 后保存到 `event.todoListIds`

### 手动测试
1. 打开 EventEditModal,创建 Task (无时间)
2. 点击 "待办事项" picker
3. 验证显示 Microsoft To Do Lists 列表
4. 选择一个 List,保存事件
5. 重新打开事件,验证选择已保存

---

## ⚠️ 注意事项

### 1. 颜色支持
- Microsoft To Do API 可能不返回颜色
- 如果无颜色,使用默认蓝色 `#3b82f6`
- 或者使用哈希 ID 生成颜色

### 2. 权限要求
- **Scope**: `Tasks.ReadWrite`
- 需要在 MSAL 配置中添加

### 3. 缓存策略
- 缓存 key: `remarkable-todolists-cache`
- 与日历缓存分开存储
- 考虑添加过期时间(如 24 小时)

### 4. 错误处理
- API 调用失败时回退到空列表
- 显示友好的错误提示(如 "请先登录 Microsoft 账户")

---

## 📝 相关文件

- `src/services/MicrosoftCalendarService.ts` - 添加 To Do Lists API
- `src/components/EventEditModal/SyncTargetPicker.tsx` - 添加加载逻辑
- `src/types.ts` - 添加 `TodoList` 类型定义
- `src/App.tsx` - 初始化时同步 To Do Lists

---

## 🔗 参考资料

- [Microsoft Graph To Do API](https://learn.microsoft.com/en-us/graph/api/resources/todo-overview?view=graph-rest-1.0)
- [MSAL Scopes Configuration](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent)
- [SyncTargetPicker Performance Fix](./SYNCTARGETPICKER_PERFORMANCE_FIX.md) - Calendar 实现参考

---

## 📅 实现时间表

| 任务 | 预估时间 | 负责人 | 状态 |
|------|---------|--------|------|
| MicrosoftCalendarService API | 2h | - | ⏳ Pending |
| SyncTargetPicker 加载逻辑 | 1h | - | ⏳ Pending |
| App.tsx 初始化同步 | 0.5h | - | ⏳ Pending |
| 单元测试 | 1h | - | ⏳ Pending |
| 集成测试 | 1h | - | ⏳ Pending |
| 文档更新 | 0.5h | - | ⏳ Pending |
| **总计** | **6h** | - | ⏳ Pending |
