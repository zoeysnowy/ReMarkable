/**
 * FloatingToolbar 类型定义
 */

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
  
  // 快捷操作
  | 'tag'           // # 标签选择器
  | 'emoji'         // Emoji 选择器
  | 'dateRange'     // 日期范围选择器
  | 'priority'      // 优先级设置
  | 'calendar'      // 日历映射
  | 'color'         // 颜色选择
  | 'link';         // 链接

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
}

export interface ToolbarPosition {
  top: number;
  left: number;
  show: boolean;
}
