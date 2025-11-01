# 多日历同步支持 - 开发 TODO

**项目**：ReMarkable v2.0 - 多日历同步  
**开始日期**：2025-11-02  
**预计完成**：2025-11-21（15-21 个工作日）  
**当前状态**：⏳ 待开始

---

## 📋 总览

- [ ] **阶段 1**：准备与设计（3 天）
- [ ] **阶段 2**：数据结构与迁移（3 天）
- [ ] **阶段 3**：同步逻辑重构（6 天）
- [ ] **阶段 4**：UI 改进（3 天）
- [ ] **阶段 5**：集成测试与优化（3 天）
- [ ] **阶段 6**：文档与发布（3 天）

---

## 🎯 阶段 1：准备与设计（Day 1-3）

### Day 1 - 技术方案细化

- [ ] **细化边界情况处理**
  - [ ] 列出所有可能的日历组合场景（1-10 个日历）
  - [ ] 定义部分失败时的行为（继续/中止/回滚）
  - [ ] 设计冲突解决策略（用户同时在两个日历修改同一事件）
  - [ ] 确认删除逻辑（删除本地事件是否删除所有远程副本）

- [ ] **研究 Microsoft Graph Batch API**
  - [ ] 阅读官方文档：https://docs.microsoft.com/en-us/graph/json-batching
  - [ ] 测试批量请求限制（最多多少个请求）
  - [ ] 评估是否值得实现（vs 简单并行）
  - [ ] 记录结论到技术文档

- [ ] **设计数据结构**
  - [ ] 确认 `externalIds` 对象结构
  - [ ] 确认 `syncStatusByCalendar` 对象结构
  - [ ] 设计向后兼容方案（getter/setter）
  - [ ] 绘制数据流图（本地 → 同步队列 → 远程）

### Day 2 - UI 设计

- [ ] **EventEditModal 原型设计**
  - [ ] 设计多选日历下拉框（支持搜索）
  - [ ] 设计同步状态列表（每个日历显示状态徽章）
  - [ ] 设计重试按钮位置和交互
  - [ ] 设计错误提示样式（Toast vs Inline）
  - [ ] 使用 Figma 或纸笔绘制原型

- [ ] **TimeCalendar 事件卡片设计**
  - [ ] 设计多日历徽章（小图标 + 数量）
  - [ ] 设计悬停提示内容（列出所有日历和状态）
  - [ ] 设计整体同步状态图标（全部成功/部分失败/全部失败）
  - [ ] 绘制原型

- [ ] **审查与反馈**
  - [ ] 自我审查设计是否符合需求
  - [ ] 记录设计决策到文档

### Day 3 - 测试计划编写

- [ ] **编写测试用例清单**
  - [ ] 单元测试用例（30+ 个）
  - [ ] 集成测试场景（10+ 个）
  - [ ] 性能测试指标（3 个）
  - [ ] 边界测试用例（空日历、10+ 日历、API 失败等）

- [ ] **准备测试数据**
  - [ ] 创建测试账号（Outlook 测试账号）
  - [ ] 准备测试日历（3-5 个不同名称的日历）
  - [ ] 备份生产环境数据（用于迁移测试）

- [ ] **准备测试工具**
  - [ ] 安装 Jest 和 React Testing Library（如果还没有）
  - [ ] 配置 Mock Microsoft Graph API
  - [ ] 编写测试工具函数（createMockEvent, assertSyncStatus 等）

---

## 🔧 阶段 2：数据结构与迁移（Day 4-6）

### Day 4 - 修改类型定义

- [ ] **`src/types.ts` - Event 接口**
  - [ ] 添加 `externalIds?: { [calendarId: string]: string | null }`
  - [ ] 添加 `syncStatusByCalendar?: { [calendarId: string]: 'pending' | 'synced' | 'error' }`
  - [ ] 添加 `lastSyncTimeByCalendar?: { [calendarId: string]: string }`
  - [ ] 添加 JSDoc 注释说明向后兼容性
  - [ ] 保留 `externalId` 和 `calendarId`（标记为 deprecated）

- [ ] **`src/services/ActionBasedSyncManager.ts` - SyncAction 接口**
  - [ ] 添加 `targetCalendarId?: string`
  - [ ] 添加 `synchronizedByCalendar?: { [calendarId: string]: boolean }`
  - [ ] 添加 `lastErrorByCalendar?: { [calendarId: string]: string }`
  - [ ] 更新 JSDoc 注释

- [ ] **TypeScript 编译检查**
  - [ ] 运行 `npm run build`
  - [ ] 修复所有类型错误
  - [ ] 确认无 breaking changes

### Day 5 - 编写迁移脚本

- [ ] **创建迁移脚本文件**
  - [ ] 创建 `src/utils/migrations/migrateToMultiCalendar.ts`
  - [ ] 实现 `migrateToMultiCalendar()` 函数
  - [ ] 添加迁移前备份逻辑
  - [ ] 添加迁移完成标记（localStorage）

- [ ] **迁移逻辑实现**
  - [ ] 迁移 `externalId` → `externalIds`
  - [ ] 迁移 `calendarId` → `calendarIds` 数组
  - [ ] 迁移 `syncStatus` → `syncStatusByCalendar`
  - [ ] 处理边界情况（空值、undefined、null）

- [ ] **错误处理**
  - [ ] 添加 try-catch 包裹整个迁移过程
  - [ ] 失败时自动回滚（恢复备份）
  - [ ] 记录详细错误日志

### Day 6 - 测试迁移脚本

- [ ] **准备测试数据**
  - [ ] 创建 100 个测试事件（各种状态）
  - [ ] 包含边界情况事件（无 externalId、无 calendarId 等）

- [ ] **运行迁移测试**
  - [ ] 在测试环境运行迁移脚本
  - [ ] 验证所有字段正确迁移
  - [ ] 验证向后兼容性（老代码仍可读取）
  - [ ] 验证幂等性（重复运行不会出错）

- [ ] **集成到 ActionBasedSyncManager**
  - [ ] 在构造函数中调用迁移脚本
  - [ ] 添加迁移状态日志
  - [ ] 测试应用启动流程

---

## ⚙️ 阶段 3：同步逻辑重构（Day 7-12）

### Day 7 - 实现辅助方法

- [ ] **`syncEventToCalendars()` 方法**
  - [ ] 实现并行同步逻辑（Promise.allSettled）
  - [ ] 处理每个日历的成功/失败
  - [ ] 返回 `{ [calendarId]: externalId | null }`
  - [ ] 添加详细日志

- [ ] **`updateLocalEventExternalIds()` 方法**
  - [ ] 更新本地事件的 externalIds 字段
  - [ ] 同时更新 syncStatusByCalendar
  - [ ] 更新 lastSyncTimeByCalendar
  - [ ] 触发 UI 更新事件

- [ ] **编写单元测试**
  - [ ] 测试 syncEventToCalendars（全部成功）
  - [ ] 测试 syncEventToCalendars（部分失败）
  - [ ] 测试 updateLocalEventExternalIds

### Day 8-9 - 重构 CREATE 操作

- [ ] **修改 `syncSingleAction()` - case 'create'**
  - [ ] 替换单日历逻辑为多日历逻辑
  - [ ] 调用 `syncEventToCalendars()`
  - [ ] 处理返回的 externalIds
  - [ ] 更新本地事件
  - [ ] 判断整体同步状态（全部成功/部分成功）

- [ ] **错误处理**
  - [ ] 捕获 API 错误
  - [ ] 记录到 `lastErrorByCalendar`
  - [ ] 保持 SyncAction 在队列中（用于重试）

- [ ] **编写单元测试**
  - [ ] 测试创建到 1 个日历（向后兼容）
  - [ ] 测试创建到 3 个日历（全部成功）
  - [ ] 测试创建到 3 个日历（部分失败）
  - [ ] 测试 API 错误处理
  - [ ] 测试重试逻辑

### Day 10-11 - 重构 UPDATE 操作

- [ ] **实现日历变更检测**
  - [ ] 比对 oldData.calendarIds 和 newData.calendarIds
  - [ ] 计算 toDelete、toCreate、toUpdate 列表

- [ ] **实现分步同步**
  - [ ] 删除不再需要的日历事件
  - [ ] 创建新增的日历事件
  - [ ] 更新现有的日历事件

- [ ] **优化性能**
  - [ ] 使用 Promise.allSettled 并行执行
  - [ ] 避免不必要的 API 调用（如果事件内容未变化）

- [ ] **编写单元测试**
  - [ ] 测试添加新日历
  - [ ] 测试移除日历
  - [ ] 测试替换日历
  - [ ] 测试仅更新内容（不改日历）
  - [ ] 测试部分失败处理

### Day 12 - 重构 DELETE 操作 + 重试功能

- [ ] **修改 DELETE 操作**
  - [ ] 遍历 externalIds，删除所有远程事件
  - [ ] 使用 Promise.allSettled
  - [ ] 记录失败的删除（日志警告）

- [ ] **实现 `retrySyncToCalendar()` 方法**
  - [ ] 接受 eventId 和 calendarId 参数
  - [ ] 调用 syncEventToCalendar（单个）
  - [ ] 更新本地 externalIds
  - [ ] 返回成功/失败

- [ ] **编写单元测试**
  - [ ] 测试删除多日历事件
  - [ ] 测试单日历重试（成功）
  - [ ] 测试单日历重试（失败）

---

## 🎨 阶段 4：UI 改进（Day 13-15）

### Day 13 - EventEditModal 改造

- [ ] **添加多选日历组件**
  - [ ] 安装/引入 Ant Design Select（如果还没有）
  - [ ] 替换单选为多选（mode="multiple"）
  - [ ] 绑定 calendarIds 状态

- [ ] **实现同步状态列表**
  - [ ] 创建 `SyncStatusItem` 组件
  - [ ] 显示日历名称 + 状态徽章
  - [ ] 添加重试按钮（仅失败时显示）

- [ ] **连接重试逻辑**
  - [ ] 调用 `syncManager.retrySyncToCalendar()`
  - [ ] 显示加载状态
  - [ ] 成功/失败提示

- [ ] **样式优化**
  - [ ] 日历选择器样式
  - [ ] 状态徽章颜色（pending=黄色, synced=绿色, error=红色）
  - [ ] 重试按钮样式

### Day 14 - TimeCalendar 改造

- [ ] **添加多日历徽章**
  - [ ] 创建 `MultiCalendarBadge` 组件
  - [ ] 显示日历图标 + 数量
  - [ ] 仅当 calendarIds.length > 1 时显示

- [ ] **实现悬停提示**
  - [ ] 使用 Ant Design Tooltip
  - [ ] 列出所有日历名称和同步状态
  - [ ] 格式化为清晰的列表

- [ ] **整体同步状态图标**
  - [ ] 计算整体状态（全部成功/部分失败/全部失败）
  - [ ] 显示对应图标（✅/⚠️/❌）

- [ ] **样式优化**
  - [ ] 徽章大小和位置
  - [ ] Tooltip 样式
  - [ ] 图标颜色

### Day 15 - UI 测试与调整

- [ ] **手动测试 EventEditModal**
  - [ ] 测试选择 1 个日历
  - [ ] 测试选择 3 个日历
  - [ ] 测试同步状态显示
  - [ ] 测试重试功能

- [ ] **手动测试 TimeCalendar**
  - [ ] 测试多日历徽章显示
  - [ ] 测试悬停提示
  - [ ] 测试状态图标

- [ ] **响应式测试**
  - [ ] 测试不同屏幕尺寸
  - [ ] 测试移动端（如果支持）

- [ ] **性能测试**
  - [ ] 渲染 100 个多日历事件（应该 < 500ms）

---

## 🧪 阶段 5：集成测试与优化（Day 16-18）

### Day 16 - 端到端测试

- [ ] **测试完整流程 1：创建多日历事件**
  - [ ] 在 EventEditModal 选择 3 个日历
  - [ ] 保存事件
  - [ ] 检查 Outlook 中是否有 3 个事件
  - [ ] 验证事件内容一致

- [ ] **测试完整流程 2：更新事件**
  - [ ] 修改事件内容
  - [ ] 验证 3 个日历都更新
  - [ ] 添加 1 个新日历
  - [ ] 验证新日历出现事件
  - [ ] 移除 1 个日历
  - [ ] 验证对应日历事件被删除

- [ ] **测试完整流程 3：删除事件**
  - [ ] 删除多日历事件
  - [ ] 验证所有日历中的事件都被删除

- [ ] **测试完整流程 4：部分失败恢复**
  - [ ] 模拟网络错误（某个日历同步失败）
  - [ ] 验证 UI 显示失败状态
  - [ ] 点击重试
  - [ ] 验证成功恢复

### Day 17 - 错误处理测试

- [ ] **网络失败测试**
  - [ ] 断网情况下创建事件
  - [ ] 验证事件保存到本地
  - [ ] 恢复网络后验证自动同步

- [ ] **API 限流测试**
  - [ ] 模拟 429 错误
  - [ ] 验证自动重试（指数退避）

- [ ] **部分日历失败测试**
  - [ ] 模拟某个日历 API 错误
  - [ ] 验证其他日历正常同步
  - [ ] 验证失败日历可重试

- [ ] **数据一致性测试**
  - [ ] 创建事件后立即关闭应用
  - [ ] 重启应用
  - [ ] 验证 fixOrphanedPendingEvents 正确处理

### Day 18 - 性能优化

- [ ] **性能基准测试**
  - [ ] 同步 100 个事件到 3 个日历（记录耗时）
  - [ ] 渲染 100 个多日历事件（记录耗时）
  - [ ] 内存占用监控

- [ ] **优化措施（如果需要）**
  - [ ] 实现请求限流（避免同时发送 100+ 请求）
  - [ ] 优化 IndexMap 更新逻辑
  - [ ] 减少不必要的 re-render

- [ ] **压力测试**
  - [ ] 测试 1000 个事件（边界情况）
  - [ ] 测试 10 个日历同步（边界情况）

---

## 📝 阶段 6：文档与发布（Day 19-21）

### Day 19 - 编写用户指南

- [ ] **创建 `MULTI_CALENDAR_SYNC_GUIDE.md`**
  - [ ] 功能介绍
  - [ ] 如何选择多个日历
  - [ ] 如何查看同步状态
  - [ ] 如何重试失败的日历
  - [ ] 常见问题 FAQ

- [ ] **添加截图**
  - [ ] EventEditModal 多选界面
  - [ ] 同步状态列表
  - [ ] TimeCalendar 多日历徽章

### Day 20 - 更新技术文档

- [ ] **更新 `EventService-Architecture.md`**
  - [ ] 反映新的数据结构
  - [ ] 更新同步流程图
  - [ ] 添加多日历章节

- [ ] **更新 `SYNC_MECHANISM_APPENDIX.md`**
  - [ ] 补充多日历同步说明
  - [ ] 更新状态机图
  - [ ] 添加性能数据

- [ ] **创建 `MULTI_CALENDAR_TECHNICAL_SPEC.md`**
  - [ ] 详细技术规范
  - [ ] API 参考
  - [ ] 数据结构定义
  - [ ] 迁移指南

### Day 21 - 代码审查与发布

- [ ] **自我代码审查**
  - [ ] 检查所有 TODO 注释
  - [ ] 移除调试代码
  - [ ] 统一代码风格
  - [ ] 优化变量命名

- [ ] **编写 Changelog**
  - [ ] 列出所有新功能
  - [ ] 列出 breaking changes（如果有）
  - [ ] 列出 bug 修复

- [ ] **准备发布**
  - [ ] 更新版本号（package.json）
  - [ ] 创建 Git tag（v2.0.0）
  - [ ] 编写 Release Notes
  - [ ] 部署到生产环境

- [ ] **发布后监控**
  - [ ] 监控错误日志
  - [ ] 监控性能指标
  - [ ] 收集用户反馈

---

## 🎯 验收标准

### 功能完整性

- [ ] ✅ 支持同步到 1-10 个日历
- [ ] ✅ CREATE 操作正确同步到所有日历
- [ ] ✅ UPDATE 操作正确处理日历变更
- [ ] ✅ DELETE 操作清理所有远程事件
- [ ] ✅ 部分失败时可单独重试
- [ ] ✅ 数据迁移成功率 > 99.9%

### 性能

- [ ] ✅ 同步 100 事件到 3 日历 < 30 秒
- [ ] ✅ UI 操作响应 < 500ms
- [ ] ✅ 内存增长 < 50MB

### 测试覆盖

- [ ] ✅ 单元测试覆盖率 > 80%
- [ ] ✅ 所有集成测试通过
- [ ] ✅ 所有端到端测试通过

### 代码质量

- [ ] ✅ 无 TypeScript 错误
- [ ] ✅ 无 ESLint 警告（critical/error）
- [ ] ✅ 代码审查通过

### 文档完整性

- [ ] ✅ 用户指南完整
- [ ] ✅ 技术文档完整
- [ ] ✅ Changelog 清晰

---

## 📌 注意事项

### 优先级规则

1. **P0 - 必须**：核心功能（CREATE/UPDATE/DELETE）
2. **P1 - 应该**：错误处理、重试机制
3. **P2 - 可以**：性能优化、UI 美化

### 每日检查点

- [ ] 每天结束前更新此 TODO
- [ ] 每天总结遇到的问题和解决方案
- [ ] 每 3 天回顾进度，调整计划

### 遇到阻塞时

1. 记录问题到 `BLOCKERS.md`
2. 寻找替代方案
3. 必要时调整计划

---

## 🔗 相关资源

- **需求文档**：`MULTI_CALENDAR_SYNC_REQUEST.md`
- **技术文档**：`EventService-Architecture.md`
- **测试计划**：待编写（Day 3）
- **Microsoft Graph API**：https://docs.microsoft.com/en-us/graph/api/resources/calendar

---

**最后更新**：2025-11-01  
**下次更新**：2025-11-02（开始 Day 1）

**加油！🚀**
