export interface TimerSession {
  id: string;
  taskName: string;
  duration: number; // 持续时间（秒）
  startTime: string;    // 🔧 修改：使用字符串存储本地时间
  endTime: string;      // 🔧 修改：使用字符串存储本地时间
  completedAt: string;  // 🔧 修改：使用字符串存储本地时间
  description?: string; // 🆕 添加：描述内容
  tags?: string[];      // 🆕 添加：标签支持
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: string;    // 🔧 修改：使用字符串存储本地时间
  endTime: string;      // 🔧 修改：使用字符串存储本地时间
  isAllDay: boolean;
  location?: string;
  organizer?: {         // 🆕 添加：组织者信息
    name?: string;
    email?: string;
  };
  attendees?: Array<{   // 🆕 添加：与会者信息
    name?: string;
    email?: string;
    type?: string;      // required, optional, resource
    status?: string;    // accepted, declined, tentative, none
  }>;
  reminder?: number;
  externalId?: string;
  calendarId?: string;
  calendarIds?: string[]; // 🆕 添加：多日历分组支持
  source?: 'local' | 'outlook' | 'google' | 'icloud'; // 🆕 事件来源
  syncStatus?: 'pending' | 'synced' | 'error' | 'local-only'; // 🔧 unified: 'pending' 表示所有待同步状态（新建或更新）
  lastSyncTime?: string; // 🔧 修改：使用字符串存储本地时间
  createdAt: string;     // 🔧 修改：使用字符串存储本地时间
  updatedAt: string;     // 🔧 修改：使用字符串存储本地时间
  timerSessionId?: string;
  tagId?: string;        // 🔧 保留向后兼容，单标签模式
  tags?: string[];       // 🆕 添加：多标签支持
  category?: string;
  remarkableSource?: boolean;
  localVersion?: number;
  lastLocalChange?: string; // 🔧 修改：使用字符串存储本地时间
  // 🎯 事件类型标记（用于控制显示样式）
  isTimer?: boolean;     // 🆕 添加：标记为计时器事件
  isMilestone?: boolean; // 🆕 添加：标记为里程碑事件
  isTask?: boolean;      // 🆕 添加：标记为任务事件
  isPlan?: boolean;      // 🆕 添加：标记为计划页面事件
  // 🆕 统一时间规范（不破坏现有 startTime/endTime，作为"意图+解析"来源）
  timeSpec?: import('./types/time').TimeSpec;
  
  // 🔧 Plan 相关字段（从 PlanItem 合并）
  content?: string;      // 文本内容（用于富文本编辑）
  emoji?: string;        // emoji 图标
  color?: string;        // 自定义颜色
  dueDate?: string;      // 截止日期（用于任务类型）
  notes?: string;        // 备注
  priority?: 'low' | 'medium' | 'high' | 'urgent'; // 优先级
  isCompleted?: boolean; // 是否完成
  level?: number;        // 层级缩进（用于 Plan 页面显示）
  mode?: 'title' | 'description'; // 显示模式（title或description行）
  type?: 'todo' | 'task' | 'event'; // 事件类型（向后兼容）
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  dueDate?: string;      // 🔧 修改：使用字符串存储本地时间
  createdAt: string;     // 🔧 修改：使用字符串存储本地时间
  updatedAt: string;     // 🔧 修改：使用字符串存储本地时间
  tags?: string[];       // 🆕 添加：标签支持
}

export interface EventTag {
  id: string;
  name: string;
  color: string;
  category: 'personal' | 'work' | 'study' | 'ongoing' | 'other';
  createdAt: string;     // 🔧 修改：使用字符串存储本地时间
}

export interface GlobalTimer {
  id?: string;
  taskTitle?: string;
  eventTitle?: string;   // 事件标题
  tagId?: string;        // 标签ID
  startTime: number;     // Unix timestamp
  originalStartTime?: number; // 原始开始时间
  elapsedTime: number;   // 已经过的时间（秒）
  isRunning: boolean;    // 是否正在运行
  isPaused?: boolean;    // 是否暂停
  lastUpdateTime?: number; // 上次更新时间
}