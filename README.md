# 4DNote v1.3.0 🎯

**四维时间管理系统 - 集成 Plan/Actual/TimeLog/Timer 的智能生产力工具**

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/zoeysnowy/4DNote/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19.2.0-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Slate.js](https://img.shields.io/badge/Slate.js-0.118-00a67e.svg)](https://www.slatejs.org/)

4DNote 是一个创新的四维时间管理系统，整合了 **计划 (Plan)**、**执行 (Actual)**、**日志 (TimeLog)** 和 **计时器 (Timer)** 四个维度，提供完整的时间管理闭环。支持与 Microsoft Outlook 日历双向同步，采用 Slate.js 富文本编辑器和现代化存储架构。

> **🆕 v1.3.0 更新** (2025-12-03)  
> 项目从 ReMarkable 重命名为 4DNote，完成代码架构重组和文档系统升级

---

## 🌟 核心特性

### 📊 四维时间管理架构

4DNote 独创的四维时间管理体系：

| 维度 | 组件 | 功能描述 | 核心价值 |
|-----|------|---------|---------|
| **📅 Plan** | PlanManager | 计划视图 - 规划未来事件，时间轴组织 | 前瞻性规划 |
| **✅ Actual** | TimeCalendar | 执行视图 - 记录实际发生的事件 | 真实执行追踪 |
| **📝 TimeLog** | ContentSelectionPanel | 日志视图 - 详细记录事件内容和思考 | 深度复盘与知识沉淀 |
| **⏱️ Timer** | Timer Widget | 计时器 - 实时专注时间追踪 | 专注力量化 |

**架构亮点**：
- ✅ **事件双态系统**：Plan 事件可转化为 Actual 事件，实现计划与执行的闭环
- ✅ **父子事件树**：Timer 作为子事件自动关联到父事件，构建完整的时间层级
- ✅ **智能同步**：Plan/Actual 事件可独立或批量同步至 Outlook 日历
- ✅ **统一存储**：所有事件共享 Event 数据模型，通过 `isActual`/`isTimer` 标记区分类型

### ✨ Slate.js 富文本编辑系统

基于 **SlateCore 共享层**的三编辑器架构（v3.0）：

```
SlateCore (共享层 - 1500+ 行)
├── 类型定义 (ParagraphNode, TagNode, DateMentionNode, TimestampDividerElement)
├── 序列化工具 (JSON ↔ Slate Nodes ↔ HTML)
├── 元素组件 (TagElement, DateMentionElement, TimestampDivider)
├── 格式化工具 (粗体/斜体/删除线/项目符号)
├── Timestamp 服务 (EventLogTimestampService)
└── Clipboard 增强 (纯文本/HTML/项目符号智能解析)

      ↓ 被复用于

ModalSlate (事件编辑器)       PlanSlate (计划编辑器)       EventLine (时间轴行内编辑)
├── 富文本内容编辑            ├── 单行简洁编辑            ├── 快速内联编辑
├── 时间戳分隔符              ├── Tag/DateMention        ├── 轻量级交互
├── 版本历史管理              ├── 键盘导航优化            └── 实时保存
└── 完整格式支持              └── PlanManager 集成
```

**SlateCore 重构成果**：
- 📉 代码减少：247 行（ModalSlate 从 1265 → 1018 行）
- 🔄 共享复用：30+ 函数，3 个元素组件，1 个 Timestamp 服务
- 🏗️ 架构清晰：共享核心 + 专注场景，职责分明

### 💾 Storage Architecture v2.4.0

**本地优先 + 云端预留** 的渐进式存储架构：

```typescript
// 当前架构（MVP 阶段）
IndexedDB (主存储)
├── Events Table (事件完整数据)
├── Tags Table (标签系统)
├── Contacts Table (联系人)
└── Snapshots Table (快照备份)

SQLite (扩展支持 - Electron)
├── 无限版本历史
├── 大附件存储
└── 离线查询优化

LocalStorage (缓存层)
├── 快速访问缓存
├── 用户偏好设置
└── 智能去重键

// 未来扩展（Beta 阶段 - 预留字段已就位）
4DNote Cloud (Supabase)
├── remarkableUserId (App 账号)
├── syncMode (同步模式)
├── cloudSyncStatus (云端状态)
└── 跨设备同步
```

**架构优势**：
- ✅ **零重构升级**：云端字段已预留在 Event 类型中，开启即用
- ✅ **软删除机制**：`deletedAt` 字段实现数据恢复和同步协调
- ✅ **UUID 生成**：`nanoid()` 生成唯一 ID，支持离线创建
- ✅ **版本历史**：EventLog 支持无限版本追踪（SQLite 存储）

### 🔄 日历同步系统

**双向同步 + 智能映射** 的日历集成方案：

- **🔗 双向同步**：Plan/Actual 事件与 Outlook 日历实时同步
- **📧 Private 模式**：`send-only-private` 和 `bidirectional-private` 支持隐私保护
- **🏷️ 自动标签映射**：
  - Outlook 日历 → `工作` + `Outlook` 标签
  - Google Calendar → `生活` + `Google` 标签
  - iCloud → `个人` + `iCloud` 标签
- **🎯 6 层优先级来源**：
  1. Timer 子事件
  2. 外部日历同步
  3. 独立 Timer 事件
  4. Plan 事件
  5. TimeCalendar 事件
  6. 本地创建事件
- **⚙️ 冲突解决**：基于 `lastModifiedDateTime` 的三路合并策略
- **🧹 自动去重**：双层保护（内存缓存 + localStorage 键值检测）

### 🎨 现代化 UI 组件

- **HeadlessFloatingToolbar**：统一浮动工具栏
  - 两种模式：`menu_floatingbar`（标签/表情/日期）+ `text_floatingbar`（粗体/斜体/颜色）
  - 键盘导航：Alt+1-5 快捷键，数字键选择，Esc 关闭
  - 智能定位：自动避免遮挡选区，跟随滚动

- **EventEditModalV2**：增强事件编辑器
  - 可拖拽 modal，记忆位置
  - 多选日历同步目标
  - 智能参与者格式化（Private 模式）
  - 地址智能输入（高德地图 API）

- **ContentSelectionPanel**：TimeLog 内容面板
  - 树形结构展示事件层级
  - 折叠/展开状态记忆
  - Hide/Unhide 节点管理
  - 事件关系可视化

- **UnifiedDateTimePicker**：统一时间选择器
  - Time Field State Bitmap（v2.6）：精确追踪用户设置的字段
  - Fuzzy Date 支持："下周日中午" → `12:00` 单时间点
  - 三层架构：数据层（完整时间戳）→ 元数据层（用户意图）→ 显示层（精确渲染）

### 🌳 EventTree 层级系统

**自动维护 + 双向链接** 的事件关系管理：

```typescript
// EventTree 自动维护机制
EventService.createEvent() → 自动设置 parentEventId/childEventIds
EventService.updateEvent() → 自动同步父子关系
EventService.deleteEvent() → 软删除，保留关系链

// 双向链接功能
EventService.addLink(sourceId, targetId)       // 添加链接
EventService.removeLink(sourceId, targetId)    // 移除链接
EventService.getLinkedEvents(eventId)          // 获取所有链接事件
EventService.getBacklinks(eventId)             // 获取反向链接
```

**可视化组件**（规划中）：
- Canvas 图谱视图（React Flow）
- 拖拽编辑关系
- 自动布局算法

---

## 🚀 技术栈

### 核心框架
- **React 19.2.0** - 最新 React 版本，Concurrent 渲染
- **TypeScript 5.x** - 完整类型安全
- **Vite 7.2.2** - 极速开发体验
- **Electron** (可选) - 跨平台桌面应用

### 编辑器与 UI
- **Slate.js 0.118** - 富文本编辑框架
- **TOAST UI Calendar** - 高性能日历组件
- **Framer Motion 12.x** - 流畅动画
- **Ant Design 5.x** - 企业级组件库
- **React Flow 11.x** - 图形可视化（EventTree）

### 存储与同步
- **IndexedDB** - 浏览器本地数据库
- **SQLite** (Electron) - 离线持久化
- **Microsoft Graph API** - Outlook 日历同步
- **Azure MSAL** - OAuth 身份认证

### 开发工具
- **Vitest** - 单元测试
- **ESLint + Prettier** - 代码规范
- **TypeScript Compiler** - 类型检查

---

## 📦 快速开始

### 环境要求
- **Node.js** 16+ 
- **npm** 或 **yarn**
- **Azure AD 应用注册** (用于 Outlook 同步)
- **高德地图 API Key** (用于地址功能，可选)

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm start
# 或使用 Vite
npm run dev
```

应用将在 [http://localhost:3000](http://localhost:3000) 启动（或 Vite 的 5173 端口）。

### 构建生产版本
```bash
npm run build
```

构建产物将输出到 `dist/` 文件夹，适合生产环境部署。

### 启动 Electron 桌面应用
```bash
npm run electron-dev
# 或使用快捷命令
npm run ed
```

---

## 🔧 配置指南

### 1. Outlook 日历同步配置

1. **注册 Azure AD 应用**：
   - 访问 [Azure Portal](https://portal.azure.com/)
   - 应用程序（客户端）ID 和租户 ID
   - 添加重定向 URI: `http://localhost:3000`

2. **配置权限**：
   - `Calendars.ReadWrite` - 读写日历
   - `User.Read` - 读取用户信息

3. **环境变量**（`src/authConfig.ts`）：
```typescript
export const msalConfig = {
  auth: {
    clientId: "YOUR_CLIENT_ID",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: "http://localhost:3000"
  }
};
```

### 2. 高德地图地址功能（可选）

1. **申请 API Key**：
   - 访问 [高德开放平台](https://console.amap.com/)
   - 免费配额：300,000 次/天

2. **配置环境变量**：
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
VITE_AMAP_KEY=your_actual_api_key_here
```

详细配置见 [地址功能设置文档](./docs/LOCATION_FEATURE_SETUP.md)

---

## 📖 文档

### 核心文档
- **[Storage Architecture](./docs/architecture/STORAGE_ARCHITECTURE.md)** - 存储架构设计（v2.4.0）
- **[Slate Editor PRD](./docs/PRD/SLATEEDITOR_PRD.md)** - Slate.js 编辑器系统（v3.0）
- **[EventTree Module PRD](./docs/PRD/EVENTTREE_MODULE_PRD.md)** - 事件树模块设计
- **[EventService Module PRD](./docs/PRD/EVENTSERVICE_MODULE_PRD.md)** - 事件服务 API
- **[Floating Components PRD](./docs/PRD/FLOATING_COMPONENTS_PRD.md)** - 浮动工具栏系统

### 功能文档
- **[EventEditModal V2 PRD](./docs/PRD/EVENTEDITMODAL_V2_PRD.md)** - 增强事件编辑器
- **[UnifiedMention PRD](./docs/PRD/UnifiedMention_PRD.md)** - @提及 和日期引用
- **[ActionBasedSyncManager PRD](./docs/PRD/ACTIONBASEDSYNCMANAGER_PRD.md)** - 同步管理器
- **[Attachment System Integration](./docs/ATTACHMENT_SYSTEM_INTEGRATION.md)** - 附件系统集成

### 测试文档
- **[Location Feature Setup](./docs/LOCATION_FEATURE_SETUP.md)** - 地址功能配置
- **[Location Test Checklist](./docs/LOCATION_TEST_CHECKLIST.md)** - 地址功能测试清单

### 架构演进
- **[CHANGELOG.md](./CHANGELOG.md)** - 完整更新日志
- **[SlateCore Refactor Progress](./SLATECORE_REFACTOR_PROGRESS.md)** - SlateCore 重构进度

---

## 🧪 测试工具

项目包含以下调试和测试工具（位于根目录）：

### 数据完整性测试
- **`diagnose-duplicate-events.js`** - 重复事件检测
- **`diagnose-storage-overflow.html`** - 存储溢出诊断
- **`diagnose-fuzzy-time.js`** - 模糊时间解析测试

### 同步功能测试
- **`test-circular-updates.bat`** - 循环更新检测
- **`check-ghost-in-storage.html`** - 幽灵事件检查

### UI 组件测试
- **`test-eventeditmodal-v2.html`** - EventEditModal V2 测试
- **`test-attendee-feature.html`** - 参与者功能测试
- **`test-time-display-fix.html`** - 时间显示修复验证
- **`test-attachment-system.html`** - 附件系统测试

使用方法：在浏览器控制台中运行相应的 JavaScript 文件或直接打开 HTML 文件。

---

## 🔄 版本历史

### v1.3.0 (2025-12-03) - 重命名与架构升级
- **项目重命名**：ReMarkable → 4DNote
- **代码重命名**：46 个文件（localStorage 键、变量名、数据库名）
- **文档更新**：22 个文件（PRD、架构文档、用户指南）
- **UI 修复**：应用标题、缺失 CSS 文件
- **存储架构**：v2.4.0（UUID 生成、软删除、版本历史）
- **GitHub 仓库**：更新为 4DNote

### v1.2.0 (2025-11-29) - SlateCore 重构
- **SlateCore 共享层**：1500+ 行共享代码
- **ModalSlate 重构**：代码减少 247 行
- **PlanSlate 优化**：导入 SlateCore 元素组件
- **架构文档**：SLATEEDITOR_PRD.md v3.0

### v1.1.0 (2025-10-20) - 日历集成增强
- **TUI Calendar 集成** - 交互式日历视图
- **多标签事件编辑** - 标签搜索和多选
- **事件去重机制** - 双层保护防止重复
- **时间解析修复** - ISO 8601 多格式支持
- **日历过滤系统** - 实时显示/隐藏事件

### v1.0.0 (2024) - 初始稳定版本
- Microsoft Outlook 日历同步
- 事件管理（创建/编辑/删除）
- 任务管理系统
- 标签管理系统
- 番茄钟计时器
- Azure MSAL 认证
- localStorage 持久化

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献流程
1. **Fork 本仓库**
2. **创建特性分支**
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **提交更改**
   ```bash
   git commit -m 'feat: Add some AmazingFeature'
   ```
4. **推送到分支**
   ```bash
   git push origin feature/AmazingFeature
   ```
5. **开启 Pull Request**

### 提交规范
使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：
- `feat:` - 新功能
- `fix:` - Bug 修复
- `docs:` - 文档更新
- `refactor:` - 代码重构
- `perf:` - 性能优化
- `test:` - 测试相关
- `chore:` - 构建/工具变更

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](./LICENSE) 文件了解详情。

---

## 🙏 致谢

- **[TOAST UI Calendar](https://github.com/nhn/tui.calendar)** - 优秀的日历组件库
- **[Slate.js](https://www.slatejs.org/)** - 强大的富文本编辑框架
- **[Microsoft Graph API](https://docs.microsoft.com/en-us/graph/)** - Outlook 集成支持
- **[React](https://reactjs.org/)** - 前端框架
- **[Vite](https://vitejs.dev/)** - 构建工具
- 所有贡献者和测试者

---

## 📞 联系方式

- **GitHub Issues**: [提交问题](https://github.com/zoeysnowy/4DNote/issues)
- **GitHub Discussions**: [参与讨论](https://github.com/zoeysnowy/4DNote/discussions)
- **邮箱**: zoey@4dnote.app (计划中)

---

## 🗺️ 发展路线图

### Phase 1: MVP (已完成 ✅)
- ✅ 本地存储架构（IndexedDB + SQLite）
- ✅ Outlook 日历同步
- ✅ 四维时间管理（Plan/Actual/TimeLog/Timer）
- ✅ Slate.js 富文本编辑器
- ✅ EventTree 层级系统

### Phase 2: Beta (3-6 个月)
- ⏳ 4DNote Cloud (Supabase)
- ⏳ App 账号系统
- ⏳ 跨设备同步
- ⏳ Google Calendar 集成
- ⏳ iCloud 集成
- ⏳ 移动端适配

### Phase 3: 1.0 Release (6-12 个月)
- ⏳ AI 驱动的时间建议
- ⏳ 智能事件分类
- ⏳ 高级可视化（EventTree Canvas）
- ⏳ 团队协作功能
- ⏳ API 开放平台

---

**Made with ❤️ by the 4DNote Team**
