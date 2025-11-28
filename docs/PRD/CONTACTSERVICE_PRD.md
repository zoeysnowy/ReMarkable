# ContactService 产品需求文档 (PRD)

## 文档信息
- **创建日期**: 2025-11-18
- **版本**: v1.0
- **状态**: 规划中
- **负责人**: 系统架构
- **相关文档**: EventService PRD, AttendeeDisplay 组件

---

## 一、概述

### 1.1 背景
当前联系人管理存在以下问题：
1. **状态分散**：联系人数据分布在多个组件的本地状态中
2. **更新不同步**：修改联系人后需要手动更新所有使用该联系人的组件
3. **职责不清**：联系人编辑逻辑嵌入在业务组件（如 AttendeeDisplay）中，无法复用
4. **缺乏事件机制**：没有联系人变更的广播机制，导致数据不一致

### 1.2 目标
重构 ContactService 为具有完整事件驱动架构的服务层，参考 EventService 的设计模式：
- ✅ **单一数据源**：ContactService 作为联系人数据的唯一真实来源
- ✅ **事件驱动**：联系人增删改触发事件广播
- ✅ **组件解耦**：组件订阅事件，自动响应变更
- ✅ **可复用组件**：ContactModal 独立封装，可在任何场景使用

### 1.3 适用范围
- 所有联系人相关功能（参会人、分享对象、协作者等）
- 联系人编辑 Modal
- 联系人搜索和选择
- 联系人信息展示
- **联系人关联事件查询**（查看与某人的所有会议）

### 1.4 待实现功能（来自 EventEditModal v2 PRD）

#### 1.4.1 预览卡片增强
- ❌ **关联事件列表**：预览卡片显示最近 5 个关联事件
- ❌ **预览卡片内联编辑**：直接在预览中编辑字段，无需打开完整 Modal
- ❌ **扩展字段显示**：职务、标签、备注

#### 1.4.2 完整 Modal 增强
- ✅ 所有字段内联编辑（已实现）
- ❌ **完整关联事件列表**：显示所有关联事件（支持分页/滚动）
- ❌ **点击事件跳转**：点击关联事件跳转到该事件
- ❌ **扩展字段管理**：职务、标签的编辑和管理

#### 1.4.3 发起人逻辑
- ❌ 外部同步事件显示 `organizer` 字段
- ❌ 用户创建的事件，如果有邮箱参会人，显示用户为发起人
- ❌ 发起人样式：**斜体 + 加粗 + 下划线**

#### 1.4.4 联系人搜索优化
- ✅ 多来源搜索（Outlook/Google/iCloud/ReMarkable/历史参会人）（已实现）
- ✅ 来源标签显示（已实现）
- ❌ 去重优化（同一人多个来源时的优先级处理）

---

## 二、核心架构设计

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       ContactService                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  数据管理层                                           │   │
│  │  - getAllContacts()                                   │   │
│  │  - getContactById(id)                                 │   │
│  │  - searchContacts(query)                              │   │
│  │  - createContact(contact)                             │   │
│  │  - updateContact(id, updates)                         │   │
│  │  - deleteContact(id)                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  事件管理层 (新增)                                    │   │
│  │  - addEventListener(eventType, callback)              │   │
│  │  - removeEventListener(eventType, callback)           │   │
│  │  - emitEvent(eventType, data)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  集成层                                               │   │
│  │  - Google Contacts Sync                               │   │
│  │  - Outlook Contacts Sync                              │   │
│  │  - Local Contacts (ReMarkable)                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ 事件广播
                            ▼
    ┌───────────────────────────────────────────────┐
    │         事件总线 (Event Bus)                   │
    │  - contact.created                             │
    │  - contact.updated ◄──┐                        │
    │  - contact.deleted    │ 双向通知               │
    │  - contacts.synced    │                        │
    └───────────────────────┼───────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ AttendeeDisplay│ │ ContactModal │ │ SharePanel   │
    │  订阅: updated │ │  订阅: updated│ │  订阅: all   │
    │  自动刷新列表  │ │  自动刷新显示 │ │  自动刷新列表 │
    └──────────────┘ └──────────────┘ └──────────────┘
                            │
                            │ 关联关系
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       EventService                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  监听 ContactService 事件                             │   │
│  │  - contact.updated → 更新事件中的参会人信息           │   │
│  │  - contact.deleted → 从事件中移除该参会人             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  事件数据管理                                         │   │
│  │  - Event.attendees: Contact[]                         │   │
│  │  - 自动同步联系人变更到相关事件                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.1.1 ContactService 与 EventService 的关联

**关联点**：
1. **Event.attendees 字段**: 事件中存储参会人（Contact 对象数组）
2. **联系人更新级联**: 当联系人信息更新时，所有包含该联系人的事件需要同步更新
3. **联系人删除处理**: 删除联系人时，需要从所有事件中移除该参会人
4. **事件创建时的联系人引用**: 创建事件时选择的参会人需要是最新的联系人信息

**实现机制**：
```typescript
// EventService 订阅 ContactService 的事件
ContactService.addEventListener('contact.updated', (event) => {
  const { id, after } = event.data;
  
  // 查找所有包含该联系人的事件
  const relatedEvents = EventService.getAllEvents().filter(e => 
    e.attendees?.some(a => a.id === id)
  );
  
  // 批量更新这些事件中的联系人信息
  relatedEvents.forEach(event => {
    const updatedAttendees = event.attendees.map(a => 
      a.id === id ? after : a
    );
    EventService.updateEvent(event.id, { attendees: updatedAttendees });
  });
});

ContactService.addEventListener('contact.deleted', (event) => {
  const { id } = event.data;
  
  // 从所有事件中移除该联系人
  const relatedEvents = EventService.getAllEvents().filter(e => 
    e.attendees?.some(a => a.id === id)
  );
  
  relatedEvents.forEach(event => {
    const updatedAttendees = event.attendees.filter(a => a.id !== id);
    EventService.updateEvent(event.id, { attendees: updatedAttendees });
  });
});
```

### 2.2 数据流

#### 2.2.1 创建联系人
```
User Input (ContactModal)
  └─> ContactService.createContact(contact)
      ├─> 保存到 localStorage
      ├─> 分配唯一 ID
      └─> emitEvent('contact.created', contact)
          └─> 所有订阅者收到通知
              ├─> AttendeeDisplay 刷新搜索结果
              ├─> SharePanel 刷新联系人列表
              └─> ContactModal 关闭
```

#### 2.2.2 更新联系人
```
User Edit (ContactModal)
  └─> ContactService.updateContact(id, updates)
      ├─> 更新 localStorage
      └─> emitEvent('contact.updated', { id, before, after })
          └─> 所有订阅者收到通知
              ├─> AttendeeDisplay 刷新显示的联系人
              ├─> EventCard 刷新参会人信息
              └─> ContactModal 刷新显示
```

#### 2.2.3 删除联系人
```
User Action (ContactModal)
  └─> ContactService.deleteContact(id)
      ├─> 从 localStorage 删除
      └─> emitEvent('contact.deleted', { id, contact })
          └─> 所有订阅者收到通知
              ├─> AttendeeDisplay 从列表移除
              ├─> EventCard 清除参会人引用
              └─> ContactModal 关闭
```

---

## 三、技术实现方案

### 3.1 ContactService 接口定义

```typescript
// src/services/ContactService.ts

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  avatarUrl?: string;
  source: 'google' | 'outlook' | 'remarkable';
  isReMarkable?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ContactEventType = 
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'contacts.synced';

export interface ContactEvent {
  type: ContactEventType;
  data: {
    contact?: Contact;
    id?: string;
    before?: Contact;
    after?: Contact;
    contacts?: Contact[];
  };
  timestamp: string;
}

type ContactEventListener = (event: ContactEvent) => void;

class ContactServiceClass {
  private listeners: Map<ContactEventType, Set<ContactEventListener>>;
  
  // ===== 事件管理 =====
  addEventListener(type: ContactEventType, listener: ContactEventListener): void;
  removeEventListener(type: ContactEventType, listener: ContactEventListener): void;
  private emitEvent(type: ContactEventType, data: any): void;
  
  // ===== 数据操作 =====
  getAllContacts(): Contact[];
  getContactById(id: string): Contact | null;
  searchContacts(query: string): Contact[];
  createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Contact;
  updateContact(id: string, updates: Partial<Contact>): Contact;
  deleteContact(id: string): void;
  
  // ===== 批量操作 =====
  bulkCreate(contacts: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>[]): Contact[];
  bulkUpdate(updates: { id: string; updates: Partial<Contact> }[]): Contact[];
  bulkDelete(ids: string[]): void;
  
  // ===== 同步相关 =====
  syncGoogleContacts(): Promise<void>;
  syncOutlookContacts(): Promise<void>;
}

export const ContactService = new ContactServiceClass();
```

### 3.2 ContactModal 组件设计

```typescript
// src/components/ContactModal/ContactModal.tsx

interface ContactModalProps {
  visible: boolean;
  contact?: Contact;
  mode: 'create' | 'edit' | 'view';
  onClose: () => void;
  triggerElement?: HTMLElement;
  placement?: 'top' | 'bottom';
}

export const ContactModal: React.FC<ContactModalProps> = ({
  visible,
  contact,
  mode,
  onClose,
  triggerElement,
  placement = 'bottom'
}) => {
  const [editedContact, setEditedContact] = useState(contact);
  const [initialValues, setInitialValues] = useState(contact);
  
  const handleSave = () => {
    if (mode === 'create') {
      ContactService.createContact(editedContact);
    } else if (mode === 'edit') {
      ContactService.updateContact(contact.id, editedContact);
    }
    onClose();
  };
  
  const handleDelete = () => {
    if (confirm(`确定要删除联系人 "${contact.name}" 吗？`)) {
      ContactService.deleteContact(contact.id);
      onClose();
    }
  };
  
  return (
    <Tippy
      visible={visible}
      content={<ModalContent />}
      placement={placement}
      getReferenceClientRect={() => triggerElement?.getBoundingClientRect()}
    >
      <span ref={virtualRef} />
    </Tippy>
  );
};
```

### 3.3 组件订阅模式

```typescript
// src/components/AttendeeDisplay.tsx

const AttendeeDisplay: React.FC = () => {
  const [participants, setParticipants] = useState<Contact[]>([]);
  
  useEffect(() => {
    // 订阅联系人更新事件
    const handleContactUpdated = (event: ContactEvent) => {
      const { id, after } = event.data;
      setParticipants(prev => 
        prev.map(p => p.id === id ? after : p)
      );
    };
    
    const handleContactDeleted = (event: ContactEvent) => {
      const { id } = event.data;
      setParticipants(prev => prev.filter(p => p.id !== id));
    };
    
    ContactService.addEventListener('contact.updated', handleContactUpdated);
    ContactService.addEventListener('contact.deleted', handleContactDeleted);
    
    return () => {
      ContactService.removeEventListener('contact.updated', handleContactUpdated);
      ContactService.removeEventListener('contact.deleted', handleContactDeleted);
    };
  }, []);
  
  return (
    <div>
      {participants.map(person => (
        <ContactChip 
          key={person.id} 
          contact={person}
          onEdit={() => setModalVisible(true)}
        />
      ))}
      
      <ContactModal
        visible={modalVisible}
        contact={selectedContact}
        mode="edit"
        onClose={() => setModalVisible(false)}
      />
    </div>
  );
};
```

---

## 四、实施计划

### 4.1 Phase 1: ContactService 事件机制 (1-2天)

**目标**: 为 ContactService 添加事件监听/广播能力

**任务**:
1. ✅ 实现 `addEventListener()` / `removeEventListener()`
2. ✅ 实现 `emitEvent()` 内部方法
3. ✅ 在所有 CRUD 操作中添加事件触发
4. ✅ 编写单元测试验证事件机制
5. ✅ **在 EventService 中订阅 ContactService 事件** ⭐ 新增

**验收标准**:
- 创建/更新/删除联系人时正确触发事件
- 多个监听器可以同时订阅同一事件
- 取消订阅后不再收到事件
- **EventService 能监听到联系人变更并更新相关事件** ⭐ 新增

**代码示例**:
```typescript
// 内部事件触发
updateContact(id: string, updates: Partial<Contact>): Contact {
  const before = this.getContactById(id);
  const after = { ...before, ...updates, updatedAt: new Date().toISOString() };
  
  // 保存到 localStorage
  this.saveToStorage(after);
  
  // 触发事件
  this.emitEvent('contact.updated', { id, before, after });
  
  return after;
}

// EventService 订阅联系人变更（新增）
// 在 EventService.initialize() 中添加
ContactService.addEventListener('contact.updated', (event) => {
  const { id, after } = event.data;
  eventLogger.log('📇 [EventService] Contact updated, syncing to related events:', id);
  
  // 查找并更新所有包含该联系人的事件
  const events = EventService.getAllEvents();
  const relatedEvents = events.filter(e => 
    e.attendees?.some(a => a.id === id)
  );
  
  relatedEvents.forEach(event => {
    const updatedAttendees = event.attendees.map(a => 
      a.id === id ? after : a
    );
    EventService.updateEvent(event.id, { attendees: updatedAttendees });
  });
  
  eventLogger.log(`✅ [EventService] Updated ${relatedEvents.length} events with new contact info`);
});

ContactService.addEventListener('contact.deleted', (event) => {
  const { id } = event.data;
  eventLogger.log('🗑️ [EventService] Contact deleted, removing from events:', id);
  
  // 从所有事件中移除该联系人
  const events = EventService.getAllEvents();
  const relatedEvents = events.filter(e => 
    e.attendees?.some(a => a.id === id)
  );
  
  relatedEvents.forEach(event => {
    const updatedAttendees = event.attendees.filter(a => a.id !== id);
    EventService.updateEvent(event.id, { attendees: updatedAttendees });
  });
  
  eventLogger.log(`✅ [EventService] Removed contact from ${relatedEvents.length} events`);
});
```

### 4.2 Phase 1.5: 基础功能完善 (1-2天) ⭐ 新增

**目标**: 完善 ContactService 基础能力，为 Phase 2 做准备

**任务**:
1. ✅ 实现 `getContactsByIds(ids: string[]): Contact[]` - 批量获取
2. ✅ 实现 `searchPlatformContacts(query: string): Contact[]` - 平台联系人搜索
3. ✅ 实现 `searchLocalContacts(query: string): Contact[]` - 本地联系人搜索
4. ✅ 实现 `mergeContactSources(contacts: Contact[]): Contact[]` - 多来源去重
5. ✅ 实现扩展字段解析逻辑（从 `notes` 中提取 `position` / `tags`）
6. ✅ 添加 `saveContact(contact: Contact): Contact` - 新建联系人

**代码示例**:
```typescript
// 扩展字段解析
class ContactService {
  // 从 notes 中提取结构化数据
  private parseExtendedFields(contact: Contact): ContactWithExtras {
    if (!contact.notes) return contact;
    
    try {
      const lines = contact.notes.split('\n');
      const extended: any = { ...contact };
      
      lines.forEach(line => {
        if (line.startsWith('职务：')) {
          extended.position = line.replace('职务：', '').trim();
        } else if (line.startsWith('标签：')) {
          extended.tags = line.replace('标签：', '').split(',').map(t => t.trim());
        }
      });
      
      return extended;
    } catch (e) {
      return contact;
    }
  }
  
  // 保存扩展字段到 notes
  private serializeExtendedFields(contact: ContactWithExtras): Contact {
    const { position, tags, ...baseContact } = contact;
    const notesLines = [];
    
    if (position) notesLines.push(`职务：${position}`);
    if (tags?.length) notesLines.push(`标签：${tags.join(', ')}`);
    
    // 保留原有 notes 中的其他内容
    const existingNotes = baseContact.notes?.split('\n').filter(line => 
      !line.startsWith('职务：') && !line.startsWith('标签：')
    ) || [];
    
    return {
      ...baseContact,
      notes: [...notesLines, ...existingNotes].join('\n')
    };
  }
}
```

**验收标准**:
- 多来源搜索返回去重结果
- 扩展字段（职务/标签）正确解析和保存
- 批量获取接口性能良好（100个联系人 < 50ms）

---

### 4.3 Phase 2: ContactModal 组件提取 (2-3天)

**目标**: 将 ContactModal 从 AttendeeDisplay 中提取为独立组件

**任务**:
1. ✅ 创建 `src/components/ContactModal/` 目录
2. ✅ 提取 Modal HTML 结构和样式
3. ✅ 实现 `create` / `edit` / `view` 三种模式
4. ✅ 集成 Tippy 定位逻辑
5. ✅ 实现 Enter 键跳转字段功能
6. ✅ 移除 ContactModal 内部对 `setParticipants` 的依赖

**文件结构**:
```
src/components/ContactModal/
├── ContactModal.tsx          # 主组件
├── ContactModal.css          # 样式
└── index.ts                  # 导出
```

**组件 Props**:
```typescript
interface ContactModalProps {
  visible: boolean;                    // 是否显示
  contact?: Contact;                   // 联系人对象（edit/view 模式必填）
  mode?: 'create' | 'edit' | 'view';   // 模式（默认 edit）
  onClose: () => void;                 // 关闭回调
  triggerElement?: HTMLElement;        // 触发元素（用于定位）
  placement?: 'top' | 'bottom' | 'top-start' | 'bottom-start'; // 定位方向
  initialFocus?: 'name' | 'email' | 'phone' | 'organization'; // 初始聚焦字段
  onSave?: (contact: Contact) => void; // 保存成功回调
  onDelete?: (contactId: string) => void; // 删除成功回调
}
```

**使用示例**:

#### 基础用法 - 编辑联系人
```tsx
import { ContactModal } from '@/components/ContactModal';

function MyComponent() {
  const [modalState, setModalState] = useState({ visible: false });

  return (
    <ContactModal
      visible={modalState.visible}
      contact={selectedContact}
      mode="edit"
      onClose={() => setModalState({ visible: false })}
      onSave={(updated) => console.log('已更新:', updated)}
    />
  );
}
```

#### 高级用法 - Tippy 定位
```tsx
function AttendeeDisplay() {
  const handleClickParticipant = (contact: Contact, e: React.MouseEvent) => {
    setModalState({
      visible: true,
      contact,
      triggerElement: e.currentTarget as HTMLElement,
    });
  };

  return (
    <>
      <span onClick={(e) => handleClickParticipant(contact, e)}>
        {contact.name}
      </span>

      <ContactModal
        visible={modalState.visible}
        contact={modalState.contact}
        mode="edit"
        triggerElement={modalState.triggerElement}
        placement="bottom-start"
        onClose={() => setModalState({ visible: false })}
      />
    </>
  );
}
```

#### 创建新联系人
```tsx
<ContactModal
  visible={true}
  mode="create"
  contact={{ name: '', email: '' }}
  onClose={() => setVisible(false)}
  onSave={(newContact) => console.log('新建:', newContact)}
/>
```

**特性**:
- ✅ **内联编辑**: 所有字段点击即可编辑
- ✅ **键盘导航**: 
  - `Enter` - 跳转到下一个字段
  - `Ctrl/Cmd + Enter` - 保存并关闭
  - `Escape` - 关闭 Modal
- ✅ **自动保存**: 失焦时自动保存
- ✅ **事件驱动**: 通过 ContactService 事件机制自动同步
- ✅ **完全独立**: 不依赖外部状态

**迁移指南**:

**之前** (AttendeeDisplay 内嵌):
```tsx
const [fullContactModal, setFullContactModal] = useState({ visible: false });
// 200+ 行 Modal JSX 代码...
```

**之后** (独立组件):
```tsx
import { ContactModal } from '@/components/ContactModal';

<ContactModal
  visible={modalState.visible}
  contact={modalState.contact}
  mode="edit"
  triggerElement={modalState.triggerElement}
  onClose={() => setModalState({ visible: false })}
/>
```

**优势**:
- 代码量减少 ~200 行
- 职责清晰，易于维护
- 可在多个组件复用
- 独立测试，提高质量

**验收标准**:
- ContactModal 可以独立使用，不依赖 AttendeeDisplay
- 支持通过 props 传入 triggerElement 和 placement
- 保存/删除操作通过 ContactService 完成
- Modal 关闭后组件自动清理
- 所有三种模式（create/edit/view）正常工作

### 4.4 Phase 3: AttendeeDisplay 重构 (1-2天) ✅ 已完成

**目标**: 改造 AttendeeDisplay 使用事件订阅模式

**任务**:
1. ✅ 添加 ContactService 事件订阅（contact.updated / contact.deleted）
2. ✅ 移除所有手动 getContactById 调用
3. ✅ 优化 parseParticipantsFromText，依赖事件自动同步
4. ✅ ContactPreviewCard 添加事件订阅
5. ✅ FullContactModal 添加事件订阅

**实现代码**:
```typescript
// AttendeeDisplay.tsx - 事件订阅
useEffect(() => {
  const handleContactUpdated = (event: any) => {
    const { id, after } = event.data;
    
    // 自动更新 participants 数组
    setParticipants(prev => {
      const updated = prev.map(p => p.id === id ? after : p);
      
      // 同步更新可编辑文本
      const newText = updated.map(p => p.name).join('; ');
      setEditableText(newText);
      
      // 触发 onChange 回调
      if (onChange) {
        const organizer = updated[0];
        const attendees = updated.slice(1);
        onChange(attendees, organizer);
      }
      
      return updated;
    });
  };

  const handleContactDeleted = (event: any) => {
    const { id } = event.data;
    
    // 从 participants 中移除
    setParticipants(prev => {
      const filtered = prev.filter(p => p.id !== id);
      
      // 同步更新文本和回调
      const newText = filtered.map(p => p.name).join('; ');
      setEditableText(newText);
      
      if (onChange) {
        const organizer = filtered[0];
        const attendees = filtered.slice(1);
        onChange(attendees, organizer);
      }
      
      return filtered;
    });
    
    // 如果打开的 Modal 是被删除的联系人，关闭 Modal
    if (fullContactModal.visible && fullContactModal.contact?.id === id) {
      setFullContactModal({ visible: false });
    }
  };

  ContactService.addEventListener('contact.updated', handleContactUpdated);
  ContactService.addEventListener('contact.deleted', handleContactDeleted);

  return () => {
    ContactService.removeEventListener('contact.updated', handleContactUpdated);
    ContactService.removeEventListener('contact.deleted', handleContactDeleted);
  };
}, [onChange, fullContactModal.visible, fullContactModal.contact?.id]);

// ContactPreviewCard.tsx - 事件订阅
useEffect(() => {
  if (!fullContact?.id) return;

  const handleContactUpdated = (event: any) => {
    const { id, after } = event.data;
    
    if (id === fullContact.id) {
      // 重新获取完整信息（包括关联事件）
      const identifier = after.email || after.name || '';
      const events = EventService.getEventsByContact(identifier, 5);
      const totalEvents = EventService.getEventsByContact(identifier, 9999).length;
      
      setFullContact({
        ...after,
        recentEvents: events,
        totalEvents,
      });
      
      onUpdate?.(after);
    }
  };

  const handleContactDeleted = (event: any) => {
    const { id } = event.data;
    
    if (id === fullContact.id) {
      setFullContact(null);
    }
  };

  ContactService.addEventListener('contact.updated', handleContactUpdated);
  ContactService.addEventListener('contact.deleted', handleContactDeleted);

  return () => {
    ContactService.removeEventListener('contact.updated', handleContactUpdated);
    ContactService.removeEventListener('contact.deleted', handleContactDeleted);
  };
}, [fullContact?.id, onUpdate]);

// FullContactModal.tsx - 事件订阅
useEffect(() => {
  if (!visible || !editedContact?.id) return;

  const handleContactUpdated = (event: any) => {
    const { id, after } = event.data;
    
    if (id === editedContact.id) {
      // 自动刷新显示
      const fullInfo = ContactService.getFullContactInfo(after);
      setEditedContact(fullInfo);
      
      const identifier = after.email || after.name || '';
      const events = EventService.getEventsByContact(identifier, 9999);
      setRelatedEvents(events);
      
      setHasChanges(false);
    }
  };

  const handleContactDeleted = (event: any) => {
    const { id } = event.data;
    
    if (id === editedContact.id) {
      onClose();
    }
  };

  ContactService.addEventListener('contact.updated', handleContactUpdated);
  ContactService.addEventListener('contact.deleted', handleContactDeleted);

  return () => {
    ContactService.removeEventListener('contact.updated', handleContactUpdated);
    ContactService.removeEventListener('contact.deleted', handleContactDeleted);
  };
}, [visible, editedContact?.id, onClose]);
```

**优化效果**:
- ❌ 之前：每次打开 Modal 都要手动 `getContactById()` 获取最新数据
- ✅ 之后：`participants` 数组通过事件订阅自动保持最新，直接使用即可

**验收标准**:
- ✅ 在任意组件编辑联系人 → 所有显示该联系人的组件自动刷新
- ✅ 删除联系人 → 自动从所有组件移除，打开的 Modal 自动关闭
- ✅ 预览卡片、完整 Modal、参会人列表数据完全一致
- ✅ 无需手动调用 `getContactById()`，依赖事件自动同步

### 4.5 Phase 4: 其他组件集成 (按需)

**目标**: 在其他需要联系人管理的地方使用新架构

**候选组件**:
- SharePanel（分享对象选择）
- EventCard（参会人显示）
- CollaboratorList（协作者管理）

**任务**:
1. 评估各组件的联系人使用场景
2. 替换为 ContactModal 组件
3. 订阅必要的事件
4. 测试数据一致性

---

### 4.6 Phase 关联事件功能（未来实现）🔮

**优先级**: P2（当前重构完成后再考虑）

**目标**: 实现联系人关联事件查询与展示

**前置条件**:
- ✅ Phase 1-3 完成（ContactService 基础架构建立）
- ✅ EventService 已稳定运行

**任务**:

#### 4.6.1 EventService 新增方法
```typescript
// 根据联系人查询关联事件
getEventsByContact(contactId: string, options?: {
  limit?: number;           // 限制返回数量（用于预览卡片）
  sort?: 'asc' | 'desc';    // 排序方式（默认 desc，最新的在前）
  includeCompleted?: boolean; // 是否包含已完成事件
}): Event[]

// 获取联系人的事件统计
getContactEventStats(contactId: string): {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  lastEventDate?: string;
}
```

#### 4.6.2 预览卡片增强
- 显示最近 5 个关联事件
- 事件显示：emoji + 标题 + 日期
- 点击事件 → 跳转到该事件（调用 EventService.openEvent）
- "查看全部 X 个关联事件" 按钮 → 打开完整 Modal

#### 4.6.3 完整 Modal 增强
- 显示所有关联事件（分页/虚拟滚动）
- 支持筛选（即将到来/已完成/全部）
- 支持排序（日期/标题）
- 点击事件卡片 → 跳转

**实现示例**:
```typescript
// EventService 中实现
getEventsByContact(contactId: string, options = {}): Event[] {
  const { limit, sort = 'desc', includeCompleted = true } = options;
  
  const allEvents = this.getAllEvents();
  
  // 筛选包含该联系人的事件
  let filteredEvents = allEvents.filter(event => {
    const hasInAttendees = event.attendees?.some(a => a.id === contactId);
    const isOrganizer = event.organizer?.id === contactId;
    return hasInAttendees || isOrganizer;
  });
  
  // 排除已完成事件（可选）
  if (!includeCompleted) {
    filteredEvents = filteredEvents.filter(e => !e.completed);
  }
  
  // 排序
  filteredEvents.sort((a, b) => {
    const timeA = new Date(a.startTime || a.createdAt).getTime();
    const timeB = new Date(b.startTime || b.createdAt).getTime();
    return sort === 'desc' ? timeB - timeA : timeA - timeB;
  });
  
  // 限制数量
  if (limit) {
    filteredEvents = filteredEvents.slice(0, limit);
  }
  
  return filteredEvents;
}
```

**UI 集成**（AttendeeDisplay 预览卡片）:
```tsx
// 预览卡片中添加关联事件
const [recentEvents, setRecentEvents] = useState<Event[]>([]);
const [totalEvents, setTotalEvents] = useState(0);

// 鼠标悬浮时加载关联事件
const handleHoverStart = async (person: Contact) => {
  // ... 现有预览卡片逻辑
  
  // 获取最近 5 个事件
  const events = EventService.getEventsByContact(person.id, { limit: 5 });
  const stats = EventService.getContactEventStats(person.id);
  
  setRecentEvents(events);
  setTotalEvents(stats.totalEvents);
};

// 预览卡片 UI
{recentEvents.length > 0 && (
  <div className="preview-events">
    <h5>关联事件（最近 5 个）</h5>
    {recentEvents.map(event => (
      <div 
        key={event.id} 
        className="event-item"
        onClick={() => EventService.openEvent(event.id)}
      >
        <span className="event-emoji">{extractEmoji(event.title)}</span>
        <span className="event-title">{removeEmoji(event.title)}</span>
        <span className="event-date">{formatDate(event.startTime)}</span>
      </div>
    ))}
    {totalEvents > 5 && (
      <button 
        className="view-more-btn"
        onClick={() => setFullContactModal({ visible: true, contact: person })}
      >
        查看全部 {totalEvents} 个关联事件
      </button>
    )}
  </div>
)}
```

**验收标准**:
- 预览卡片正确显示最近 5 个事件
- 点击事件能正确跳转
- 完整 Modal 能展示所有事件并支持交互
- 性能良好（查询 100+ 事件 < 100ms）

**说明**: 
> ⚠️ 此 Phase 暂不实施，等 ContactService 基础架构稳定后再进行。
> 当前重点：**Phase 1-3，建立事件驱动的 ContactService**

### 4.7 Phase 5: 性能优化与测试 (1-2天)

**目标**: 确保系统稳定性和性能

**任务**:
1. ✅ 防抖/节流搜索请求
2. ✅ 虚拟滚动大量联系人列表
3. ✅ 缓存联系人数据，减少重复读取
4. ✅ 编写集成测试
5. ✅ 性能测试（1000+ 联系人场景）

**性能指标**:
- 搜索响应时间 < 100ms
- Modal 打开时间 < 50ms
- 列表渲染 1000 条联系人 < 500ms

---

## 五、接口定义

### 5.1 类型定义

#### 5.1.1 扩展联系人类型

```typescript
// 基础联系人（存储在 localStorage）
interface Contact {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  organization?: string;
  isReMarkable?: boolean;
  isOutlook?: boolean;
  isGoogle?: boolean;
  isiCloud?: boolean;
  notes?: string;          // 备注，用于存储扩展字段
  createdAt?: string;
  updatedAt?: string;
}

// 扩展联系人（运行时使用）
interface ContactWithExtras extends Contact {
  position?: string;       // 职务（从 notes 解析）
  tags?: string[];         // 标签（从 notes 解析）
  recentEvents?: Event[];  // 关联的最近事件（运行时加载）
  totalEvents?: number;    // 关联事件总数
}
```

### 5.2 ContactService API

#### 5.2.1 事件管理

```typescript
// 添加事件监听器
ContactService.addEventListener('contact.updated', (event) => {
  console.log('联系人已更新:', event.data.after);
});

// 移除事件监听器
ContactService.removeEventListener('contact.updated', listener);
```

#### 5.2.2 数据操作

```typescript
// 获取所有联系人
const contacts = ContactService.getAllContacts();

// 批量获取（Phase 1.5 新增）
const contacts = ContactService.getContactsByIds(['id1', 'id2']);

// 根据 ID 获取
const contact = ContactService.getContactById('contact-123');

// 搜索联系人
const results = ContactService.searchContacts('张三');

// 创建联系人
const newContact = ContactService.createContact({
  name: '张三',
  email: 'zhangsan@example.com',
  source: 'remarkable'
});

// 更新联系人
ContactService.updateContact('contact-123', {
  phone: '13800138000'
});

// 删除联系人
ContactService.deleteContact('contact-123');
```

#### 5.2.3 多来源搜索（Phase 1.5 新增）

```typescript
// 搜索平台联系人
const platformContacts = ContactService.searchPlatformContacts('张三');

// 搜索本地联系人
const localContacts = ContactService.searchLocalContacts('张三');

// 合并多来源（去重 + 优先级排序）
const allContacts = ContactService.mergeContactSources([
  ...platformContacts,
  ...localContacts,
  ...historicalContacts
]);
```

#### 5.2.4 扩展字段操作（Phase 1.5 新增）

```typescript
// 保存带扩展字段的联系人
ContactService.updateContact('contact-123', {
  name: '张三',
  position: '产品经理',    // 自动序列化到 notes
  tags: ['重要客户', 'VIP']  // 自动序列化到 notes
});

// 读取时自动解析扩展字段
const contact = ContactService.getContactById('contact-123') as ContactWithExtras;
console.log(contact.position); // '产品经理'
console.log(contact.tags);     // ['重要客户', 'VIP']
```

### 5.3 ContactModal Props

```typescript
interface ContactModalProps {
  visible: boolean;                    // 是否显示
  contact?: Contact;                   // 联系人对象（edit/view 模式必填）
  mode: 'create' | 'edit' | 'view';    // 模式
  onClose: () => void;                 // 关闭回调
  triggerElement?: HTMLElement;        // 触发元素（用于定位）
  placement?: 'top' | 'bottom';        // 定位方向
  initialFocus?: 'name' | 'email' | 'phone' | 'organization'; // 初始聚焦字段
}
```

### 5.4 事件类型定义

```typescript
// contact.created
{
  type: 'contact.created',
  data: {
    contact: Contact
  },
  timestamp: '2025-11-18T10:00:00.000Z'
}

// contact.updated
{
  type: 'contact.updated',
  data: {
    id: string,
    before: Contact,
    after: Contact
  },
  timestamp: '2025-11-18T10:00:00.000Z'
}

// contact.deleted
{
  type: 'contact.deleted',
  data: {
    id: string,
    contact: Contact
  },
  timestamp: '2025-11-18T10:00:00.000Z'
}

// contacts.synced
{
  type: 'contacts.synced',
  data: {
    source: 'google' | 'outlook',
    contacts: Contact[],
    added: number,
    updated: number,
    deleted: number
  },
  timestamp: '2025-11-18T10:00:00.000Z'
}
```

---

## 六、数据链路

### 6.1 存储层

```
LocalStorage (当前实现)
├── remarkable_contacts          # ReMarkable 本地联系人
├── google_contacts_cache        # Google 联系人缓存
└── outlook_contacts_cache       # Outlook 联系人缓存
```

### 6.2 数据流向

```
创建联系人流程:
User Input → ContactModal → ContactService.createContact()
  → localStorage 写入
  → emitEvent('contact.created')
  → 所有订阅者收到通知

更新联系人流程:
User Edit → ContactModal → ContactService.updateContact()
  → localStorage 更新
  → emitEvent('contact.updated')
  → 所有订阅者自动刷新

同步流程:
User Trigger → ContactService.syncGoogleContacts()
  → Google API 请求
  → 合并到 localStorage
  → emitEvent('contacts.synced')
  → UI 自动刷新列表
```

### 6.3 数据一致性保证

1. **单一写入点**: 所有联系人修改必须通过 ContactService
2. **事务性操作**: 批量操作保证原子性
3. **版本控制**: `updatedAt` 时间戳防止冲突
4. **错误回滚**: 操作失败时恢复到之前状态

---

## 七、测试策略

### 7.1 单元测试

```typescript
describe('ContactService', () => {
  it('should emit event when contact is created', () => {
    const listener = jest.fn();
    ContactService.addEventListener('contact.created', listener);
    
    ContactService.createContact({ name: 'Test', email: 'test@example.com' });
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'contact.created',
        data: expect.objectContaining({
          contact: expect.objectContaining({ name: 'Test' })
        })
      })
    );
  });
  
  it('should update contact and emit event', () => {
    const listener = jest.fn();
    ContactService.addEventListener('contact.updated', listener);
    
    const contact = ContactService.createContact({ name: 'Old' });
    ContactService.updateContact(contact.id, { name: 'New' });
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          before: expect.objectContaining({ name: 'Old' }),
          after: expect.objectContaining({ name: 'New' })
        })
      })
    );
  });
});
```

### 7.2 集成测试

- AttendeeDisplay 订阅事件后能自动刷新
- ContactModal 保存后所有相关组件同步更新
- 删除联系人后所有引用自动清理

### 7.3 E2E 测试

- 完整的联系人编辑流程
- 跨组件数据一致性验证
- Google/Outlook 同步功能

---

## 八、风险与挑战

### 8.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 事件监听器泄漏 | 内存泄漏 | 严格的 cleanup 机制，useEffect 返回清理函数 |
| 循环事件触发 | 无限循环 | 事件去重，防止重复订阅 |
| 性能下降 | 大量联系人时卡顿 | 虚拟滚动，防抖搜索，事件批处理 |
| 数据不一致 | 显示错误信息 | 单一数据源，事务性操作 |

### 8.2 迁移风险

- 现有功能可能受影响
- 需要充分测试所有联系人相关场景
- 分阶段迁移，保持向后兼容

---

## 九、后续优化方向

### 9.1 短期（1-2个月）

1. **离线支持**: ServiceWorker 缓存联系人数据
2. **搜索优化**: Fuse.js 模糊搜索
3. **头像管理**: Gravatar + 自定义头像上传

### 9.2 中期（3-6个月）

1. **联系人分组**: 标签、组织、团队
2. **批量导入导出**: CSV / vCard 格式
3. **联系人合并**: 去重和智能合并

### 9.3 长期（6个月+）

1. **云端同步**: 多设备数据同步
2. **智能推荐**: 根据上下文推荐联系人
3. **联系人关系图**: 可视化人脉网络

---

## 十、参考资料

### 10.1 相关代码
- `src/services/ContactService.ts` - 现有联系人服务
- `src/services/EventService.ts` - 事件服务参考实现
- `src/components/common/AttendeeDisplay.tsx` - 当前实现

### 10.2 设计模式
- Observer Pattern（观察者模式）
- Event-Driven Architecture（事件驱动架构）
- Service Layer Pattern（服务层模式）

### 10.3 技术栈
- React 18
- TypeScript
- Tippy.js
- localStorage API

---

## 十一、变更日志

| 版本 | 日期 | 变更内容 | 负责人 |
|------|------|----------|--------|
| v1.0 | 2025-11-18 | 初始版本，定义重构方案 | System |

---

## 附录

### A. 当前问题清单

1. ✅ AttendeeDisplay 中 Modal 保存后不更新 - **Phase 3 解决**
2. ✅ 搜索框编辑联系人保存失败 - **Phase 3 解决**
3. ✅ ContactModal 逻辑嵌入业务组件 - **Phase 2 解决**
4. ✅ 缺乏事件机制导致数据不同步 - **Phase 1 解决**

### B. 成功案例参考

EventService 已实现完整的事件驱动架构：
- 事件增删改触发广播
- 组件订阅事件自动更新
- 数据一致性有保障

ContactService 将采用相同的设计模式。

---

**文档结束**
