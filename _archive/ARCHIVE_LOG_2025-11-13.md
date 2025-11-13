# 代码库清理归档日志 - 2025-11-13

## 归档原因
清理臃肿的根目录和 docs 目录，将调试脚本、旧版本文档、死代码归档。

---

## 归档内容

### 1. 诊断和测试脚本 → `_archive/debug-scripts/`

**JavaScript 诊断脚本**：
- `diagnose-timer-tags.js`
- `diagnose-timecalendar.js`
- `diagnose-tag-issue.js`
- `diagnose-tag-insert-flow.js`
- `diagnose-tag-cursor.js`
- `diagnose-sync.js`
- `diagnose-plan-rendering.js`
- `diagnose-main-thread-blocking.js`
- `diagnose-get-events-caller.js`
- `diagnose-fuzzy-time.js`
- `diagnose-delete-simple.js`
- `diagnose-delete-performance.js`
- `diagnose-delete-complete-trace.js`

**清理脚本**：
- `cleanup-test-events.js`
- `cleanup-untitled-events-batch.js`
- `cleanup-untitled-events.js`
- `find-all-remarkable-events.js`

**修复脚本**：
- `fix-loadEvents.py`
- `fix-timecalendar-sync.js`

**测试文件**：
- `test-electron-api.html`
- `test-tag-cursor-fix.js`
- `test-tagservice-performance.js`

---

### 2. 调试文档 → `_archive/debug-docs/`

**调试指南**：
- `TIMECALENDAR_DELETE_PATCH.md`
- `TIMEHUB_INCREMENTAL_UPDATE_FIX.md`
- `TIMECALENDAR_DEBUG_GUIDE.md`
- `TIMECALENDAR_ANALYSIS.md`
- `TAG_CURSOR_FIX_QUICK.md`
- `DIAGNOSIS.md`

**配置指南**：
- `check-auth-config.md`
- `CLEAR_AUTH_CACHE.md`
- `ENABLE_DEBUG.md`
- `remote-ssh-settings-guide.md`
- `另一台电脑操作指南.md`

**临时文件**：
- `temp-loadEvents-fix.txt`

---

### 3. 历史总结文档 → `_archive/legacy-docs/summary-reports/`

**编译和类型系统**：
- `COMPILATION_FIXES_v1.7_SUMMARY.md`
- `TYPE_SYSTEM_REFACTOR_v1.7.md`

**功能测试和分析**：
- `DESCRIPTION_SAVE_TEST_GUIDE.md`
- `event_display.md`
- `GETALLEVENTS_ANALYSIS.md`

**假日更新**：
- `HOLIDAY_AUTO_UPDATE_SUMMARY.md`
- `HOLIDAY_UPDATE_GUIDE.md`

**性能诊断**：
- `PERFORMANCE_DIAGNOSIS_v1.7.2.md`

**PlanManager Slate 相关**：
- `PLANMANAGER_SLATE_DIAGNOSIS.md`
- `PLANMANAGER_SLATE_FIX_SUMMARY.md`

**Slate 编辑器调试**：
- `SLATE_DEBUG_GUIDE.md`
- `SLATE_DEBUG_QUICK_REF.md`
- `SLATE_DEBUG_TEST_CHECKLIST.md`

**组件更新说明**：
- `UnifiedDateTimePicker更新说明.md`

---

### 4. 组件开发指南 → `_archive/legacy-docs/component-guides/`

- `component-development-guide.md`
- `DEBUG_LOGGING_GUIDE.md`
- `FLOATING_COMPONENTS_GUIDE.md`
- `SLATE_DEVELOPMENT_GUIDE.md`
- `SNAPSHOT_GUIDE.md`

---

### 5. 旧版本修复文档 → `_archive/legacy-docs/fixes/`

**v1.7 及之前的修复**：
- `CHECKBOX_RERENDER_FIX.md`
- `DELETION_CONFIRMATION_OPTIMIZATION.md`
- `FULL_OPERATION_COMPLETE_AUDIT.md`
- `FULL_UPDATE_ELIMINATION_FIX.md`
- `HUNYUAN_CORS_LIMITATION.md`
- `INCREMENTAL_UPDATE_MIGRATION_COMPLETE.md`
- `ISO_FORMAT_ELIMINATION_v1.7.3.md`
- `ITEM_UPDATE_DIAGNOSIS.md`
- `PDF_WORKER_CONFIGURATION.md`
- `REMOVE_APP_ALLEVENTS_STATE.md`

---

### 6. 死代码组件 → `_archive/legacy-components/`

**TaskManager**：
- `TaskManager.tsx` - 功能已被 PlanManager 完全取代，无任何组件引用

---

### 7. 批处理脚本 → `_archive/scripts/`

- `fix-tiptap-cache.bat`
- `restart-electron-clean.bat`
- `e.bat`
- `ed.bat`
- `start-dev.bat`

---

## 保留的活跃文档

### 根目录
- `README.md` - 项目主文档
- `QUICK_START.md` - 快速启动指南
- `CHANGELOG.md` - 变更日志
- `启动Electron.bat` - 主启动脚本
- `快速启动.bat` - 快捷启动
- `setup-aliases.ps1` - PowerShell 别名配置

### docs/
- `README.md` - 文档目录索引
- `shortcuts-cheatsheet.md` - 快捷键速查表
- `user-guide.md` - 用户指南
- `TIME_ARCHITECTURE.md` - 时间系统架构
- `TIMELOG_ARCHITECTURE.md` - 时间日志架构

### docs/PRD/
所有产品需求文档保留（当前活跃模块的规格文档）

### docs/architecture/
所有架构文档保留

### docs/components/
所有组件文档保留

### docs/features/
所有功能文档保留

### docs/fixes/
**v1.8 当前活跃修复**：
- `SLATE_NODE_STRUCTURE_FIX.md`
- `SYNCTARGETPICKER_PERFORMANCE_FIX.md`
- `SYNCTARGETPICKER_TODO_LISTS_IMPLEMENTATION.md`
- `TAGPICKER_PERFORMANCE_FIX.md`
- `TAG_CURSOR_FIX.md`
- `TAG_CURSOR_NORMALIZATION_FIX.md`
- `TAG_INSERT_CURSOR_FIX.md`
- `TIMEHUB_ARCHITECTURE_FIX_2025-11-21.md`
- `TWO_PHASE_SYNC_OPTIMIZATION.md`
- `UNIFIED_ARRAY_FIELDS_MIGRATION_v1.8.md`

---

## 清理效果

### 根目录清理
- **清理前**: 50+ 个文件（混杂代码、脚本、文档）
- **清理后**: ~15 个核心文件（配置、入口、主文档）
- **改善**: 减少 70% 文件数量，目录结构清晰

### docs/ 清理
- **清理前**: ~30 个散乱文档
- **清理后**: ~10 个核心文档 + 4 个子目录
- **改善**: 只保留当前架构和用户指南

### src/components/ 清理
- **移除死代码**: TaskManager.tsx（392 行，0 引用）

---

## 归档策略

### 保留原则
✅ **活跃文档**: 当前版本（v1.8+）的架构、PRD、功能文档  
✅ **用户文档**: README, 用户指南, 快捷键速查  
✅ **核心架构**: TIME_ARCHITECTURE, TIMELOG_ARCHITECTURE  

### 归档原则
📦 **调试文档**: 临时诊断、问题分析报告  
📦 **历史修复**: v1.7 及之前的修复记录  
📦 **废弃指南**: 旧版本组件开发指南  
📦 **死代码**: 无引用的组件  
📦 **临时脚本**: 一次性诊断/修复脚本  

---

## 后续维护建议

1. **新增诊断脚本**: 直接创建在 `_archive/debug-scripts/`
2. **修复文档**: 完成后移动到 `_archive/legacy-docs/fixes/`
3. **版本文档**: 下次大版本更新时归档旧版本总结
4. **定期清理**: 每个大版本发布后进行一次归档清理

---

**清理时间**: 2025-11-13  
**Git Commit**: feat: 修复远程事件颜色显示 + SyncTargetPicker集成  
**版本**: v1.8
