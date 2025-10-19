# TimeCalendar 功能测试指南

## 📅 测试环境

**ReMarkable v1.0.0 - 时光日历 (TUI Calendar 集成版)**

测试日期: 2025年10月17日
组件: `src/components/TimeCalendar.tsx`

---

## ✅ 已完成功能清单

### 1. 基础架构 ✅
- [x] UTF-8 编码支持
- [x] Microsoft YaHei 字体
- [x] ReMarkable 紫色渐变主题
- [x] 响应式设计
- [x] 自定义 CSS 样式 (`src/styles/calendar.css`)

### 2. 数据层 ✅
- [x] 事件数据转换工具 (`src/utils/calendarUtils.ts`)
- [x] Event ↔️ TUI Calendar EventObject 双向转换
- [x] 标签系统集成 (hierarchicalTags)
- [x] 日历分组映射 (calendarMapping)

### 3. 同步机制 ✅
- [x] ActionBasedSyncManager 集成
- [x] 监听 `action-sync-completed` 事件
- [x] 监听 `outlook-sync-completed` 事件
- [x] 监听 `local-events-changed` 事件
- [x] 自动刷新事件列表

### 4. CRUD 操作 ✅
- [x] 创建事件 (onBeforeCreateEvent)
- [x] 更新事件 (onBeforeUpdateEvent) - 支持拖拽
- [x] 删除事件 (onBeforeDeleteEvent)
- [x] 点击事件查看详情 (onClickEvent)

### 5. UI/UX ✅
- [x] 月/周/日视图切换
- [x] 前/今天/后导航按钮
- [x] 事件计数显示
- [x] 最后同步时间显示
- [x] 描述编辑器集成

---

## 🧪 测试用例

### 测试环境准备

1. **启动应用**
   ```bash
   npm start
   ```

2. **打开浏览器控制台**
   - 按 F12 或右键 → 检查
   - 查看控制台日志（带有 [TimeCalendar] 前缀）

3. **确认 syncManager 可用**
   ```javascript
   // 在控制台执行
   window.syncManager
   ```

---

### 测试场景 1: 创建事件

#### 1.1 通过日历界面创建事件

**操作步骤**:
1. 在 TimeCalendar 页面
2. 点击日历上的某个日期或时间槽
3. 填写事件表单（如果弹出）
4. 保存事件

**预期结果**:
- ✅ 控制台显示: `✨ [TimeCalendar] Creating event:`
- ✅ 事件出现在日历上
- ✅ 事件计数增加
- ✅ localStorage 中保存事件数据
- ✅ 控制台显示: `✅ [TimeCalendar] Event created and synced`

**验证**:
```javascript
// 控制台检查
JSON.parse(localStorage.getItem('remarkable-events'))
```

#### 1.2 验证与 UnifiedTimeline 的数据一致性

**操作步骤**:
1. 在 TimeCalendar 创建事件
2. 切换到 UnifiedTimeline 页面

**预期结果**:
- ✅ UnifiedTimeline 显示新创建的事件
- ✅ 事件详情一致（标题、时间、描述）

---

### 测试场景 2: 编辑事件

#### 2.1 拖拽调整事件时间

**操作步骤**:
1. 在日历上拖拽一个事件到新的时间
2. 观察控制台日志

**预期结果**:
- ✅ 控制台显示: `📝 [TimeCalendar] Updating event:`
- ✅ 事件移动到新位置
- ✅ localStorage 更新
- ✅ 控制台显示: `✅ [TimeCalendar] Event updated and synced`

#### 2.2 通过描述编辑器编辑

**操作步骤**:
1. 点击日历上的事件
2. 描述编辑器弹出
3. 修改描述内容
4. 保存

**预期结果**:
- ✅ 描述编辑器正常打开
- ✅ 显示当前事件标题和描述
- ✅ 保存后控制台显示: `💾 [TimeCalendar] Saving description for event:`
- ✅ 描述编辑器关闭
- ✅ 同步到 Outlook

**验证同步**:
- 切换到 UnifiedTimeline，查看描述是否更新
- 检查 Outlook 日历（如果已连接）

---

### 测试场景 3: 删除事件

#### 3.1 删除单个事件

**操作步骤**:
1. 右键点击事件（或通过 TUI Calendar 的删除按钮）
2. 确认删除

**预期结果**:
- ✅ 控制台显示: `🗑️ [TimeCalendar] Deleting event:`
- ✅ 事件从日历消失
- ✅ 事件计数减少
- ✅ localStorage 更新
- ✅ 控制台显示: `✅ [TimeCalendar] Event deleted and synced`

**验证双向同步**:
- 检查 UnifiedTimeline：事件应该已删除
- 检查 Outlook 日历：事件应该已删除

---

### 测试场景 4: 同步测试

#### 4.1 Outlook → ReMarkable 同步

**操作步骤**:
1. 在 Outlook 日历中创建新事件
2. 等待自动同步（或手动触发同步）
3. 观察 TimeCalendar

**预期结果**:
- ✅ 控制台显示: `🔄 [TimeCalendar] Sync completed, reloading events`
- ✅ 新事件出现在 TimeCalendar
- ✅ 事件颜色根据标签显示

#### 4.2 ReMarkable → Outlook 同步

**操作步骤**:
1. 在 TimeCalendar 创建事件
2. 打开 Outlook 日历
3. 检查事件是否出现

**预期结果**:
- ✅ 事件出现在 Outlook 对应的日历分组中
- ✅ 事件详情正确（标题、时间、描述、位置）

---

### 测试场景 5: 标签与日历分组

#### 5.1 标签颜色映射

**操作步骤**:
1. 在标签管理中创建不同颜色的标签
2. 创建事件并分配标签
3. 查看日历

**预期结果**:
- ✅ 事件显示对应的标签颜色
- ✅ 日历图例显示所有标签
- ✅ 可以按标签筛选事件

#### 5.2 日历分组同步

**操作步骤**:
1. 为标签配置 Outlook 日历映射
2. 创建事件并分配该标签
3. 检查 Outlook

**预期结果**:
- ✅ 事件同步到对应的 Outlook 日历分组
- ✅ 不是默认日历

---

### 测试场景 6: 视图切换

#### 6.1 月视图

**操作步骤**:
1. 点击"月"按钮

**预期结果**:
- ✅ 显示整月日历
- ✅ 事件以卡片形式显示
- ✅ 今天高亮显示
- ✅ 周末背景色不同

#### 6.2 周视图

**操作步骤**:
1. 点击"周"按钮

**预期结果**:
- ✅ 显示一周时间表
- ✅ 事件显示在时间轴上
- ✅ 可以看到事件持续时间

#### 6.3 日视图

**操作步骤**:
1. 点击"日"按钮

**预期结果**:
- ✅ 显示单日详细时间线
- ✅ 每小时分隔显示
- ✅ 事件精确定位

---

### 测试场景 7: 数据一致性

#### 7.1 TimeCalendar ↔️ UnifiedTimeline

**操作步骤**:
1. 在 TimeCalendar 创建事件
2. 切换到 UnifiedTimeline
3. 修改事件
4. 切换回 TimeCalendar

**预期结果**:
- ✅ 数据实时同步
- ✅ 没有数据丢失
- ✅ 时间格式正确

---

## 🐛 已知问题和注意事项

### 1. 时区处理
- ⚠️ 确保使用 `parseLocalTimeString` 和 `formatTimeForStorage`
- ⚠️ 避免使用 `new Date(event.startTime)` 直接转换

### 2. 事件创建表单
- ℹ️ TUI Calendar 默认表单可能需要自定义
- ℹ️ 可以通过 `useFormPopup={false}` 禁用默认表单

### 3. 描述编辑器
- ℹ️ 目前不支持 tags 数组编辑
- ℹ️ tagId 保持不变

---

## 🔍 调试技巧

### 查看所有事件
```javascript
JSON.parse(localStorage.getItem('remarkable-events'))
```

### 查看标签配置
```javascript
ReMarkableCache.tags.getTags()
```

### 查看扁平化标签
```javascript
ReMarkableCache.tags.getFlatTags()
```

### 手动触发同步
```javascript
window.syncManager.syncAllPendingActions()
```

### 监听同步事件
```javascript
window.addEventListener('action-sync-completed', (e) => {
  console.log('✅ Sync completed', e);
});
```

---

## ✨ 测试完成检查清单

- [ ] 创建事件 - 正常工作
- [ ] 编辑事件 - 正常工作
- [ ] 删除事件 - 正常工作
- [ ] 拖拽事件 - 正常工作
- [ ] 点击事件查看详情 - 正常工作
- [ ] 描述编辑器 - 正常工作
- [ ] 月/周/日视图切换 - 正常工作
- [ ] 标签颜色显示 - 正常工作
- [ ] 日历分组 - 正常工作
- [ ] 与 UnifiedTimeline 数据一致 - 正常工作
- [ ] 与 Outlook 双向同步 - 正常工作
- [ ] CSS 样式正确 - 正常工作
- [ ] 中文显示正确 - 正常工作
- [ ] 响应式设计 - 正常工作

---

## 📊 性能测试

### 大量事件测试

**创建测试数据**:
```javascript
// 在控制台执行
const testEvents = [];
for (let i = 0; i < 100; i++) {
  testEvents.push({
    id: `test-${Date.now()}-${i}`,
    title: `测试事件 ${i}`,
    description: `这是第 ${i} 个测试事件`,
    startTime: new Date(Date.now() + i * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + (i + 1) * 60 * 60 * 1000).toISOString(),
    isAllDay: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}
localStorage.setItem('remarkable-events', JSON.stringify(testEvents));
window.location.reload();
```

**预期结果**:
- ✅ 日历渲染流畅
- ✅ 视图切换无卡顿
- ✅ 事件数量显示正确

---

## 📝 测试报告模板

```markdown
## TimeCalendar 测试报告

**测试日期**: 2025-10-17
**测试人员**: [Your Name]
**版本**: v1.0.0

### 测试环境
- 浏览器: Chrome 118
- 操作系统: Windows 11
- Node.js: v18.x

### 测试结果

#### 功能测试
- [x] 创建事件: ✅ 通过
- [ ] 编辑事件: ❌ 失败 - 原因
- ...

#### 性能测试
- 100个事件渲染时间: 500ms
- 内存占用: 50MB

#### 兼容性测试
- Chrome: ✅
- Firefox: ✅
- Safari: ✅
- Edge: ✅

### 发现的问题
1. ...
2. ...

### 建议
1. ...
2. ...
```

---

## 🎉 完成！

恭喜！TimeCalendar 的 TUI Calendar 集成已经完成。现在可以享受美观、强大的日历界面，同时保持与 UnifiedTimeline 和 Outlook 的完美同步！
