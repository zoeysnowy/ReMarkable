# EventEditModal 清理说明

## 清理时间
2025-11-21

## 保留的文件（正在使用）
- `src/components/EventEditModal.tsx` - 主应用正式使用的事件编辑模态框
- `src/components/EventEditModal.css` - 对应样式文件
- `src/components/EventEditModalV2Demo.tsx` - Zoey 的开发测试页面（包含"开始专注"按钮等功能）
- `src/components/EventEditModalV2Demo.css` - 对应样式文件

## 归档的文件
- `EventEditModalV2.tsx` - 之前开发的测试组件，已不使用
- `EventEditModalV2.css` - 对应样式文件
- `SyncComponentTest.tsx` - 同步组件测试，避免混淆

## 使用说明
- **主应用** 使用 `EventEditModal.tsx`（计时器事件编辑）
- **开发测试** 使用 `EventEditModalV2Demo.tsx`（Zoey 的工作页面）
- 如需添加日历同步功能，应该在 `EventEditModalV2Demo.tsx` 中进行，保持原有界面不变

## App.tsx 路由
- 'eventmodal-v2-demo' 页面类型 → `EventEditModalV2Demo` 组件
- `showEventEditModal` 状态 → `EventEditModal` 组件