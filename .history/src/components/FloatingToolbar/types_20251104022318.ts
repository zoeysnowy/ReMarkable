/**
 * FloatingToolbar 类型定义
 */

// 🆕 FloatingBar 显示模式
export type FloatingBarMode = 
  | 'hidden'              // 隐藏状态
  | 'menu_floatingbar'    // 完整菜单模式（双击 Alt 触发）- 显示 quick-action 菜单
  | 'text_floatingbar';   // 文本格式模式（选中文字触发）- 显示 text-format 菜单

// 🔄 保留向后兼容，但推荐使用 FloatingBarMode
export type ToolbarMode = 'quick-action' | 'text-format';

export interface ToolbarFeature {
  id: string;
  icon: React.ReactNode | string;
  label: string;
  onClick: () => void;
  type?: 'button' | 'picker' | 'menu';
}

export interface ToolbarConfig {
  mode: ToolbarMode;
  features: ToolbarFeatureType[];
}

export type ToolbarFeatureType =
  // 文本格式
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'highlight'
  | 'clearFormat'
  | 'bullet'        // 项目符号开关
  | 'indent'        // 缩进（Tab）
  | 'outdent'       // 取消缩进（Shift+Tab）
  | 'collapse'      // 收起当前项（Ctrl+↑）
  | 'expand'        // 展开当前项（Ctrl+↓）
  
  // 快捷操作
  | 'tag'           // # 标签选择器
  | 'emoji'         // Emoji 选择器
  | 'dateRange'     // 日期范围选择器
  | 'priority'      // 优先级设置
  | 'calendar'      // 日历映射
  | 'color'         // 颜色选择
  | 'link'          // 链接
  | 'addTask';      // 🆕 任务开关（控制 checkbox 显示）

export interface FloatingToolbarProps {
  position: {
    top: number;
    left: number;
    show: boolean;
  };
  
  config: ToolbarConfig;
  
  // 回调函数
  onTextFormat?: (command: string, value?: string) => void;
  onTagSelect?: (tagIds: string[]) => void; // 改为数组（支持多选）
  onEmojiSelect?: (emoji: string) => void;
  onDateRangeSelect?: (startDate: Date, endDate: Date) => void;
  onPrioritySelect?: (priority: 'low' | 'medium' | 'high' | 'urgent') => void;
  onColorSelect?: (color: string) => void;
  onTaskToggle?: (isTask: boolean) => void; // 🆕 任务开关回调
  onTimeApplied?: (startIso: string, endIso?: string, allDay?: boolean) => void; // 🆕 TimeHub 模式下，时间写入完成后的回调（用于插入可视化/保存非时间字段）
  
  // 数据源
  availableTags?: Array<{
    id: string;
    name: string;
    color: string;
    emoji?: string;
    level?: number;
    parentId?: string;
  }>; // 改为层级标签
  currentTags?: string[]; // 保持 ID 数组
  currentIsTask?: boolean; // 🆕 当前是否为任务状态
  
  // 键盘控制
  activePickerIndex?: number | null; // 通过数字键激活的 picker 索引

  // 🆕 TimeHub 集成
  eventId?: string;       // 当前上下文的事件/行 ID，用于 UnifiedDateTimePicker 通过 TimeHub 读写
  useTimeHub?: boolean;   // 是否启用 TimeHub 模式
}

export interface ToolbarPosition {
  top: number;
  left: number;
  show: boolean;
}
