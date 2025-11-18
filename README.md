# ReMarkable v1.1 🎯

**智能时间管理与日历同步工具**

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/zoeysnowy/ReMarkable/releases/tag/v1.1)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19.2.0-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)

ReMarkable 是一个现代化的时间管理应用，支持与 Microsoft Outlook 日历的双向同步功能，提供强大的事件管理和多标签分类系统。

> 📖 **最新发布**: [v1.1 Release Notes](./RELEASE_NOTES_v1.1.md) - Calendar Integration & Event Management Enhancements

## ✨ 主要功能

### 核心功能
- 📅 **TUI Calendar 集成** - 交互式日历视图，支持周/月视图切换
- 🏷️ **多标签事件管理** - 为事件添加多个标签，支持层级结构
- ✏️ **增强事件编辑器** - 自定义模态窗口，支持标签搜索和多选
- 📍 **地址智能输入** - 集成高德地图 API，支持地址自动补全和地图跳转
- 🔍 **日历过滤系统** - 按日历显示/隐藏事件，实时更新
- 🔄 **双向同步** - 与 Microsoft Outlook 日历无缝同步
- 🧹 **事件去重机制** - 自动检测并清理重复事件
- ⏰ **番茄钟计时器** - 专注时间管理，提高工作效率
- ✅ **任务管理** - 任务创建与跟踪

### 数据完整性
- 🛡️ **智能时间解析** - 支持多种 ISO 8601 格式
- 🔐 **数据验证** - 保存前验证时间格式
- 📊 **重复检测** - 双层保护防止重复事件
- 💾 **本地持久化** - localStorage + 智能缓存管理

### 用户体验
- � **现代化界面** - 基于 React + TypeScript 构建
- 📱 **响应式设计** - 支持桌面和移动设备
- 🖱️ **直观交互** - 点击外部关闭、拖拽支持
- 🎯 **快速筛选** - 标签搜索、日历过滤

## 🚀 技术栈

- **前端框架**: React 19.2.0 + TypeScript
- **同步服务**: Microsoft Graph API
- **身份验证**: Azure MSAL Browser
- **存储方案**: localStorage + 智能缓存管理
- **构建工具**: Create React App

## 📦 快速开始

### 环境要求
- Node.js 16+ 
- npm 或 yarn
- Azure AD 应用注册（用于 Outlook 同步）
- 高德地图 API Key（用于地址功能，可选）

### 安装依赖
```bash
npm install
```

### 配置地址功能（可选）

如需使用地址自动补全功能，请配置高德地图 API Key：

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 申请高德地图 API Key（免费，300,000 次/天）：  
   访问 [高德开放平台](https://console.amap.com/)

3. 在 `.env` 文件中配置：
```env
VITE_AMAP_KEY=your_actual_api_key_here
```

详细配置指南见 [地址功能设置文档](./docs/LOCATION_FEATURE_SETUP.md)

### 启动开发服务器
```bash
npm start
```

应用将在 [http://localhost:3000](http://localhost:3000) 启动。

### 构建生产版本
```bash
npm run build
```

构建产物将输出到 `build` 文件夹，适合生产环境部署。

## 📖 文档

### 核心文档
- [v1.1 Release Notes](./RELEASE_NOTES_v1.1.md) - 版本更新说明
- [TimeCalendar README](./docs/TIMECALENDAR_README.md) - 日历组件实现指南
- [TUI Integration Guide](./docs/timecalendar-tui-integration.md) - TUI Calendar 集成文档

### 功能文档
- [地址功能设置指南](./docs/LOCATION_FEATURE_SETUP.md) - 高德地图 API 配置
- [地址功能测试清单](./docs/LOCATION_TEST_CHECKLIST.md) - LocationInput 组件测试

### 测试文档
- [Testing Guide](./docs/timecalendar-testing-guide.md) - 测试指南
- [UI Verification Framework](./docs/ui-verification-framework.md) - UI 测试框架

## 🧪 测试工具

项目包含以下调试和测试工具：

- **test-deduplication.js** - 事件去重验证
- **diagnose-duplicates.js** - 重复事件检测
- **ui-verification.js** - UI 组件测试
- **clear-calendar-filters.html** - 重置日历筛选

使用方法：在浏览器控制台中运行相应的 JavaScript 文件。

## 🔄 版本历史

- **v1.1.0** (2025-10-20) - Calendar Integration & Event Management Enhancements
  - TUI Calendar 集成
  - 多标签事件编辑
  - 事件去重机制
  - 时间解析修复
  - 日历过滤系统

- **v1.0.0** (2024) - Initial stable release
  - 基础日历同步功能
  - 标签管理系统
  - Outlook 集成

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](./LICENSE) 文件了解详情。

## 🙏 致谢

- [TOAST UI Calendar](https://github.com/nhn/tui.calendar) - 优秀的日历组件库
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/) - Outlook 集成支持
- 所有贡献者和测试者

## 📞 联系方式

- **GitHub Issues**: [提交问题](https://github.com/zoeysnowy/ReMarkable/issues)
- **GitHub Discussions**: [参与讨论](https://github.com/zoeysnowy/ReMarkable/discussions)

---

**Made with ❤️ by the ReMarkable Team**

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
