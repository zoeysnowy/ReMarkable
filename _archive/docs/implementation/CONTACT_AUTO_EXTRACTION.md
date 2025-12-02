# 联系人自动提取与搜索机制说明

## 📋 问题描述

**原始问题**：在 EventEditModal 中手动输入的参会人（如 "Zoey Gong; Jenny Wong; Cindy Cai"），无法在搜索框中被搜索到。

**根本原因**：虽然 ContactService 提供了 `extractAndAddFromEvent()` 方法，但这个方法从未被自动调用，导致事件中的参会人没有被提取并保存到联系人库中。

---

## ✅ 已修复

### 修改 1: EventService 自动提取联系人

**文件**：`src/services/EventService.ts`

**变更**：

1. **导入 ContactService**
```typescript
import { ContactService } from './ContactService';
```

2. **在 `saveEvent()` 中添加自动提取逻辑**
```typescript
// 保存到localStorage
localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
eventLogger.log('💾 [EventService] Event saved to localStorage');

// ✨ 自动提取并保存联系人
if (finalEvent.organizer || finalEvent.attendees) {
  ContactService.extractAndAddFromEvent(finalEvent.organizer, finalEvent.attendees);
  eventLogger.log('👥 [EventService] Auto-extracted contacts from event');
}
```

3. **在 `updateEvent()` 中添加自动提取逻辑**
```typescript
// 保存到localStorage
localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
eventLogger.log('💾 [EventService] Event updated in localStorage');

// ✨ 自动提取并保存联系人（如果 organizer 或 attendees 有更新）
if (updates.organizer !== undefined || updates.attendees !== undefined) {
  ContactService.extractAndAddFromEvent(updatedEvent.organizer, updatedEvent.attendees);
  eventLogger.log('👥 [EventService] Auto-extracted contacts from updated event');
}
```

---

## 🔄 工作流程

### 场景 1: 创建新事件

```
用户在 EventEditModal 中 → 添加参会人 → 保存事件
                                          ↓
                              EventService.saveEvent()
                                          ↓
                            保存事件到 localStorage
                                          ↓
               ContactService.extractAndAddFromEvent() ←【自动调用】
                                          ↓
                检查每个参会人的邮箱是否已存在于联系人库
                                          ↓
                        如果不存在，自动添加到联系人库
                                          ↓
                       标记为 isReMarkable = true
```

### 场景 2: 更新现有事件的参会人

```
用户修改参会人 → 保存事件
                   ↓
        EventService.updateEvent()
                   ↓
     检测到 organizer 或 attendees 有变化
                   ↓
  ContactService.extractAndAddFromEvent() ←【自动调用】
                   ↓
         自动提取并保存新的联系人
```

### 场景 3: 搜索参会人

```
用户在 AttendeeDisplay 中点击搜索
                   ↓
       searchContacts() 被调用
                   ↓
  并行搜索多个来源：
  ├─ searchPlatformContacts()  ← Outlook/Google/iCloud
  ├─ searchLocalContacts()     ← ReMarkable 本地联系人（包括从事件自动提取的）
  └─ searchHistoricalParticipants() ← 直接从所有历史事件中提取
                   ↓
            合并结果 + 去重
                   ↓
          显示搜索结果列表
```

---

## 🗂️ 联系人来源优先级

当同一个人在多个来源都存在时，按以下优先级显示：

1. **平台联系人**（Outlook/Google/iCloud）- 优先级最高
   - `isOutlook: true`
   - `isGoogle: true`
   - `isiCloud: true`

2. **本地联系人**（ReMarkable）
   - `isReMarkable: true`
   - 包括：手动创建 + 从事件自动提取

3. **历史参会人**（没有来源标识）
   - 直接从事件的 organizer/attendees 字段提取
   - 未保存到联系人库

---

## 💾 数据持久化

### ContactService 存储

**Key**: `remarkable-contacts`

**格式**: JSON 数组

```json
[
  {
    "id": "contact-1234567890-abc123",
    "name": "Zoey Gong",
    "email": "zoey.gong@company.com",
    "organization": "产品部",
    "position": "产品经理",
    "isReMarkable": true,
    "avatarUrl": "https://www.gravatar.com/avatar/..."
  },
  {
    "id": "contact-1234567891-def456",
    "name": "Jenny Wong",
    "email": "jenny.wong@company.com",
    "organization": "设计部",
    "position": "设计师",
    "isGoogle": true,
    "avatarUrl": "https://www.gravatar.com/avatar/..."
  }
]
```

### 自动去重机制

```typescript
// ContactService.extractAndAddFromEvent()
if (organizer && organizer.email) {
  const existing = this.getContactByEmail(organizer.email);
  if (!existing) {  // 👈 只有不存在时才添加
    contactsToAdd.push({ ...organizer, isReMarkable: true });
  }
}
```

---

## 🧪 测试验证

### 测试 1: 验证自动提取功能

1. **打开 EventEditModalV2Demo**
2. **点击任意参会人名字，添加新的参会人**（例如：输入 "Test User"）
3. **打开浏览器控制台**，应该看到：
   ```
   💾 [EventService] Event updated in localStorage
   👥 [EventService] Auto-extracted contacts from updated event
   [ContactService] Added contact: Test User
   ```
4. **再次点击参会人搜索框**，输入 "Test"，应该能搜索到 "Test User"

### 测试 2: 验证去重机制

1. **多次添加同一个邮箱的参会人**
2. **检查 localStorage** (`remarkable-contacts`)
3. **验证该邮箱只出现一次**

### 测试 3: 验证多来源搜索

1. **在搜索框输入关键词**
2. **打开控制台**，应该看到：
   ```
   [AttendeeDisplay] Searching for: xxx
   [AttendeeDisplay] Platform contacts: [...]
   [AttendeeDisplay] Local contacts: [...]
   [AttendeeDisplay] Historical contacts: [...]
   [AttendeeDisplay] Merged results (after deduplication): [...]
   ```

---

## 🔍 调试命令

### 查看所有联系人

在浏览器控制台执行：

```javascript
// 方法 1: 查看 localStorage
JSON.parse(localStorage.getItem('remarkable-contacts'))

// 方法 2: 通过 ContactService
// (需要先在代码中暴露 getAllContacts 到 window)
window.ContactService?.getAllContacts()
```

### 手动触发提取

```javascript
// 从某个事件提取联系人
const event = { 
  organizer: { name: 'Test', email: 'test@example.com' },
  attendees: [
    { name: 'User1', email: 'user1@example.com' },
    { name: 'User2', email: 'user2@example.com' }
  ]
};

window.ContactService?.extractAndAddFromEvent(event.organizer, event.attendees);
```

### 清空所有联系人（重置）

```javascript
localStorage.removeItem('remarkable-contacts');
location.reload();
```

---

## 📊 性能影响

### 每次保存事件的额外开销

- **检查去重**: O(n)，n = 联系人总数
- **添加新联系人**: O(1)（平均情况）
- **保存到 localStorage**: O(m)，m = 联系人总数

**预期影响**：
- 100 个联系人：< 5ms
- 1000 个联系人：< 20ms
- 对用户体验无感知

---

## 🎯 未来优化建议

1. **批量提取优化**
   - 如果一次导入大量事件（如 Outlook 同步），可以批量提取联系人
   - 避免每个事件都单独调用 `extractAndAddFromEvent()`

2. **索引优化**
   - 当联系人数量超过 1000 时，考虑建立邮箱索引
   - 使用 Map 结构加速查询

3. **异步处理**
   - 将联系人提取改为异步操作
   - 不阻塞事件保存流程

4. **智能合并**
   - 当同一个邮箱在多个来源都存在时，合并所有字段
   - 保留最完整的信息（如平台联系人有头像，本地联系人有备注）

---

## ✨ 总结

现在，**只要在 EventEditModal 中添加/修改参会人并保存事件**，这些参会人就会：

1. ✅ **自动提取到联系人库**（如果邮箱不存在）
2. ✅ **可以在搜索框中被搜索到**
3. ✅ **保存到 localStorage**，下次启动仍然可用
4. ✅ **支持悬浮预览和编辑**

无需任何手动操作！🎉
