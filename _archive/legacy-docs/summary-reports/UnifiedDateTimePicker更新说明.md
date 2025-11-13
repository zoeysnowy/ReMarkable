# UnifiedDateTimePicker 更新说明

## 最新更新 (2025-11-11)

### 视觉优化
- ✅ **全天按钮图标位置调整**：勾选框从文字右侧移到左侧
- ✅ **全天按钮选中图标**：使用 `task_color.svg` 彩色渐变图标（20×20px）
- ✅ **搜索图标更新**：从简单圆圈放大镜替换为 `Search.svg`（30×30px 搜索列表图标）
- ✅ **预览区高度统一**：preview-time-display 和 picker-preview-header 统一为 40px
- ✅ **快捷按钮容器高度**：调整为 40px（box-sizing: border-box）
- ✅ **日历底部间距优化**：使用 `margin-bottom: -20px` 收紧间距
- ✅ **圆角重叠修复**：
  - 主容器 `border-radius: 16px`
  - tippy-box 和 tippy-content 背景透明化
  - headless-picker-tippy-content 圆角从 12px → 16px
- ✅ **中文自然语言支持**：使用 `chrono.zh.parse()` 支持中文解析
- ✅ **调试日志增强**：添加详细的解析过程日志

### 新增图标组件
1. `icons/TaskColor.tsx` - 彩色任务完成图标（渐变色 #A855F7 → #3B82F6）
2. `icons/Search.tsx` - 更新为复杂搜索列表图标

### CSS 样式调整
```css
/* 主容器圆角 */
.unified-datetime-picker {
  border-radius: 16px;
  overflow: hidden;
}

/* 预览区高度统一 */
.picker-preview-header {
  height: 40px;
  padding: 8px 20px;
}

/* 快捷按钮容器 */
.quick-buttons-container {
  padding: 6.5px 5px;
  height: 40px;
  box-sizing: border-box;
}

/* 收紧底部间距 */
.main-content {
  margin-bottom: -20px;
}

/* 透明化内部背景，避免圆角重叠 */
.calendar-section,
.time-section {
  background: transparent;
}

/* Tippy 容器透明化 */
.tippy-box[data-theme~='light'] {
  background-color: transparent;
  border-radius: 16px;
  box-shadow: none;
}

.tippy-box[data-theme~='light'] .tippy-content {
  background: transparent;
  border-radius: 16px;
}

.headless-picker-tippy-content {
  background: transparent;
  border: none;
  border-radius: 16px;
  box-shadow: none;
}
```

### 全天按钮结构更新
```tsx
<button className={`all-day-button ${allDay ? 'active' : ''}`}>
  {allDay ? (
    <TaskColorIcon className="all-day-icon" />
  ) : (
    <div className="all-day-checkbox"></div>
  )}
  <span>全天</span>
</button>
```

### chrono 中文支持
```typescript
const handleSearchBlur = () => {
  // 使用 chrono.zh 支持中文解析
  const parsed = chrono.zh.parse(searchInput, new Date(), { forwardDate: true });
  dbg('picker', '🔍 Chrono 解析结果', { parsed, count: parsed.length });
  
  if (parsed.length > 0) {
    // 解析成功，更新日期和时间
  } else {
    warn('picker', '⚠️ Chrono 无法解析该输入', { input: searchInput });
  }
};
```

## 已完成的功能

### 1. chrono 自然语言输入框
- ✅ 安装 chrono-node 依赖
- ✅ 添加搜索输入框组件
- ✅ 集成 chrono 解析引擎
- ✅ 支持中文自然语言输入（如"明天下午3点"、"下周五9:00"）
- ✅ 自动填充日期和时间选择器
- ✅ Enter键触发解析
- ✅ **搜索框边框渐变色** (linear-gradient(90deg, #A855F7 0%, #3B82F6 75.48%))

**使用示例**:
- "明天下午3点" → 自动设置明天的15:00
- "下周一上午9点" → 自动设置下周一的09:00
- "3天后" → 自动设置3天后的日期

### 2. 全天按钮 (圆形勾选框设计)
- ✅ 添加全天切换按钮
- ✅ **圆形勾选框设计**（16px 圆形边框）
- ✅ 切换到全天模式时自动清除时间
- ✅ 切换到非全天模式时设置默认时间（9:00-10:00）
- ✅ **选中状态显示彩色渐变图标** (task_color.svg, 20×20px)
- ✅ **图标位置：文字左侧**（最新调整）
- ✅ 未选中状态显示灰色圆形边框（16px）

### 3. SVG 图标组件
- ✅ 创建 SearchIcon 组件（**更新为 Search.svg，30×30px 搜索列表图标**）
- ✅ 创建 TaskColorIcon 组件（**彩色渐变图标，20×20px，用于全天按钮选中状态**）
- ✅ 创建 TaskGrayIcon 组件（日历图标，16×16px，未使用）
- ✅ 图标集成到输入框和全天按钮

### 4. 设计规范应用
- ✅ 容器样式：毛玻璃效果 + 白色半透明背景
- ✅ 搜索框样式：287px宽，**渐变色边框**（紫色→蓝色），圆角25px
- ✅ 快捷按钮选中状态：青蓝渐变色（#22d3ee → #3b82f6）
- ✅ 阴影效果优化
- ✅ **保持紧凑间距**（未变疏松）
- ✅ **圆角统一**：主容器、tippy-box、tippy-content 统一为 16px
- ✅ **透明化内部背景**：避免多层背景叠加造成圆角重叠

### 5. 中文自然语言支持
- ✅ 使用 `chrono.zh.parse()` 支持中文输入
- ✅ 支持"明天下午3点"、"后天上午9点"等中文表达
- ✅ 添加详细的解析过程日志
- ✅ Enter 键触发解析
- ✅ 解析失败时显示警告日志

## 设计细节修正

### 搜索框渐变边框实现
使用 CSS mask 技术实现渐变边框：
```css
.search-input-wrapper::before {
  background: linear-gradient(90deg, #A855F7 0%, #3B82F6 75.48%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}
```

### 全天按钮圆形勾选框
```css
.all-day-checkbox {
  width: 16px;
  height: 16px;
  border: 2px solid #9ca3af;
  border-radius: 50%;
}

.all-day-button.active .all-day-checkbox {
  background: linear-gradient(90deg, #22d3ee, #3b82f6);
  border-color: transparent;
}

.all-day-checkbox::after {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
}
```

## 文件变更

### 新增文件
1. `src/components/FloatingToolbar/pickers/icons/Search.tsx` - 搜索图标组件（**已更新为 Search.svg**）
2. `src/components/FloatingToolbar/pickers/icons/TaskColor.tsx` - **彩色任务图标组件（新增）**
3. `src/components/FloatingToolbar/pickers/icons/TaskGray.tsx` - 日历图标组件（未使用）

### 修改文件
1. `src/components/FloatingToolbar/pickers/UnifiedDateTimePicker.tsx`
   - 导入 chrono-node
   - 导入图标组件（Search, TaskColor, TaskGray）
   - 添加 searchInput 和 allDay 状态
   - **添加 handleSearchBlur 函数，使用 chrono.zh.parse() 支持中文**
   - 添加详细的解析日志（dbg, warn, error）
   - 添加 toggleAllDay 全天切换函数
   - 在顶部预览区域下方添加搜索框和全天按钮
   - **全天按钮结构：图标在左，文字在右**
   - **选中状态显示 TaskColorIcon，未选中显示灰色圆形边框**

2. `src/components/FloatingToolbar/pickers/UnifiedDateTimePicker.css`
   - 更新主容器样式（毛玻璃效果，border-radius: 16px）
   - **调整预览区高度为 40px**（padding: 8px 20px）
   - **调整快捷按钮容器高度为 40px**（padding: 6.5px 5px）
   - 添加 .search-container 样式（紧凑间距：padding 15px 25px 10px）
   - 添加 .search-input-wrapper 样式（287px 固定宽度）
   - **添加渐变边框伪元素** (::before with mask)
   - 添加 .search-input 样式
   - **更新全天按钮样式**：
     - `.all-day-icon`: 20×20px 彩色图标
     - `.all-day-checkbox`: 16×16px 灰色圆形边框
   - **收紧日历底部间距**：`.main-content { margin-bottom: -20px; }`
   - **透明化内部背景**：
     - `.calendar-section { background: transparent; }`
     - `.time-section { background: transparent; }`

3. `src/components/PlanManager.css`
   - **修复 tippy-box 圆角重叠问题**：
     - `.tippy-box[data-theme~='light']`: background-color: transparent, border-radius: 16px, box-shadow: none
     - `.tippy-box[data-theme~='light'] .tippy-content`: background: transparent, border-radius: 16px

4. `package.json`
   - 添加 chrono-node 依赖（使用 --legacy-peer-deps 安装）

## 技术细节

### chrono 解析逻辑
```typescript
const handleSearchBlur = () => {
  if (!searchInput.trim()) {
    dbg('picker', '🔍 搜索输入为空，跳过解析');
    return;
  }
  
  dbg('picker', '🔍 开始解析自然语言', { input: searchInput });
  
  try {
    // 使用 chrono.zh 支持中文解析
    const parsed = chrono.zh.parse(searchInput, new Date(), { forwardDate: true });
    dbg('picker', '🔍 Chrono 解析结果', { parsed, count: parsed.length });
    
    if (parsed.length > 0) {
      const result = parsed[0];
      const start = dayjs(result.start.date());
      setSelectedDates({ start, end: start });
      
      // 如果解析出时间，设置 startTime
      if (result.start.get('hour') !== undefined && result.start.get('hour') !== null) {
        setStartTime({
          hour: result.start.get('hour')!,
          minute: result.start.get('minute') || 0
        });
        setAllDay(false);
      }
      
      // 如果解析出结束时间
      if (result.end) {
        const end = dayjs(result.end.date());
        setSelectedDates(prev => ({ ...prev, end }));
        setEndTime({
          hour: result.end.get('hour') || 23,
          minute: result.end.get('minute') || 59
        });
      }
      
      setScrollTrigger(prev => prev + 1);
      setSelectedQuickBtn(null);
      dbg('picker', '🔍 Chrono 解析成功', { input: searchInput, parsedDate: start.format('YYYY-MM-DD HH:mm') });
    } else {
      warn('picker', '⚠️ Chrono 无法解析该输入', { input: searchInput });
    }
  } catch (err) {
    error('picker', '❌ Chrono 解析异常', { input: searchInput, error: err });
  }
};
```

### 全天按钮逻辑
```typescript
const toggleAllDay = () => {
  if (newAllDay) {
    // 全天模式：清除时间
    setStartTime(null);
    setEndTime(null);
  } else {
    // 非全天模式：设置默认时间
    setStartTime({ hour: 9, minute: 0 });
    setEndTime({ hour: 10, minute: 0 });
  }
};
```

### 全天按钮 JSX 结构
```tsx
<button 
  className={`all-day-button ${allDay ? 'active' : ''}`}
  onClick={toggleAllDay}
>
  {allDay ? (
    <TaskColorIcon className="all-day-icon" />
  ) : (
    <div className="all-day-checkbox"></div>
  )}
  <span>全天</span>
</button>
```

### 全天按钮样式
```css
/* 全天按钮基础样式 */
.all-day-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
}

/* 彩色图标（选中状态） */
.all-day-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* 灰色圆形边框（未选中状态） */
.all-day-checkbox {
  width: 16px;
  height: 16px;
  border: 2px solid #9ca3af;
  border-radius: 50%;
  flex-shrink: 0;
}
```

## 间距说明（未变疏松）

- 搜索框容器: `padding: 15px 25px 10px`（顶部15px，左右25px，底部10px）
- 快捷按钮容器: `padding: 6.5px 5px; height: 40px`（紧凑设计）
- 主内容区域: `gap: 1px; margin-bottom: -20px`（保持紧凑 + 收紧底部）
- 日历区域: `padding: 0px 10px 8px 20px`（保持原有间距）
- 时间区域: `padding: 0px 20px 0px 10px`（保持原有间距）
- 预览区: `height: 40px; padding: 8px 20px`（统一高度）

## 测试建议

1. **自然语言解析测试**:
   - 输入"明天下午3点"并按Enter
   - 输入"下周一上午9点"
   - 输入"3天后18:00"
   - 输入"后天下午2点半"
   - 验证日期和时间是否正确填充
   - **检查控制台是否有详细的解析日志**

2. **全天按钮测试**:
   - 点击"全天"按钮，验证时间列是否清空
   - **检查是否显示彩色渐变图标（task_color.svg）**
   - 再次点击，验证是否设置默认时间9:00-10:00
   - **检查是否显示灰色圆形边框**
   - **验证图标在文字左侧**

3. **样式测试**:
   - **检查搜索框边框是否为紫色到蓝色的渐变**
   - **检查搜索图标是否为 30×30px 的搜索列表图标**
   - 检查快捷按钮选中时的渐变色
   - 检查毛玻璃效果
   - **验证预览区和快捷按钮区高度是否统一为 40px**
   - **验证整体间距是否紧凑（未变疏松）**
   - **检查圆角是否统一为 16px，无重叠效果**
   - **检查 tippy-box 底部是否有白色裸露（应该没有）**

4. **日志测试**:
   - 打开控制台
   - 输入自然语言并按 Enter
   - 查看是否有 `🔍 开始解析自然语言` 日志
   - 查看是否有 `🔍 Chrono 解析结果` 日志
   - 验证解析成功或失败的提示

## 注意事项

- chrono-node 使用 --legacy-peer-deps 安装以绕过 React 19 依赖冲突
- SVG 图标使用内联方式，无需外部图片资源
- 全天状态与 TimeHub 的 allDay 字段保持同步
- **自然语言解析使用 chrono.zh.parse() 支持中文输入**
- 自然语言解析使用 forwardDate: true 确保未来日期优先
- **搜索框边框使用渐变色，非纯色**
- **全天按钮图标在文字左侧，选中显示彩色图标**
- **保持原有紧凑间距，未变疏松**
- **主容器和 tippy 相关容器圆角统一为 16px**
- **内部背景透明化，避免圆角重叠视觉效果**
- **添加详细的调试日志，便于排查解析问题**

## 调试技巧

### 启用 picker 模块日志
在控制台运行：
```javascript
localStorage.setItem('debug_picker', 'true');
```

### 查看解析日志
- `🔍 开始解析自然语言` - 解析开始
- `🔍 Chrono 解析结果` - 解析结果和数量
- `🔍 Chrono 解析成功` - 解析成功，显示解析后的日期
- `⚠️ Chrono 无法解析该输入` - 解析失败
- `❌ Chrono 解析异常` - 解析出错

### 常见问题
1. **输入中文无反应**: 确认使用 `chrono.zh.parse()` 而非 `chrono.parse()`
2. **圆角重叠**: 确认 tippy-box 和内部元素背景都设置为 transparent
3. **间距变大**: 检查是否误增加了 padding 或 margin（应使用负 margin 收紧）
4. **图标不显示**: 检查 TaskColorIcon 组件是否正确导入和使用

## 文件清单

### 组件文件
- `UnifiedDateTimePicker.tsx` - 主组件（约 1112 行）
- `UnifiedDateTimePicker.css` - 样式文件（约 1081 行）
- `icons/Search.tsx` - 搜索图标（30×30px）
- `icons/TaskColor.tsx` - 彩色任务图标（20×20px）
- `icons/TaskGray.tsx` - 灰色任务图标（16×16px，未使用）

### 相关样式文件
- `PlanManager.css` - 包含 tippy-box 主题样式

### 依赖
- `chrono-node@2.9.0` - 自然语言日期解析库
