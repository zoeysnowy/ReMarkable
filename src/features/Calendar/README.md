# Calendar Feature Module

Calendar 功能模块的所有代码都在这里。

## 📁 文件结构

```
src/features/Calendar/
├── TimeCalendar.tsx              # 核心日历组件（3000+ 行）
├── index.ts                      # 模块导出入口
├── components/                   # 子组件
│   ├── ToastUIReactCalendar.tsx # TUI Calendar React 包装器
│   ├── CalendarSync.tsx          # 同步状态显示
│   ├── CalendarSettingsPanel.tsx # 日历设置面板
│   ├── CalendarPicker.tsx        # 日历选择器
│   ├── CalendarMappingPicker.tsx # 标签-日历映射
│   └── CalendarGroupManager.tsx  # 日历分组管理
└── styles/                       # 样式文件
    ├── DesktopCalendarWidget.css # Desktop Widget 专用样式
    ├── CalendarSettingsPanel.css
    ├── CalendarPicker.css
    └── CalendarGroupManager.css
```

## 🔗 引用方式

```typescript
// 从模块根目录引入
import TimeCalendar from '@/features/Calendar/TimeCalendar';
import { CalendarSync, CalendarSettingsPanel } from '@/features/Calendar';

// 从 App.tsx 引入
import TimeCalendar from './features/Calendar/TimeCalendar';
```

## 🎯 设计原则

1. **模块化隔离**：Calendar 相关代码独立在 `features/Calendar` 目录
2. **lib 独立管理**：TUI Calendar 源码放在 `src/lib/tui.calendar/`
3. **清晰的层次**：
   - `TimeCalendar.tsx` - 核心组件
   - `components/` - 子组件
   - `styles/` - 样式文件

## 📝 注意事项

- **Desktop Widget 样式**：`styles/DesktopCalendarWidget.css` 包含 Electron 专用适配
- **不要混入其他模块**：保持 Calendar 模块的纯净性
- **统一导出**：通过 `index.ts` 导出，便于管理依赖关系
