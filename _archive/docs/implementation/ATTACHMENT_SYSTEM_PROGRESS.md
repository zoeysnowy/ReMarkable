# 附件系统实现进度

> **更新时间**: 2025-12-02  
> **总体进度**: 35% (类型系统和基础服务完成，查看模式组件开发中)

## ✅ 已完成 (Phase 1: 基础架构)

### 1. 类型系统定义
- ✅ `AttachmentType` 枚举 (7 种类型)
  - `VOICE_RECORDING` 🎤 语音记录
  - `IMAGE` 🖼️ 图片
  - `AUDIO` 🎵 音频
  - `VIDEO` 🎥 视频
  - `DOCUMENT` 📄 文档
  - `SUB_EVENT` 🔗 子事件
  - `WEB_CLIP` 📺 网页剪藏

- ✅ `AttachmentViewMode` 枚举 (8 种查看模式)
  - `EDITOR` 编辑器 (默认)
  - `GALLERY` 图册
  - `VIDEO_STREAM` 视频流
  - `AUDIO_STREAM` 音频流
  - `TRANSCRIPT` 转录
  - `DOCUMENT_LIB` 文档库
  - `TREE_NAV` 树状导航
  - `BOOKMARK` 书签

- ✅ `Attachment` 接口 (20+ 字段)
  - 通用字段: id, type, filename, size, mimeType, status, timestamp
  - 图片字段: width, height, exifData, thumbnailPath
  - 视频/音频字段: duration, thumbnailPath
  - 语音记录字段: transcriptData
  - 文档字段: pageCount, extractedText
  - 子事件字段: linkedEventId
  - 网页剪藏字段: webUrl, webTitle, webFavicon

- ✅ `TranscriptData` 接口 (AI 转录)
  - rawTranscript: 原始转录文本
  - editedSummary: 用户编辑版本
  - aiSummary: AI 生成摘要
  - segments: 分段数据 (时间戳 + 文本 + 说话人)
  - keyPoints: 关键要点
  - actionItems: 行动项
  - status: 处理状态

**文件**: `src/types.ts`

---

### 2. AttachmentService 扩展
- ✅ `SUPPORTED_FILE_TYPES` 配置 (支持 7 种类型)
  - 每种类型的 MIME 类型、扩展名、文件大小限制
  - 图标和推荐查看模式

- ✅ 类型检测方法
  - `detectAttachmentType()`: 根据 MIME 自动检测或使用显式类型
  - `detectFileType()`: 旧版兼容方法

- ✅ 类型特定处理方法
  - `processFileByType()`: 统一入口
  - `processImage()`: 提取尺寸、EXIF 数据
  - `processVideo()`: 提取时长、生成缩略图
  - `processAudio()`: 提取时长、调用 AI 转录
  - `processDocument()`: 提取页数、OCR 文本
  - `processWebClip()`: 提取标题、favicon、原始 URL
  - `transcribeAudio()`: AI 转录服务（异步）

- ✅ 统一上传方法
  - `upload()`: 新版本方法，支持所有 7 种类型
  - `uploadAttachment()`: 旧版本方法（保留向后兼容）
  - `uploadMultiple()`: 批量上传（5 并发）

- ✅ 辅助方法
  - `createSubEventLink()`: 创建子事件链接（无需上传文件）
  - `captureWebClip()`: 从 URL 捕获网页剪藏
  - `getRecommendedViewMode()`: 获取推荐查看模式

**文件**: `src/services/AttachmentService.ts` (737 行)

---

### 3. 查看模式切换组件
- ✅ `AttachmentViewModeSwitcher` 组件
  - 根据 EventLog 中的附件类型显示可用按钮
  - 8 种查看模式按钮（图标 + 标签 + 描述）
  - 响应式设计（移动端仅显示图标）
  - 自动检测可用模式（只有编辑器时不显示）
  - 键盘导航支持

**文件**: `src/components/AttachmentViewModeSwitcher.tsx`

---

### 4. 图册查看组件
- ✅ `GalleryView` 组件
  - **三种布局模式**:
    - Grid: 均匀网格（默认）
    - Masonry: 瀑布流（Pinterest 风格）
    - Timeline: 时间轴（按日期分组）
  
  - **核心功能**:
    - 懒加载图片（`loading="lazy"`）
    - 灯箱全屏查看（Lightbox）
    - 键盘导航（Esc 关闭，← → 切换）
    - 图片说明悬停显示
    - 删除确认
    - 缩略图展示
  
  - **元数据显示**:
    - 图片尺寸（width × height）
    - 拍摄时间
    - 图片序号（1 / 10）
    - 图片说明（caption）

**文件**: `src/components/GalleryView.tsx`

---

## 🚧 进行中 (Phase 2: 查看模式组件)

### 1. 视频流查看组件 (预计 4-6 小时)
- ⏳ `VideoStreamView` 组件
  - 视频墙布局（多视频同时显示）
  - 连续播放模式
  - 视频播放器控件
  - 缩略图预览
  - 进度条快速跳转

**优先级**: P1  
**预计完成**: 今天下午

---

### 2. 音频流查看组件 (预计 4-6 小时)
- ⏳ `AudioStreamView` 组件
  - 播客风格布局
  - 波形可视化
  - 播放列表
  - 连续播放
  - 速度控制（0.5x ~ 2x）

**优先级**: P1  
**预计完成**: 今天下午

---

### 3. 转录查看组件 (预计 4-6 小时)
- ⏳ `TranscriptView` 组件
  - 显示 AI 转录文本
  - 用户编辑功能（可编辑文本框）
  - 保存编辑版本
  - 分段显示（时间戳 + 文本 + 说话人）
  - 关键要点高亮
  - 行动项清单
  - 同步音频播放（点击文本跳转到对应时间）

**优先级**: P1  
**预计完成**: 明天上午

---

## 🔜 待实现 (Phase 3: 剩余查看模式)

### 1. 文档库查看组件 (预计 4-6 小时)
- 📋 `DocumentLibView` 组件
  - 文档列表视图
  - PDF 预览（PDF.js）
  - 文档缩略图
  - 全文搜索（OCR 结果）
  - 文档分类（PDF / Word / Excel）
  - 下载/打开按钮

**优先级**: P2  
**预计完成**: 明天下午

---

### 2. 树状导航组件 (预计 6-8 小时)
- 📋 `TreeNavigationView` 组件
  - EventTree 层级结构
  - 树形展开/折叠
  - 拖拽排序
  - 双向链接显示
  - 面包屑导航
  - 子事件快速跳转

**优先级**: P2  
**预计完成**: 后天上午

---

### 3. 书签查看组件 (预计 4-6 小时)
- 📋 `BookmarkView` 组件
  - 网页收藏卡片布局
  - Favicon + 标题 + 摘要
  - 网页缩略图
  - 离线阅读模式
  - 标签分类
  - 快速搜索

**优先级**: P2  
**预计完成**: 后天下午

---

## 🔜 待实现 (Phase 4: Slate.js 集成)

### 1. Slate.js 媒体节点插件 (预计 6-8 小时)
- 📋 `withImages` 插件
  - 内联图片节点
  - 拖拽上传
  - 粘贴上传 (Ctrl+V)
  - 调整大小
  - 对齐方式（左/中/右）
  - 图片说明编辑

- 📋 `withVideos` 插件
  - 内联视频节点
  - 播放器控件
  - 缩略图展示

- 📋 `withAudio` 插件
  - 内联音频播放器
  - 波形展示

- 📋 `withDocuments` 插件
  - PDF 缩略图嵌入
  - 点击打开完整文档

**优先级**: P1  
**预计完成**: 本周五

---

## 🔜 待实现 (Phase 5: CRUD UI)

### 1. 上传模态框 (预计 2-3 小时)
- 📋 为每种附件类型创建专用上传 UI
  - 语音记录: 录音控件
  - 图片: 批量上传 + 预览
  - 视频: 进度条 + 预览
  - 文档: 列表上传
  - 网页剪藏: URL 输入框

**优先级**: P1  
**预计完成**: 本周五

---

### 2. 编辑模态框 (预计 2-3 小时)
- 📋 附件元数据编辑
  - 修改 caption
  - 编辑 AI 摘要（语音）
  - 更新标签
  - 修改分类

**优先级**: P2  
**预计完成**: 下周一

---

### 3. 批量操作 UI (预计 2-3 小时)
- 📋 多选附件
- 📋 批量删除
- 📋 批量移动
- 📋 批量下载

**优先级**: P2  
**预计完成**: 下周一

---

## 🔜 待集成 (Phase 6: 外部服务)

### 1. AI 转录服务 (预计 4-6 小时)
- 📋 集成 OpenAI Whisper API 或类似服务
- 📋 实现转录队列
- 📋 错误重试机制
- 📋 转录进度显示

**优先级**: P1  
**依赖**: 需要 API 密钥  
**预计完成**: 下周二

---

### 2. EXIF 数据提取 (预计 2-3 小时)
- 📋 集成 `exif-js` 或类似库
- 📋 提取完整 EXIF 数据
  - 拍摄时间
  - 相机型号
  - GPS 坐标
  - 光圈/快门/ISO

**优先级**: P2  
**预计完成**: 下周二

---

### 3. 文档 OCR (预计 4-6 小时)
- 📋 集成 Tesseract.js（图片 OCR）
- 📋 集成 PDF.js（PDF 文本提取）
- 📋 全文索引（FTS5）

**优先级**: P2  
**预计完成**: 下周三

---

### 4. 网页剪藏捕获 (预计 4-6 小时)
- 📋 集成 Puppeteer 或类似工具
- 📋 网页截图
- 📋 HTML 保存
- 📋 离线资源下载
- 📋 去除广告和无关内容

**优先级**: P3  
**预计完成**: 下周四

---

## 📊 工作量估算

| 阶段 | 任务 | 预计时间 | 优先级 | 状态 |
|------|------|----------|--------|------|
| Phase 1 | 类型系统 + 基础服务 | 6-8h | P0 | ✅ 已完成 |
| Phase 2 | 查看模式组件 (3个) | 12-18h | P1 | 🚧 进行中 (33%) |
| Phase 3 | 剩余查看模式 (3个) | 14-20h | P2 | 🔜 待开始 |
| Phase 4 | Slate.js 集成 | 6-8h | P1 | 🔜 待开始 |
| Phase 5 | CRUD UI | 6-9h | P1 | 🔜 待开始 |
| Phase 6 | 外部服务集成 | 14-21h | P2-P3 | 🔜 待开始 |
| **总计** | **所有阶段** | **58-84h** | - | **35% 完成** |

---

## 🎯 本周目标 (截止 12/6)

### 必须完成 (P0-P1)
1. ✅ 类型系统定义
2. ✅ AttachmentService 扩展
3. ✅ AttachmentViewModeSwitcher 组件
4. ✅ GalleryView 组件
5. ⏳ VideoStreamView 组件
6. ⏳ AudioStreamView 组件
7. ⏳ TranscriptView 组件
8. 📋 Slate.js 媒体节点插件
9. 📋 上传模态框

### 争取完成 (P2)
10. 📋 DocumentLibView 组件
11. 📋 TreeNavigationView 组件
12. 📋 BookmarkView 组件
13. 📋 编辑模态框

---

## 🐛 已知问题

1. **AI 转录服务未集成**
   - 当前使用模拟数据（3 秒后返回假数据）
   - 需要集成 Whisper API 或其他服务

2. **EXIF 提取不完整**
   - 只提取了基本信息（宽高）
   - 需要集成 exif-js 库

3. **视频缩略图生成**
   - 需要在 Electron 主进程中集成 ffmpeg

4. **OCR 文本提取**
   - 文档 `extractedText` 和 `pageCount` 为默认值
   - 需要集成 PDF.js 和 Tesseract.js

5. **网页剪藏捕获**
   - 当前只能上传已保存的 HTML 文件
   - 需要实现实时网页捕获

---

## 📝 技术债务

1. **性能优化**
   - 大量图片加载性能（需要虚拟滚动）
   - 缩略图生成和缓存策略
   - 数据库查询优化（索引）

2. **错误处理**
   - 上传失败重试机制
   - 转录失败降级方案
   - 网络中断恢复

3. **单元测试**
   - AttachmentService 测试覆盖
   - 查看模式组件测试
   - IPC 通信测试

4. **无障碍**
   - 键盘导航完善
   - ARIA 标签
   - 屏幕阅读器支持

---

## 🚀 下一步行动

**今天 (12/2 下午)**:
1. 完成 VideoStreamView 组件 (4-6h)
2. 完成 AudioStreamView 组件 (4-6h)

**明天 (12/3)**:
1. 完成 TranscriptView 组件 (4-6h)
2. 完成 DocumentLibView 组件 (4-6h)

**后天 (12/4)**:
1. 完成 TreeNavigationView 组件 (6-8h)
2. 完成 BookmarkView 组件 (4-6h)

**本周五 (12/5)**:
1. Slate.js 媒体节点插件 (6-8h)
2. 上传模态框 (2-3h)

**下周一 (12/8)**:
1. 编辑模态框 (2-3h)
2. 批量操作 UI (2-3h)

---

## 📚 参考文档

- [STORAGE_ARCHITECTURE.md](./STORAGE_ARCHITECTURE.md) - 存储架构文档
- [EVENTLOG_RICH_MEDIA_IMPLEMENTATION.md](./EVENTLOG_RICH_MEDIA_IMPLEMENTATION.md) - 富媒体实现指南
- [STORAGE_TODO.md](./STORAGE_TODO.md) - 存储系统任务清单
- [src/types.ts](../src/types.ts) - 类型定义
- [src/services/AttachmentService.ts](../src/services/AttachmentService.ts) - 附件服务

---

**最后更新**: 2025-12-02 14:30  
**负责人**: AI Agent  
**审核人**: Zoey
