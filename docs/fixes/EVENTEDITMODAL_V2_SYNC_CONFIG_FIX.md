# EventEditModal V2 同步配置架构修复

> **状态**: ✅ 已完成  
> **修复日期**: 2025-11-27  
> **版本**: v2.15  
> **相关 PR/Commit**: subEventConfig 架构实现

## 问题描述
EventEditModal V2 曾使用错误的 `planSyncConfig`/`actualSyncConfig` 双配置架构（已弃用），导致：
1. 日历选择器保存和显示错误
2. 同步模式选择器数据不一致
3. 父子事件同步逻辑混乱
4. 数据冗余和维护困难

## 正确架构理解

### 核心原则：单一数据结构
每个事件只有：
- `calendarIds: string[]` - 同步目标日历列表
- `syncMode: string` - 同步模式（'receive-only', 'send-only', 'bidirectional' 等）

### 父子事件关系
- **父事件（Parent Event）**: `!event.parentEventId`
  - 拥有 `timerLogs: string[]` - 子事件 ID 列表
  - 代表"计划"
- **子事件（Child Event）**: `event.parentEventId` 存在
  - 拥有 `isTimer: true` 标记
  - 代表"实际进展"

### EventEditModal V2 两种模式

#### 模式 1：父事件模式 (isParentMode = true)
- `mainEvent` = 父事件
- `linkedEvents` = 子事件列表
- **中 Section（计划安排）**: 编辑 mainEvent 的 calendarIds + syncMode
- **下 Section（实际进展）**: 批量更新所有 linkedEvents 的 calendarIds + syncMode

#### 模式 2：子事件模式 (isParentMode = false)
- `mainEvent` = 子事件
- `linkedEvent` = 父事件
- **中 Section（计划安排）**: 显示并编辑 linkedEvent（父事件）的 calendarIds + syncMode
- **下 Section（实际进展）**: 编辑 mainEvent 的 calendarIds + syncMode

## 修复内容

### 1. 类型定义修复

#### Event 接口 (types.ts)
```typescript
// ❌ 旧的错误结构
interface Event {
  calendarIds?: string[];
  planSyncConfig?: {
    mode: string;
    targetCalendars: string[];
  };
  actualSyncConfig?: {
    mode: string;
    targetCalendars: string[];
  };
}

// ✅ 新的正确结构
interface Event {
  calendarIds?: string[];
  syncMode?: string;
}
```

#### MockEvent 接口 (EventEditModalV2.tsx)
```typescript
// ✅ 已更新为单一数据结构
interface MockEvent {
  calendarIds?: string[];
  syncMode?: string;
}
```

### 2. 模式检测逻辑
```typescript
// 🔧 模式检测：判断是父事件模式还是子事件模式
const isParentMode = !event?.parentEventId;

console.log('🔍 [EventEditModalV2] 模式检测:', {
  isParentMode,
  eventId: event?.id,
  parentEventId: event?.parentEventId,
  isTimer: event?.isTimer
});
```

### 3. FormData 初始化修复
```typescript
// ❌ 旧代码
const [formData, setFormData] = useState<MockEvent>(() => {
  if (event) {
    return {
      ...event,
      calendarIds: event.calendarIds || [],
      planSyncConfig: event.planSyncConfig || { mode: 'receive-only', targetCalendars: [] },
      actualSyncConfig: event.actualSyncConfig || null,
    };
  }
  // ...
});

// ✅ 新代码
const [formData, setFormData] = useState<MockEvent>(() => {
  if (event) {
    return {
      ...event,
      calendarIds: event.calendarIds || [],
      syncMode: event.syncMode || 'receive-only',
    };
  }
  // ...
});
```

### 4. 计划安排日历选择器修复

#### 显示逻辑
```typescript
// ✅ 根据模式显示不同的 calendarIds
const selectedIds = isParentMode 
  ? (formData.calendarIds || [])           // 父模式：显示 mainEvent
  : (parentEvent?.calendarIds || []);      // 子模式：显示 parentEvent
```

#### 变更处理
```typescript
onMultiSelectionChange={async (calendarIds) => {
  console.log('📝 [EventEditModalV2] 计划日历变更:', { isParentMode, calendarIds });
  
  if (isParentMode) {
    // 父模式：更新 mainEvent 的 calendarIds
    setFormData(prev => ({
      ...prev,
      calendarIds: calendarIds
    }));
  } else {
    // 子模式：实时同步到父事件
    if (parentEvent) {
      console.log('🔗 [EventEditModalV2] 子事件模式：同步 calendarIds 到父事件:', parentEvent.id);
      const { EventHub } = await import('../../services/EventHub');
      await EventHub.updateFields(parentEvent.id, {
        calendarIds: calendarIds,
      }, {
        source: 'EventEditModalV2-ChildToParent-PlanSync'
      });
      console.log('✅ [EventEditModalV2] 父事件 calendarIds 已实时同步');
    }
  }
}}
```

### 5. 实际进展日历选择器修复

#### 变更处理
```typescript
onMultiSelectionChange={async (calendarIds) => {
  console.log('📝 [EventEditModalV2] 实际进展日历变更:', { isParentMode, calendarIds });
  setSyncCalendarIds(calendarIds);
  
  if (isParentMode) {
    // 父模式：批量更新所有子事件的 calendarIds
    if (childEvents.length > 0) {
      console.log('🔗 [EventEditModalV2] 父模式：批量更新子事件 calendarIds:', {
        childCount: childEvents.length,
        calendarIds
      });
      
      const { EventHub } = await import('../../services/EventHub');
      for (const childEvent of childEvents) {
        if (childEvent.isTimer) {
          await EventHub.updateFields(childEvent.id, {
            calendarIds: calendarIds,
          }, {
            source: 'EventEditModalV2-ParentToChildren-ActualSync'
          });
        }
      }
      console.log('✅ [EventEditModalV2] 子事件 calendarIds 已实时更新');
    }
  } else {
    // 子模式：更新当前事件（mainEvent）的 calendarIds
    setFormData(prev => ({
      ...prev,
      calendarIds: calendarIds
    }));
  }
}}
```

### 6. 同步模式选择器修复

#### 计划安排同步模式
```typescript
// ✅ 直接更新 formData.syncMode
onSelectionChange={(modeId) => {
  setSourceSyncMode(modeId);
  setFormData(prev => ({
    ...prev,
    syncMode: modeId
  }));
  setShowSourceSyncModePicker(false);
}}
```

#### 实际进展同步模式
```typescript
onSelectionChange={(modeId) => {
  setSyncSyncMode(modeId);
  
  if (isParentMode) {
    // 父模式：批量更新所有子事件的 syncMode
    (async () => {
      if (childEvents.length > 0) {
        console.log('🔗 [EventEditModalV2] 父模式：批量更新子事件 syncMode:', {
          childCount: childEvents.length,
          syncMode: modeId
        });
        
        const { EventHub } = await import('../../services/EventHub');
        for (const childEvent of childEvents) {
          if (childEvent.isTimer) {
            await EventHub.updateFields(childEvent.id, {
              syncMode: modeId,
            }, {
              source: 'EventEditModalV2-ParentToChildren-ActualSyncMode'
            });
          }
        }
        console.log('✅ [EventEditModalV2] 子事件已批量更新');
      }
    })();
  } else {
    // 子模式：更新当前事件（mainEvent）的 syncMode
    setFormData(prev => ({
      ...prev,
      syncMode: modeId
    }));
  }
  
  setShowSyncSyncModePicker(false);
}}
```

### 7. handleSave() 父子同步逻辑修复

```typescript
// 🔧 Step 6.5: 父子事件架构处理（使用新的单一数据结构）
// 父模式：batch update 子事件；子模式：sync 计划字段到父事件
if (isParentMode) {
  // ==================== 父事件模式：批量更新所有子事件 ====================
  if (event?.timerLogs && event.timerLogs.length > 0) {
    console.log('🔗 [EventEditModalV2] 父事件模式：批量更新子事件 calendarIds + syncMode:', {
      childCount: event.timerLogs.length,
      calendarIds: updatedEvent.calendarIds,
      syncMode: updatedEvent.syncMode
    });
    
    for (const childId of event.timerLogs) {
      const childEvent = EventService.getEventById(childId);
      if (childEvent && childEvent.isTimer) {
        await EventHub.updateFields(childId, {
          calendarIds: updatedEvent.calendarIds,
          syncMode: updatedEvent.syncMode,
        }, {
          source: 'EventEditModalV2-ParentToChildren'
        });
      }
    }
    
    console.log('✅ [EventEditModalV2] 所有子事件已同步');
  }
} else {
  // ==================== 子事件模式：同步计划字段到父事件 ====================
  const parentEvent = EventService.getEventById(formData.parentEventId!);
  if (parentEvent) {
    console.log('🔗 [EventEditModalV2] 子事件模式：同步计划字段到父事件:', formData.parentEventId);
    
    // 同步：标题、标签、时间、地点、参与者、日历配置
    await EventHub.updateFields(formData.parentEventId!, {
      title: updatedEvent.title,
      tags: updatedEvent.tags,
      emoji: updatedEvent.emoji,
      color: updatedEvent.color,
      startTime: updatedEvent.startTime,
      endTime: updatedEvent.endTime,
      isAllDay: updatedEvent.isAllDay,
      location: updatedEvent.location,
      attendees: updatedEvent.attendees,
      calendarIds: updatedEvent.calendarIds,
      syncMode: updatedEvent.syncMode,
    }, {
      source: 'EventEditModalV2-ChildToParent'
    });
    
    console.log('✅ [EventEditModalV2] 父事件计划字段已同步');
  }
}
```

## 测试验证

### 测试场景 1：父事件模式编辑
1. 打开父事件（没有 parentEventId 的事件）
2. 修改"计划安排"的日历选择和同步模式
   - ✅ 应该更新 mainEvent 的 calendarIds 和 syncMode
3. 修改"实际进展"的日历选择和同步模式
   - ✅ 应该批量更新所有子事件的 calendarIds 和 syncMode
4. 保存事件
   - ✅ 验证父事件和所有子事件的配置正确保存

### 测试场景 2：子事件模式编辑
1. 打开子事件（有 parentEventId 的事件）
2. 修改"计划安排"的日历选择和同步模式
   - ✅ 应该实时同步到父事件的 calendarIds 和 syncMode
3. 修改"实际进展"的日历选择和同步模式
   - ✅ 应该更新当前子事件的 calendarIds 和 syncMode
4. 保存事件
   - ✅ 验证父事件的计划字段和子事件的配置正确保存

### 测试场景 3：数据一致性
1. 打开父事件，设置计划日历为 [A, B]
2. 关闭并重新打开
   - ✅ 验证显示的日历为 [A, B]
3. 打开子事件，查看计划日历
   - ✅ 验证显示父事件的日历 [A, B]
4. 在子事件中修改计划日历为 [C, D]
   - ✅ 验证父事件也被更新为 [C, D]

## 日志输出示例

### 父事件模式
```
🔍 [EventEditModalV2] 模式检测: { isParentMode: true, eventId: 'event-123', parentEventId: undefined }
📝 [EventEditModalV2] 计划日历变更: { isParentMode: true, calendarIds: ['outlook-work'] }
📝 [EventEditModalV2] 实际进展日历变更: { isParentMode: true, calendarIds: ['outlook-work'] }
🔗 [EventEditModalV2] 父模式：批量更新子事件 calendarIds: { childCount: 2, calendarIds: ['outlook-work'] }
✅ [EventEditModalV2] 子事件 calendarIds 已实时更新
```

### 子事件模式
```
🔍 [EventEditModalV2] 模式检测: { isParentMode: false, eventId: 'timer-456', parentEventId: 'event-123' }
📝 [EventEditModalV2] 计划日历变更: { isParentMode: false, calendarIds: ['google-personal'] }
🔗 [EventEditModalV2] 子事件模式：同步 calendarIds 到父事件: event-123
✅ [EventEditModalV2] 父事件 calendarIds 已实时同步
```

## 影响范围

### 已修改文件
1. `src/types.ts` - 添加 `syncMode` 字段到 Event 接口
2. `src/components/EventEditModal/EventEditModalV2.tsx` - 核心修复

### 未修改但相关的文件
1. `src/services/EventService.ts` - 使用 `getEventById()` 方法
2. `src/services/EventHub.ts` - 使用 `updateFields()` 方法
3. `src/components/SimpleCalendarDropdown.tsx` - 日历选择组件（工作正常）
4. `src/components/SyncModeDropdown.tsx` - 同步模式选择组件（工作正常）

## 向后兼容性

### 数据迁移
旧数据中的 `planSyncConfig` 和 `actualSyncConfig` 字段不会自动删除，但不再被使用。
新代码只读写 `calendarIds` 和 `syncMode` 字段。

### 建议
可以编写数据迁移脚本，将旧的 `planSyncConfig.targetCalendars` 和 `planSyncConfig.mode` 
迁移到 `calendarIds` 和 `syncMode`。

## 后续优化建议

1. **清理冗余字段**: 从 Event 接口中完全移除 `planSyncConfig` 和 `actualSyncConfig`
2. **数据迁移脚本**: 编写脚本将现有事件的旧配置迁移到新结构
3. **单元测试**: 为父子事件同步逻辑添加单元测试
4. **文档更新**: 更新 PRD 文档，反映正确的架构设计

## 参考文档
- `docs/PRD/EVENTEDITMODAL_V2_PRD.md` - EventEditModal V2 产品需求文档
- `docs/architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md` - EventHub 架构文档
