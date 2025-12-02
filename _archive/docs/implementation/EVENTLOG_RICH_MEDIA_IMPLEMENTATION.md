# EventLog 富媒体支持实施方案

> **版本**: v1.0.0  
> **创建时间**: 2025-12-02  
> **优先级**: P1（刚需功能）  
> **预计工作量**: 3-4 天

---

## 📋 需求概述

### 用户场景

**场景1：旅行日记**
```
用户在旅行后：
1. 一次性上传 500 张照片 + 20 个视频
2. 系统自动按时间排序插入到 EventLog
3. 用户可以在图片之间添加文字说明
4. 点击"图册模式"快速浏览所有照片
5. 支持幻灯片播放
```

**场景2：会议记录**
```
用户在会议中：
1. 拍照白板内容，直接粘贴到编辑器
2. 图片内联显示，周围写文字笔记
3. 录音文件上传，内联播放器
4. 会后可以快速定位到某张白板照片
```

**场景3：项目文档**
```
用户整理项目资料：
1. 插入设计稿、原型图
2. 添加 PDF 文档
3. 图片可以调整大小、添加说明
4. 所有附件都在同一个 EventLog 中
```

---

## 🎯 核心功能

### 1. Slate 编辑器图片节点

#### 图片节点数据结构

```typescript
interface ImageElement extends BaseElement {
  type: 'image';
  attachmentId: string;    // 关联附件表的 ID
  url: string;             // file://本地路径 或 data:base64（未上传时）
  width?: number;          // 显示宽度（px 或 %）
  height?: number;         // 显示高度
  align?: 'left' | 'center' | 'right';
  caption?: string;        // 图片说明
  timestamp: string;       // 拍摄/上传时间
  metadata?: {
    originalWidth: number;
    originalHeight: number;
    fileSize: number;
    mimeType: string;
    exif?: ExifData;       // EXIF 信息（拍摄地点、相机型号等）
  };
  children: [{ text: '' }]; // Slate 要求
}
```

#### 支持的操作

- ✅ **拖拽上传**：直接拖拽图片到编辑器
- ✅ **粘贴上传**：Ctrl+V 粘贴剪贴板图片
- ✅ **点击上传**：工具栏按钮上传
- ✅ **调整大小**：拖拽图片边框调整
- ✅ **对齐方式**：左/中/右对齐
- ✅ **添加说明**：点击图片下方添加 caption
- ✅ **删除图片**：选中后按 Delete 键

---

### 2. 批量上传图册

#### 上传流程

```
┌─────────────────────────────────────────────┐
│ 1. 用户选择文件                              │
│    - 文件选择器（支持多选）                   │
│    - 拖拽文件夹到编辑器                       │
│    - 最多一次 10,000 张（约 50GB）           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 2. 文件预处理                                │
│    - 读取 EXIF 信息（拍摄时间、GPS）          │
│    - 按时间排序（优先用 EXIF，否则文件修改时间）│
│    - 生成缩略图（200x200）                    │
│    - 压缩大图（可选，>5MB 自动压缩）          │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 3. 并发上传（5个并发）                        │
│    - 显示进度条：已上传 150/500 (30%)        │
│    - 实时显示当前文件名                       │
│    - 支持暂停/恢复                            │
│    - 失败自动重试（最多3次）                  │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 4. 插入到 EventLog                           │
│    - 按时间顺序插入图片节点                   │
│    - 每 10 张图片换行                         │
│    - 自动生成时间标记                         │
└─────────────────────────────────────────────┘
```

#### 性能优化

```typescript
// 批量上传配置
const BATCH_UPLOAD_CONFIG = {
  // 并发数
  concurrentUploads: 5,
  
  // 缩略图尺寸
  thumbnailSize: 200,
  
  // 大图压缩阈值
  compressionThreshold: 5 * 1024 * 1024, // 5MB
  
  // 压缩质量
  compressionQuality: 0.8,
  
  // 自动重试
  maxRetries: 3,
  retryDelay: 1000, // 1秒
  
  // 分块上传（大文件）
  chunkSize: 5 * 1024 * 1024, // 5MB per chunk
};
```

---

### 3. 图册预览模式 (Gallery Mode)

#### 模式切换

```typescript
// EventLog 状态
interface EventLogViewState {
  mode: 'editor' | 'gallery';  // 编辑模式 / 图册模式
  galleryLayout: 'grid' | 'masonry' | 'timeline'; // 网格 / 瀑布流 / 时间线
  galleryColumns: 3 | 4 | 5 | 6; // 列数
  showTimestamp: boolean;       // 显示时间戳
  showCaption: boolean;         // 显示说明
}
```

#### 图册布局

**网格布局（Grid）**
```
┌────┐ ┌────┐ ┌────┐ ┌────┐
│    │ │    │ │    │ │    │
│Img1│ │Img2│ │Img3│ │Img4│
│    │ │    │ │    │ │    │
└────┘ └────┘ └────┘ └────┘
14:23  14:45  15:02  15:30

┌────┐ ┌────┐ ┌────┐ ┌────┐
│Img5│ │Img6│ │Img7│ │Img8│
└────┘ └────┘ └────┘ └────┘
```

**瀑布流布局（Masonry）**
```
┌────┐ ┌────┐ ┌────┐
│    │ │    │ │    │
│    │ │Img2│ │    │
│Img1│ └────┘ │Img3│
│    │ ┌────┐ │    │
│    │ │Img4│ │    │
└────┘ │    │ └────┘
       └────┘
```

**时间线布局（Timeline）**
```
14:23 ────────────────────────
      ┌────┐
      │Img1│ 故宫大门
      └────┘

14:45 ────────────────────────
      ┌────┐ ┌────┐
      │Img2│ │Img3│ 午门
      └────┘ └────┘

15:30 ────────────────────────
      ┌────┐
      │Img4│ 太和殿
      └────┘
```

#### 幻灯片播放

```typescript
interface SlideshowOptions {
  interval: number;       // 播放间隔（秒）
  loop: boolean;          // 循环播放
  showTimestamp: boolean; // 显示时间戳
  showCaption: boolean;   // 显示说明
  transition: 'fade' | 'slide' | 'zoom'; // 过渡效果
}
```

---

## 🏗️ 技术实现

### 1. Slate 插件架构

```typescript
// src/components/ModalSlate/plugins/withImages.ts
export const withImages = (editor: Editor) => {
  const { insertData, isVoid } = editor;
  
  // 图片节点是 void 节点（不可编辑内容）
  editor.isVoid = (element) => {
    return element.type === 'image' ? true : isVoid(element);
  };
  
  // 拦截粘贴/拖拽
  editor.insertData = (data: DataTransfer) => {
    const files = Array.from(data.files);
    const images = files.filter(file => file.type.startsWith('image/'));
    
    if (images.length > 0) {
      // 批量上传图片
      handleImageUpload(editor, images);
      return;
    }
    
    // HTML 粘贴（包含图片）
    const html = data.getData('text/html');
    if (html) {
      handleHTMLPaste(editor, html);
      return;
    }
    
    insertData(data);
  };
  
  return editor;
};
```

### 2. 图片组件

```typescript
// src/components/ModalSlate/elements/ImageElement.tsx
interface ImageElementProps {
  attributes: any;
  element: ImageElement;
  children: any;
}

export const ImageElement: React.FC<ImageElementProps> = ({
  attributes,
  element,
  children,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showCaption, setShowCaption] = useState(false);
  
  useEffect(() => {
    loadImage();
  }, [element.attachmentId]);
  
  const loadImage = async () => {
    try {
      // 从附件服务获取图片路径
      const path = await attachmentService.getAttachmentPath(element.attachmentId);
      setImageUrl(`file://${path}`);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load image:', error);
      setLoading(false);
    }
  };
  
  return (
    <div {...attributes} contentEditable={false} className="image-element">
      {children}
      
      {loading ? (
        <div className="image-loading">加载中...</div>
      ) : (
        <div className="image-container" style={{ textAlign: element.align }}>
          <img
            src={imageUrl}
            alt={element.caption || ''}
            style={{
              width: element.width || 'auto',
              height: element.height || 'auto',
              maxWidth: '100%',
            }}
          />
          
          {/* 时间戳 */}
          <div className="image-timestamp">
            {new Date(element.timestamp).toLocaleString('zh-CN')}
          </div>
          
          {/* 图片说明 */}
          {(showCaption || element.caption) && (
            <div className="image-caption">
              <input
                type="text"
                value={element.caption || ''}
                placeholder="添加图片说明..."
                onChange={(e) => updateCaption(e.target.value)}
              />
            </div>
          )}
          
          {/* 工具栏 */}
          <div className="image-toolbar">
            <button onClick={() => handleAlign('left')}>左对齐</button>
            <button onClick={() => handleAlign('center')}>居中</button>
            <button onClick={() => handleAlign('right')}>右对齐</button>
            <button onClick={() => setShowCaption(!showCaption)}>说明</button>
            <button onClick={handleDelete}>删除</button>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 3. 批量上传组件

```typescript
// src/components/ModalSlate/BatchImageUploader.tsx
export const BatchImageUploader: React.FC<{
  eventId: string;
  onComplete: (images: ImageElement[]) => void;
}> = ({ eventId, onComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentFile, setCurrentFile] = useState('');
  
  const handleUpload = async (files: File[]) => {
    setUploading(true);
    
    try {
      // 批量上传
      const result = await attachmentService.uploadMultiple(
        files,
        { eventId, generateThumbnail: true },
        (current, total, filename) => {
          setProgress({ current, total });
          setCurrentFile(filename);
        }
      );
      
      // 转换为 ImageElement
      const imageElements = result.succeeded.map(att => ({
        type: 'image' as const,
        attachmentId: att.id,
        url: `file://${att.localPath}`,
        timestamp: att.uploadedAt,
        metadata: {
          originalWidth: 0, // TODO: 从 EXIF 读取
          originalHeight: 0,
          fileSize: att.size,
          mimeType: att.mimeType,
        },
        children: [{ text: '' }],
      }));
      
      onComplete(imageElements);
      
    } catch (error) {
      console.error('Batch upload failed:', error);
      alert('批量上传失败');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="batch-uploader">
      <input
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={(e) => e.target.files && handleUpload(Array.from(e.target.files))}
        disabled={uploading}
      />
      
      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
          <div className="progress-text">
            正在上传: {currentFile} ({progress.current}/{progress.total})
          </div>
        </div>
      )}
    </div>
  );
};
```

### 4. 图册预览组件

```typescript
// src/components/EventLog/GalleryView.tsx
export const GalleryView: React.FC<{
  images: ImageElement[];
  layout: 'grid' | 'masonry' | 'timeline';
  columns: number;
}> = ({ images, layout, columns }) => {
  const [selectedImage, setSelectedImage] = useState<ImageElement | null>(null);
  const [slideshowActive, setSlideshowActive] = useState(false);
  
  // 按时间排序
  const sortedImages = useMemo(() => {
    return [...images].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [images]);
  
  return (
    <div className="gallery-view">
      {/* 工具栏 */}
      <div className="gallery-toolbar">
        <button onClick={() => setSlideshowActive(true)}>
          ▶️ 幻灯片播放
        </button>
        <select onChange={(e) => setLayout(e.target.value)}>
          <option value="grid">网格</option>
          <option value="masonry">瀑布流</option>
          <option value="timeline">时间线</option>
        </select>
      </div>
      
      {/* 图册网格 */}
      {layout === 'grid' && (
        <div 
          className="gallery-grid" 
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {sortedImages.map((img) => (
            <div key={img.attachmentId} className="gallery-item">
              <img 
                src={img.url} 
                alt={img.caption || ''}
                onClick={() => setSelectedImage(img)}
              />
              <div className="gallery-item-time">
                {formatTime(img.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* 大图预览 */}
      {selectedImage && (
        <ImageLightbox
          image={selectedImage}
          images={sortedImages}
          onClose={() => setSelectedImage(null)}
        />
      )}
      
      {/* 幻灯片 */}
      {slideshowActive && (
        <Slideshow
          images={sortedImages}
          onClose={() => setSlideshowActive(false)}
        />
      )}
    </div>
  );
};
```

---

## 📦 数据存储

### Attachment 表（已存在）

```sql
CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    local_path TEXT NOT NULL,
    thumbnail_path TEXT,        -- 缩略图路径
    preview_text TEXT,          -- OCR 提取的文本
    
    -- 图片元数据
    original_width INTEGER,
    original_height INTEGER,
    
    -- EXIF 信息（JSON）
    exif_data TEXT,             -- GPS、相机型号、ISO 等
    
    status TEXT DEFAULT 'local-only',
    uploaded_at TEXT NOT NULL,
    deleted_at TEXT,
    
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_event ON attachments(event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_type ON attachments(mime_type) WHERE deleted_at IS NULL;
```

### EventLog Slate JSON 结构

```json
[
  {
    "type": "paragraph",
    "children": [{ "text": "今天去了故宫，天气很好 ☀️" }]
  },
  {
    "type": "image",
    "attachmentId": "attachment-123",
    "url": "file:///C:/Users/.../attachments/images/2025/12/palace.jpg",
    "width": "100%",
    "align": "center",
    "caption": "故宫大门",
    "timestamp": "2025-12-02 14:23:00",
    "metadata": {
      "originalWidth": 4032,
      "originalHeight": 3024,
      "fileSize": 5242880,
      "mimeType": "image/jpeg"
    },
    "children": [{ "text": "" }]
  },
  {
    "type": "paragraph",
    "children": [{ "text": "人很多，但景色确实震撼..." }]
  }
]
```

---

## 🚀 实施步骤

### Day 1: Slate 图片节点基础

- [ ] 创建 `withImages` 插件
- [ ] 实现 `ImageElement` 组件
- [ ] 支持粘贴图片（单张）
- [ ] 支持删除图片
- [ ] 基础样式

### Day 2: 批量上传

- [ ] 实现并发上传逻辑
- [ ] 进度条显示
- [ ] 读取 EXIF 信息
- [ ] 生成缩略图
- [ ] 错误处理和重试

### Day 3: 图册预览模式

- [ ] 模式切换按钮
- [ ] 网格布局实现
- [ ] 瀑布流布局
- [ ] 时间线布局
- [ ] 图片大图预览

### Day 4: 高级功能

- [ ] 幻灯片播放
- [ ] 图片调整大小
- [ ] 对齐方式
- [ ] 图片说明编辑
- [ ] 批量选择/删除

---

## 🎯 性能目标

| 操作 | 目标 | 备注 |
|------|------|------|
| 单张图片上传 | <2s | 5MB 图片 |
| 批量上传 (100张) | <30s | 5个并发 |
| 批量上传 (1000张) | <5min | 总大小 ~5GB |
| 图册加载 (1000张) | <1s | 懒加载 + 缩略图 |
| 切换图册模式 | <300ms | |
| 幻灯片切换 | 60fps | |

---

## 📝 后续优化

### Phase 2: 视频/音频支持

- [ ] 视频内联播放器
- [ ] 音频波形图
- [ ] 视频缩略图生成
- [ ] 视频转码（压缩）

### Phase 3: 高级编辑

- [ ] 图片裁剪/旋转
- [ ] 滤镜/调色
- [ ] 图片标注（箭头、文字）
- [ ] 图片拼接

### Phase 4: 智能功能

- [ ] OCR 文本提取（图片搜索）
- [ ] 人脸识别（自动分组）
- [ ] 场景识别（自动标签）
- [ ] 相似图片检测

---

**维护人**: Copilot + Zoey  
**最后更新**: 2025-12-02
