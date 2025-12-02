# 📎 Attachment System PRD

**版本**: v1.0  
**创建日期**: 2025-12-02  
**维护者**: GitHub Copilot  
**状态**: ✅ 生产就绪

---

## 📊 模块概述

Attachment System 为 ReMarkable 提供完整的附件管理能力，支持图片、视频、音频、文档、语音转录、子事件链接和网页剪藏等多种类型。

### 核心能力

- 📤 **文件上传**: 本地文件上传、URL 导入、拖拽上传
- 💾 **存储管理**: IndexedDB + SQLite 双写，云端同步
- 🎨 **多视图模式**: 图册、视频流、音频流、文档库、树形导航等
- 🎤 **语音转录**: AI 驱动的语音识别和摘要
- 🔗 **事件链接**: 子事件关联和双向链接
- 🔖 **网页剪藏**: Web Clip 保存和预览
- 🗑️ **软删除**: 回收站和恢复功能

---

## 🏗️ 数据结构

### Attachment 接口

```typescript
export interface Attachment {
  id: string;                    // 附件唯一 ID
  event_id: string;              // 所属事件 ID
  filename: string;              // 文件名
  file_size: number;             // 文件大小（字节）
  mime_type: string;             // MIME 类型
  
  // 存储路径
  local_path?: string;           // 本地文件路径
  cloud_url?: string;            // 云端 URL
  status: AttachmentStatus;      // 状态（local-only, syncing, synced）
  
  // 预览和缩略图
  thumbnail_path?: string;       // 缩略图路径
  thumbnail_url?: string;        // 缩略图 URL
  
  // 附件类型
  type: AttachmentType;          // 类型标记（IMAGE, VIDEO, AUDIO等）
  
  // 元数据
  metadata?: {
    width?: number;              // 图片/视频宽度
    height?: number;             // 图片/视频高度
    duration?: number;           // 视频/音频时长（秒）
    codec?: string;              // 编解码器
    bitrate?: number;            // 比特率
    title?: string;              // 网页标题（Web Clip）
    url?: string;                // 原始 URL（Web Clip）
    description?: string;        // 描述文本
  };
  
  // 语音转录（VOICE_RECORDING 类型）
  transcript?: {
    text: string;                // 转录文本
    summary: string;             // AI 摘要
    confidence: number;          // 识别置信度
    language: string;            // 语言
    timestamp: string;           // 转录时间
  };
  
  // 子事件链接（SUB_EVENT 类型）
  linked_event_id?: string;      // 链接的事件 ID
  
  // OCR 文本提取
  ocr_text?: string;             // 图片/PDF OCR 结果
  
  // 时间戳
  created_at: string;
  updated_at: string;
  deleted_at?: string;           // 软删除
}
```

### AttachmentType 枚举

```typescript
enum AttachmentType {
  IMAGE = 'image',                    // 🖼️ 图片
  VIDEO = 'video',                    // 🎥 视频
  AUDIO = 'audio',                    // 🎵 音频
  DOCUMENT = 'document',              // 📄 文档（PDF, Word, Excel等）
  VOICE_RECORDING = 'voice_recording',// 🎤 语音录制（带转录）
  SUB_EVENT = 'sub_event',           // 🔗 子事件链接
  WEB_CLIP = 'web_clip',             // 🔖 网页剪藏
  OTHER = 'other'                    // 其他文件
}
```

### AttachmentStatus 枚举

```typescript
enum AttachmentStatus {
  LOCAL_ONLY = 'local-only',    // 仅本地存储
  SYNCING = 'syncing',          // 正在同步到云端
  SYNCED = 'synced',            // 已同步到云端
  SYNC_FAILED = 'sync-failed'   // 同步失败
}
```

---

## 🔧 核心组件

### 1. AttachmentService

**文件**: `src/services/AttachmentService.ts`

**核心方法**:

```typescript
class AttachmentService {
  // 上传附件
  static async uploadAttachment(
    eventId: string,
    file: File | string,  // File 对象或 URL
    type: AttachmentType,
    metadata?: Record<string, any>
  ): Promise<Attachment>
  
  // 获取事件的所有附件
  static async getAttachments(eventId: string): Promise<Attachment[]>
  
  // 获取单个附件
  static async getAttachment(attachmentId: string): Promise<Attachment | null>
  
  // 更新附件元数据
  static async updateAttachment(
    attachmentId: string,
    updates: Partial<Attachment>
  ): Promise<Attachment>
  
  // 删除附件（软删除）
  static async deleteAttachment(
    attachmentId: string,
    permanent?: boolean
  ): Promise<void>
  
  // 恢复已删除的附件
  static async restoreAttachment(attachmentId: string): Promise<Attachment>
  
  // 生成缩略图
  static async generateThumbnail(
    attachmentId: string
  ): Promise<string>
  
  // 语音转录
  static async transcribeAudio(
    attachmentId: string
  ): Promise<{ text: string; summary: string }>
  
  // OCR 文本提取
  static async extractTextOCR(
    attachmentId: string
  ): Promise<string>
}
```

---

### 2. AttachmentViewContainer

**文件**: `src/components/AttachmentViewContainer.tsx`

**功能**: 集成所有查看模式的主容器

**Props**:
```typescript
interface AttachmentViewContainerProps {
  eventId: string;                           // 事件 ID
  attachments: Attachment[];                 // 附件列表
  initialMode?: AttachmentViewMode;          // 初始查看模式
  onAttachmentClick?: (att: Attachment, idx: number) => void;
  onAttachmentDelete?: (id: string) => Promise<void>;
  onTranscriptUpdate?: (id: string, summary: string) => Promise<void>;
  onNavigate?: (eventId: string) => void;    // 导航到其他事件
}
```

**示例**:
```tsx
<AttachmentViewContainer
  eventId="event_abc123"
  attachments={event.eventlog.attachments}
  initialMode={AttachmentViewMode.GALLERY}
  onAttachmentDelete={async (id) => {
    await AttachmentService.deleteAttachment(id);
  }}
/>
```

---

### 3. AttachmentUploader

**文件**: `src/components/AttachmentUploader.tsx`

**功能**: 文件上传组件，支持拖拽、粘贴、文件选择

**Props**:
```typescript
interface AttachmentUploaderProps {
  eventId: string;
  onUploadComplete?: (attachment: Attachment) => void;
  onUploadError?: (error: Error) => void;
  acceptTypes?: string[];  // ['image/*', 'video/*', 'application/pdf']
  maxSize?: number;        // 最大文件大小（字节）
  multiple?: boolean;      // 是否支持多文件上传
}
```

**示例**:
```tsx
<AttachmentUploader
  eventId="event_abc123"
  acceptTypes={['image/*', 'video/*']}
  maxSize={50 * 1024 * 1024}  // 50MB
  multiple={true}
  onUploadComplete={(att) => console.log('上传完成:', att)}
/>
```

---

### 4. 查看模式组件

| 组件 | 文件 | 支持类型 | 功能 |
|-----|------|---------|------|
| **GalleryView** | `GalleryView.tsx` | 🖼️ IMAGE | 图片画廊，支持缩略图网格、全屏查看、左右切换 |
| **VideoStreamView** | `VideoStreamView.tsx` | 🎥 VIDEO | 视频播放器，支持播放列表、进度条、字幕 |
| **AudioStreamView** | `AudioStreamView.tsx` | 🎵 AUDIO | 音频播放器，支持播放列表、波形图、音量控制 |
| **TranscriptView** | `TranscriptView.tsx` | 🎤 VOICE_RECORDING | 转录文本查看器，支持编辑摘要、导出文本 |
| **DocumentLibView** | `DocumentLibView.tsx` | 📄 DOCUMENT | 文档库，支持 PDF 预览、搜索、标注 |
| **TreeNavigationView** | `TreeNavigationView.tsx` | 🔗 SUB_EVENT | 树形导航，显示子事件层级结构 |
| **BookmarkView** | `BookmarkView.tsx` | 🔖 WEB_CLIP | 网页剪藏查看器，显示网页快照和元数据 |

---

## 🎨 查看模式（AttachmentViewMode）

```typescript
enum AttachmentViewMode {
  EDITOR = 'editor',           // ✏️ 编辑器（默认，Slate）
  GALLERY = 'gallery',         // 🖼️ 图册模式
  VIDEO_STREAM = 'video-stream', // 🎥 视频流
  AUDIO_STREAM = 'audio-stream', // 🎵 音频流
  TRANSCRIPT = 'transcript',   // 🎤 转录文本
  DOCUMENT_LIB = 'document-lib', // 📄 文档库
  TREE_NAV = 'tree-nav',       // 🌳 树形导航
  BOOKMARK = 'bookmark',       // 🔖 书签
}
```

### 自动模式选择逻辑

```typescript
function getInitialMode(attachments: Attachment[]): AttachmentViewMode {
  const types = attachments.map(a => a.type);
  
  if (types.includes(AttachmentType.IMAGE)) 
    return AttachmentViewMode.GALLERY;
    
  if (types.includes(AttachmentType.VIDEO)) 
    return AttachmentViewMode.VIDEO_STREAM;
    
  if (types.includes(AttachmentType.AUDIO)) 
    return AttachmentViewMode.AUDIO_STREAM;
    
  if (types.includes(AttachmentType.VOICE_RECORDING)) 
    return AttachmentViewMode.TRANSCRIPT;
    
  if (types.includes(AttachmentType.SUB_EVENT)) 
    return AttachmentViewMode.TREE_NAV;
    
  if (types.includes(AttachmentType.WEB_CLIP)) 
    return AttachmentViewMode.BOOKMARK;
  
  return AttachmentViewMode.EDITOR;  // 默认
}
```

---

## 💾 数据库设计

### SQLite 表结构

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  local_path TEXT,
  cloud_url TEXT,
  status TEXT DEFAULT 'local-only',
  thumbnail_path TEXT,
  ocr_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_event 
  ON attachments(event_id) WHERE deleted_at IS NULL;
```

### IndexedDB 结构

```typescript
// ObjectStore: attachments
{
  keyPath: 'id',
  indexes: [
    { name: 'event_id', keyPath: 'event_id' },
    { name: 'type', keyPath: 'type' },
    { name: 'status', keyPath: 'status' },
    { name: 'created_at', keyPath: 'created_at' }
  ]
}
```

---

## 🔄 文件存储策略

### 本地存储（Electron）

```typescript
// 文件路径
const attachmentPath = path.join(
  app.getPath('userData'),
  'attachments',
  eventId,
  attachmentId,
  filename
);

// 缩略图路径
const thumbnailPath = path.join(
  app.getPath('userData'),
  'thumbnails',
  `${attachmentId}_thumb.jpg`
);
```

### 云端同步（未来）

```typescript
// Azure Blob Storage
const cloudUrl = `https://${storageAccount}.blob.core.windows.net/${container}/${eventId}/${attachmentId}/${filename}`;

// 同步状态
attachment.status = AttachmentStatus.SYNCING;
await uploadToCloud(localPath, cloudUrl);
attachment.status = AttachmentStatus.SYNCED;
attachment.cloud_url = cloudUrl;
```

---

## 🎤 语音转录流程

### 1. 录音上传

```typescript
const voiceAttachment = await AttachmentService.uploadAttachment(
  eventId,
  audioFile,
  AttachmentType.VOICE_RECORDING
);
```

### 2. 自动转录

```typescript
// 调用 AI Service 进行转录
const { text, summary } = await AttachmentService.transcribeAudio(
  voiceAttachment.id
);

// 更新附件
await AttachmentService.updateAttachment(voiceAttachment.id, {
  transcript: {
    text: text,
    summary: summary,
    confidence: 0.95,
    language: 'zh-CN',
    timestamp: new Date().toISOString()
  }
});
```

### 3. 查看和编辑

```tsx
<TranscriptView
  attachments={voiceAttachments}
  onTranscriptUpdate={async (id, newSummary) => {
    await AttachmentService.updateAttachment(id, {
      transcript: {
        ...existingTranscript,
        summary: newSummary
      }
    });
  }}
/>
```

---

## 🔗 子事件链接

### 创建子事件链接

```typescript
// 在 EventLog 中使用 @mention 语法
// 或通过 API 创建
const subEventLink = await AttachmentService.uploadAttachment(
  parentEventId,
  '',  // 空文件
  AttachmentType.SUB_EVENT,
  { linked_event_id: childEventId }
);
```

### TreeNavigationView 显示

```tsx
<TreeNavigationView
  attachments={subEventLinks}
  onNavigate={(eventId) => {
    // 跳转到子事件
    window.location.href = `/event/${eventId}`;
  }}
/>
```

---

## 📈 性能优化

### 1. 懒加载

```typescript
// 仅加载视口内的附件
const visibleAttachments = attachments.slice(
  startIndex,
  endIndex
);
```

### 2. 缩略图生成

```typescript
// 自动生成缩略图（图片/视频）
if (attachment.type === AttachmentType.IMAGE || 
    attachment.type === AttachmentType.VIDEO) {
  const thumbnailPath = await AttachmentService.generateThumbnail(
    attachment.id
  );
  
  await AttachmentService.updateAttachment(attachment.id, {
    thumbnail_path: thumbnailPath
  });
}
```

### 3. 增量同步

```typescript
// 仅同步新增/修改的附件
const unsyncedAttachments = attachments.filter(
  a => a.status === AttachmentStatus.LOCAL_ONLY
);

for (const att of unsyncedAttachments) {
  await syncToCloud(att);
}
```

---

## 🧪 测试覆盖

### 单元测试

```typescript
describe('AttachmentService', () => {
  test('上传图片附件', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const attachment = await AttachmentService.uploadAttachment(
      'event_123',
      file,
      AttachmentType.IMAGE
    );
    
    expect(attachment.filename).toBe('test.jpg');
    expect(attachment.type).toBe(AttachmentType.IMAGE);
  });
  
  test('语音转录', async () => {
    const voiceFile = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const attachment = await AttachmentService.uploadAttachment(
      'event_123',
      voiceFile,
      AttachmentType.VOICE_RECORDING
    );
    
    const { text, summary } = await AttachmentService.transcribeAudio(
      attachment.id
    );
    
    expect(text).toBeTruthy();
    expect(summary).toBeTruthy();
  });
});
```

---

## 🚀 版本历史

### v1.0 (2025-12-02)
- ✅ 基础附件上传和存储
- ✅ 7种查看模式
- ✅ 语音转录功能
- ✅ 子事件链接
- ✅ 软删除支持

### v1.1 (计划中)
- ⏳ 云端同步（Azure Blob）
- ⏳ OCR 文本提取
- ⏳ 文档在线预览（PDF.js）
- ⏳ 视频转码和压缩

---

## 📚 相关文档

- [EventLog Rich Media Implementation](../docs/EVENTLOG_RICH_MEDIA_IMPLEMENTATION.md)
- [Attachment System Integration](../docs/ATTACHMENT_SYSTEM_INTEGRATION.md)
- [Storage Architecture](../docs/architecture/STORAGE_ARCHITECTURE.md)

---

**文档维护**: 每次功能增强或架构调整时更新本文档  
**最后更新**: 2025-12-02
