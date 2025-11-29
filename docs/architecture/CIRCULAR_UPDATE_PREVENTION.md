# 数据流循环检测与防护机制设计

## 🎯 问题分析

### 当前循环路径
```
PlanSlate onChange 
→ PlanManager.onSave 
→ EventService.updateEvent 
→ eventsUpdated广播 
→ PlanManager监听并setItems 
→ items prop变化 
→ enhancedValue重新计算 
→ PlanSlate重新渲染
→ 可能再次触发onChange (循环开始)
```

### 新增ID分配问题
```
用户激活新行
→ PlanSlate.onFocus 
→ PlanManager创建pendingEmptyItems
→ 用户输入内容
→ onChange触发
→ 查找items数组找不到事件 (因为还在pending中)
→ 时间插入失败: “找不到对应的item”
```

### 根本原因
1. **无法区分更新来源**: 不知道eventsUpdated是自己还是外部触发的
2. **数据流双向绑定**: props和state相互影响
3. **ID分配时序问题**: pendingEmptyItems和items状态不同步
4. **时间窗口保护不足**: 现有的3秒保护机制不够健壮

## 🛡️ 新的防循环架构

### 方案1: 更新来源标记机制 (推荐⭐⭐⭐⭐⭐)

#### 1.1 在EventService中标记更新来源

```typescript
// EventService.ts - 增强版事件分发
class EventService {
  private static updateSequence = 0;
  private static pendingLocalUpdates = new Map<string, number>();
  
  static async updateEvent(eventId: string, updates: Partial<Event>, options?: {
    skipSync?: boolean;
    source?: 'user-edit' | 'external-sync' | 'auto-sync';
    originComponent?: 'PlanManager' | 'TimeCalendar' | 'Timer';
  }) {
    const updateId = ++this.updateSequence;
    const source = options?.source || 'user-edit';
    
    // 标记本地更新
    if (source === 'user-edit') {
      this.pendingLocalUpdates.set(eventId, updateId);
    }
    
    // ... 现有保存逻辑
    
    // 分发事件时携带来源信息
    this.dispatchEventUpdate(eventId, {
      updateId,
      source,
      originComponent: options?.originComponent,
      isLocalUpdate: source === 'user-edit',
      timestamp: Date.now()
    });
    
    // 清理标记 (延迟清理，确保所有监听者都收到)
    if (source === 'user-edit') {
      setTimeout(() => {
        this.pendingLocalUpdates.delete(eventId);
      }, 5000);
    }
  }
  
  // 检查是否为本地更新
  static isLocalUpdate(eventId: string, updateId: number): boolean {
    const localUpdateId = this.pendingLocalUpdates.get(eventId);
    return localUpdateId === updateId;
  }
}
```

#### 1.2 在组件中根据来源决定是否响应

```typescript
// PlanManager.tsx - 智能响应机制
useEffect(() => {
  const handleEventUpdated = (e: CustomEvent) => {
    const { eventId, updateId, isLocalUpdate, originComponent } = e.detail || {};
    
    // 🚫 跳过自己发出的更新
    if (isLocalUpdate && originComponent === 'PlanManager') {
      console.log('🔄 跳过本地更新，避免循环', { eventId });
      return;
    }
    
    // 🚫 双重检查：询问EventService确认
    if (updateId && EventService.isLocalUpdate(eventId, updateId)) {
      console.log('🔄 EventService确认为本地更新，跳过');
      return;
    }
    
    // ✅ 确认为外部更新，执行同步
    console.log('📡 外部更新，执行同步', { eventId, source: e.detail.source });
    
    if (isDeleted) {
      setItems(prev => prev.filter(event => event.id !== eventId));
      // 🧹 同时从 pendingEmptyItems 中清理
      setPendingEmptyItems(prev => {
        const next = new Map(prev);
        next.delete(eventId);
        return next;
      });
    } else {
      // 🔍 统一ID查找逻辑：支持 pendingEmptyItems
      const existingItem = items.find(i => i.id === eventId) || pendingEmptyItems.get(eventId);
      if (existingItem) {
        // 更新现有事件
        setItems(prev => prev.map(item => 
          item.id === eventId ? { ...item, ...newData } : item
        ));
      } else {
        // 新增事件
        setItems(prev => [...prev, newEvent]);
      }
    }
  };
  
  window.addEventListener('eventsUpdated', handleEventUpdated);
  return () => window.removeEventListener('eventsUpdated', handleEventUpdated);
}, []);
```

#### 1.3 PlanSlate的对应改进

```typescript
// PlanSlate.tsx - 增强的来源检测
useEffect(() => {
  const handleEventUpdated = (e: any) => {
    const { eventId, isLocalUpdate, originComponent, updateId } = e.detail || {};
    
    // 🚫 多重检查避免循环
    if (isLocalUpdate || 
        originComponent === 'PlanManager' || 
        recentlySavedEventsRef.current.has(eventId) ||
        EventService.isLocalUpdate(eventId, updateId)) {
      console.log('🔄 跳过本组件相关的更新');
      return;
    }
    
    // ✅ 确认外部更新，执行增量同步
    // 🔍 增强的ID查找：同时检查 items 和 pendingEmptyItems
    const targetEvent = findEventInAllStates(eventId);
    performIncrementalUpdate(eventId, e.detail, targetEvent);
  };
  
  // 🆕 统一事件查找函数
  const findEventInAllStates = useCallback((eventId: string) => {
    // 先在 Slate 节点中查找
    const slateNode = value.find(node => node.eventId === eventId);
    if (slateNode) return slateNode;
    
    // 再在 items 中查找
    const item = items.find(i => i.id === eventId);
    if (item) return item;
    
    // 最后在 pendingEmptyItems 中查找
    return pendingEmptyItems?.get?.(eventId);
  }, [value, items, pendingEmptyItems]);
  };
  
  window.addEventListener('eventsUpdated', handleEventUpdated);
}, []);
```

### 方案2: 数据流重构 - 移除双向绑定

```typescript
// 新架构：单向数据流 + 状态分离
interface EditorState {
  nodes: EventLineNode[];
  isDirty: boolean;
  lastSyncTimestamp: number;
}

const PlanSlate = ({ initialItems, onSave, onEditorReady }) => {
  // ❌ 移除：实时响应items变化
  // const enhancedValue = useMemo(() => planItemsToSlateNodes(items), [items]);
  
  // ✅ 新增：编辑器独立状态
  const [editorState, setEditorState] = useState<EditorState>(() => ({
    nodes: planItemsToSlateNodes(initialItems),
    isDirty: false,
    lastSyncTimestamp: Date.now()
  }));
  
  // ✅ 只在初始化时同步一次
  useEffect(() => {
    if (initialItems.length > 0 && editorState.nodes.length <= 1) {
      setEditorState(prev => ({
        ...prev,
        nodes: [...planItemsToSlateNodes(initialItems), placeholderLine],
        lastSyncTimestamp: Date.now()
      }));
    }
  }, []); // 空依赖，只初始化一次
  
  // ✅ 外部更新通过专门的API处理
  const syncExternalUpdate = useCallback((eventId: string, action: 'update' | 'delete' | 'create') => {
    setEditorState(prev => {
      // 增量更新逻辑
      const newNodes = handleExternalChange(prev.nodes, eventId, action);
      return {
        ...prev,
        nodes: newNodes,
        lastSyncTimestamp: Date.now()
      };
    });
  }, []);
  
  // ✅ 暴露同步API给父组件
  useEffect(() => {
    onEditorReady?.({ syncExternalUpdate });
  }, [syncExternalUpdate, onEditorReady]);
  
  // ✅ 用户编辑不立即保存
  const handleChange = (newValue) => {
    setEditorState(prev => ({
      ...prev,
      nodes: newValue,
      isDirty: true
    }));
    
    // 可选：防抖自动保存
    debouncedAutoSave();
  };
};
```

### 方案3: BroadcastChannel改进 - 添加发送者标识

```typescript
// EventService.ts - 改进的跨标签页通信
class EventService {
  private static tabId = `tab_${Date.now()}_${Math.random()}`;
  
  private static dispatchEventUpdate(eventId: string, detail: any) {
    const eventDetail = { 
      eventId, 
      ...detail, 
      senderId: this.tabId,  // 🔧 添加发送者ID
      timestamp: Date.now()
    };
    
    // 1. 本地事件
    window.dispatchEvent(new CustomEvent('eventsUpdated', { detail: eventDetail }));
    
    // 2. 跨标签页广播
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'eventsUpdated',
        ...eventDetail
      });
    }
  }
  
  // 监听其他标签页的消息
  static initialize(syncManager: any) {
    // ... 现有代码
    
    if (broadcastChannel) {
      broadcastChannel.onmessage = (event) => {
        const { senderId, ...data } = event.data;
        
        // 🚫 忽略自己发送的消息
        if (senderId === this.tabId) {
          console.log('🔄 忽略自己的广播消息');
          return;
        }
        
        // ✅ 处理其他标签页的更新
        if (data.type === 'eventsUpdated') {
          window.dispatchEvent(new CustomEvent('eventsUpdated', { 
            detail: { ...data, isFromOtherTab: true }
          }));
        }
      };
    }
  }
}
```

## 📅 实施计划

### 阶段1: 快速修复 (1-2天) ✅ 已完成
实施**方案1**的基础版本：
- EventService添加updateId和来源标记
- PlanManager和PlanSlate添加来源检查
- 保持现有架构不变

### 阶段1.5: ID分配优化 (1天) ✅ 已完成
- 用户激活时立即创建pendingEmptyItems
- 统一ID查找逻辑（items + pendingEmptyItems）
- 时间插入BUG修复
- 自动清理过期空行机制
- 状态转换逻辑优化

### 阶段2: 架构重构 (3-5天)  
实施**方案2**：
- 重构为单向数据流
- 移除enhancedValue对items的实时依赖
- 实现增量更新机制

### 阶段3: 跨标签页优化 (1天)
实施**方案3**：
- 改进BroadcastChannel机制
- 添加标签页标识

### 新增 阶段4: 持续优化 (进行中)
- pendingEmptyItems内存优化
- 更精准的状态转换触发条件
- 用户体验指标监控
- 跨组件状态一致性保障

## 🧪 测试验证

```typescript
// 循环检测测试
const testCircularUpdate = () => {
  console.log('🧪 开始循环更新测试');
  
  let updateCount = 0;
  const originalDispatch = EventService.dispatchEventUpdate;
  
  EventService.dispatchEventUpdate = function(eventId, detail) {
    updateCount++;
    console.log(`📊 更新计数: ${updateCount}`, { eventId, detail });
    
    if (updateCount > 5) {
      console.error('🚨 检测到循环更新！');
      throw new Error('Circular update detected');
    }
    
    return originalDispatch.call(this, eventId, detail);
  };
  
  // 触发一次更新，观察是否循环
  EventService.updateEvent('test-event-id', { title: 'Test Update' });
  
  setTimeout(() => {
    console.log(`✅ 测试完成，总更新次数: ${updateCount}`);
    EventService.dispatchEventUpdate = originalDispatch;
  }, 2000);
};
```

## 📋 实施清单

- [ ] 方案1: 更新来源标记机制
  - [ ] EventService添加updateId和来源跟踪
  - [ ] PlanManager添加来源检查逻辑  
  - [ ] PlanSlate添加来源检查逻辑
  - [ ] 测试循环更新防护
- [ ] 方案2: 数据流重构 
  - [ ] 重构PlanSlate状态管理
  - [ ] 实现增量更新API
  - [ ] 移除enhancedValue实时依赖
- [ ] 方案3: BroadcastChannel改进
  - [ ] 添加标签页标识机制
  - [ ] 改进跨标签页消息过滤
- [ ] 测试验证
  - [ ] 单标签页循环测试
  - [ ] 多标签页同步测试  
  - [ ] 性能基准测试

---

**结论**: 方案1是最安全的快速修复，可以立即阻止循环更新。方案2是长期的架构改进，能根本解决问题。建议先实施方案1，再逐步推进方案2。