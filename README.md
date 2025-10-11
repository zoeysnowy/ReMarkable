# ReMarkable v0.1

🎯 **智能时间管理与日历同步工具**

ReMarkable 是一个现代化的时间管理应用，支持与 Microsoft Outlook 日历的双向同步功能。

## ✨ 主要功能

- ⏰ **番茄钟计时器** - 专注时间管理，提高工作效率
- 📅 **事件管理** - 创建、编辑、删除日程事件
- 📋 **任务管理** - 任务创建与跟踪
- 🔄 **双向同步** - 与 Microsoft Outlook 日历实时同步
- 📱 **响应式设计** - 支持桌面和移动设备
- 🌐 **现代化界面** - 基于 React + TypeScript 构建

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

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm start
```

应用将在 [http://localhost:3000](http://localhost:3000) 启动。

### 构建生产版本
```bash
npm run build
```

### 运行测试

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

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
