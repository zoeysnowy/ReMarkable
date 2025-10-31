# ReMarkable 文档中心

本目录包含 ReMarkable 项目的所有技术文档，按功能和用途分类组织。

## 📁 文档结构

### 📖 核心文档（当前目录）
- **user-guide.md** - 用户使用指南
- **v1.0-development-guide.md** - v1.0 开发指南
- **component-development-guide.md** - 组件开发指南
- **shortcuts-cheatsheet.md** - 快捷键速查表
- **SNAPSHOT_GUIDE.md** - 快照功能指南
- **QUICK_START_CHECKLIST.md** - 快速开始检查清单

### 🎨 features/ - 功能特性文档
包含各个功能模块的设计、实现和使用文档：
- **浮动工具栏**：floating-button-guide.md, FLOATING_TOOLBAR_GUIDE.md 等
- **计划管理器**：PLAN_MANAGER_DESIGN.md, PLAN_EDITOR_* 等
- **日历组件**：TIMECALENDAR_README.md, timecalendar-tui-integration.md
- **标签管理**：tag-management-spec.md, HIERARCHICAL_TAG_PICKER_GUIDE.md
- **桌面组件**：WIDGET_STRUCTURE_GUIDE.md
- **同步通知**：SYNC_NOTIFICATION_GUIDE.md

### 🏗️ architecture/ - 架构设计文档
包含系统架构、性能优化和重构相关文档：
- **EventService 架构**：EVENTSERVICE_* 文档
- **同步机制**：Sync Mechanism.md, SYNC_IMPROVEMENT_SUMMARY.md
- **性能优化**：startup-performance-guide.md, STATUSBAR_PERFORMANCE.md, MEMORY_OPTIMIZATION_REPORT.md
- **重构记录**：PLANMANAGER_REFACTOR_*, TAGMANAGER_KEYBOARD_ANALYSIS.md
- **代码清理**：CONSOLE_LOG_CLEANUP_REPORT.md

### 🔧 fixes/ - 问题修复文档
包含各种 bug 修复和问题解决的记录：
- **组件修复**：DESKTOPWIDGET_DELAY_FIX.md, STATUSBAR_FIX.md 等
- **编辑器问题**：MULTILINEEDITOR_* 系列文档
- **UI 问题**：DRAGBAR_FIX_FINAL_V2.md
- **认证问题**：AUTH_EXPIRATION_IMPLEMENTATION.md, INDEXMAP_AUTH_FIX.md
- **同步问题**：OFFLINE_SYNC_FIX.md
- **经验总结**：FREEFORMEDITOR_LESSONS_LEARNED.md

## 📝 文档命名规范

- **UPPERCASE_WITH_UNDERSCORES.md** - 重要的架构、修复或总结文档
- **lowercase-with-hyphens.md** - 指南、教程类文档
- **带后缀的文档**：
  - `*_GUIDE.md` - 使用指南
  - `*_FIX.md` - 问题修复记录
  - `*_SUMMARY.md` - 总结文档
  - `*_REPORT.md` - 分析报告

## 🔍 快速查找

- 想了解如何使用某个功能？→ 查看 `features/` 目录
- 遇到了问题想看修复方案？→ 查看 `fixes/` 目录
- 想了解系统架构设计？→ 查看 `architecture/` 目录
- 新手入门？→ 从 `QUICK_START_CHECKLIST.md` 和 `user-guide.md` 开始

## 📚 推荐阅读顺序

1. **新手开发者**：
   - QUICK_START_CHECKLIST.md
   - component-development-guide.md
   - user-guide.md

2. **功能开发**：
   - v1.0-development-guide.md
   - features/ 目录下相关文档

3. **架构了解**：
   - architecture/EVENTSERVICE_INTEGRATION_GUIDE.md
   - architecture/Sync Mechanism.md

4. **问题排查**：
   - fixes/ 目录下相关修复文档
