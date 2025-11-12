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

/**
 * 同步状态枚举
 * 用于标识事件的同步状态
 */
export enum SyncStatus {
  /** 本地创建，仅存储在本地，不同步到云端（如运行中的Timer） */
  LOCAL_ONLY = 'local-only',
  /** 等待同步到云端 */
  PENDING = 'pending',
  /** 已成功同步到 Outlook */
  SYNCED = 'synced',
  /** 同步冲突（本地和云端都有修改） */
  CONFLICT = 'conflict',
  /** 同步失败 */
  ERROR = 'error'
}

/**
 * 同步状态类型（向后兼容）
 */
export type SyncStatusType = 'pending' | 'synced' | 'error' | 'local-only' | 'conflict';

/**
 * 联系人平台来源
 */
export type ContactSource = 'remarkable' | 'outlook' | 'google' | 'icloud';

/**
 * 参会人类型
 */
export type AttendeeType = 'required' | 'optional' | 'resource';

/**
 * 参会人响应状态
 */
export type AttendeeStatus = 'accepted' | 'declined' | 'tentative' | 'none';

/**
 * 统一的联系人接口
 * 支持 ReMarkable 本地联系人和各云平台联系人
 */
export interface Contact {
  /** 联系人 ID */
  id?: string;
  /** 姓名 */
  name?: string;
  /** 邮箱地址 */
  email?: string;
  /** 电话号码 */
  phone?: string;
  /** 头像 URL */
  avatarUrl?: string;
  /** 所属组织/公司 */
  organization?: string;
  /** 平台来源标识 */
  isReMarkable?: boolean;
  isOutlook?: boolean;
  isGoogle?: boolean;
  isiCloud?: boolean;
  /** 参会人相关属性（当作为 Event.attendees 使用时） */
  type?: AttendeeType;
  status?: AttendeeStatus;
  /** 外部平台的原始 ID */
  externalId?: string;
  /** 备注信息 */
  notes?: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: string;    // 🔧 修改：使用字符串存储本地时间
  endTime: string;      // 🔧 修改：使用字符串存储本地时间
  isAllDay: boolean;
  location?: string;
  organizer?: Contact;  // 🔧 修改：使用统一的 Contact 接口
  attendees?: Contact[]; // 🔧 修改：使用统一的 Contact 接口
  reminder?: number;
  externalId?: string;
  calendarIds?: string[]; // 🆕 多日历分组支持
  source?: 'local' | 'outlook' | 'google' | 'icloud'; // 🆕 事件来源
  syncStatus?: SyncStatusType; // 🔧 unified: 'pending' 表示所有待同步状态（新建或更新）
  lastSyncTime?: string; // 🔧 修改：使用字符串存储本地时间
  createdAt: string;     // 🔧 修改：使用字符串存储本地时间
  updatedAt: string;     // 🔧 修改：使用字符串存储本地时间
  timerSessionId?: string;
  tags?: string[];       // 🆕 多标签支持
  category?: string;
  remarkableSource?: boolean;
  localVersion?: number;
  lastLocalChange?: string; // 🔧 修改：使用字符串存储本地时间
  // 🎯 事件类型标记（用于控制显示样式）
  isTimer?: boolean;     // 🆕 添加：标记为计时器事件
  isDeadline?: boolean; // 🆕 添加：标记为截止日期事件
  isTask?: boolean;      // 🆕 添加：标记为任务事件
  isPlan?: boolean;      // 🆕 添加：标记为计划页面事件
  isTimeCalendar?: boolean; // 🆕 添加：标记为 TimeCalendar 页面创建的事件
  // 🆕 统一时间规范（不破坏现有 startTime/endTime，作为"意图+解析"来源）
  timeSpec?: import('./types/time').TimeSpec;
  displayHint?: string | null; // 🆕 v1.1: 模糊时间表述（"本周"、"下周"等），用于保留用户原始输入
  
  // 🆕 v2.6: 模糊日期与时间字段状态
  isFuzzyDate?: boolean;  // 是否为模糊日期（"下周"、"本周"等快捷按钮生成）
  timeFieldState?: [number, number, number, number];  // [startTime, endTime, dueDate, allDay] - 1=用户设置，0=未设置/默认
  
  // 🆕 v2.7: 模糊时间段支持
  isFuzzyTime?: boolean;  // 是否为模糊时间段（"上午"、"下午"、"晚上"等）
  fuzzyTimeName?: string; // 模糊时间段名称（用于显示，如"上午"）
  
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
  
  // 🆕 v1.8: Rich-text description support
  timelog?: string;      // 富文本日志（HTML 格式，ReMarkable 内部展示用，支持标签、图片等）
  
  // 🆕 Issue #12: Timer ↔ Plan 集成
  parentEventId?: string;   // 父事件 ID（用于 Timer 子事件关联）
  timerLogs?: string[];     // 计时日志（子 Timer 事件 ID 列表）
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
  tagId: string;         // 主标签 ID（为向后兼容保留，但始终从 tags[0] 同步）
  tags?: string[];       // 🆕 v1.8: 多标签支持
  tagName: string;       // 标签名称
  tagEmoji?: string;     // 标签图标
  tagColor?: string;     // 标签颜色
  eventEmoji?: string;   // 事件图标
  eventId?: string;      // 关联的事件 ID
  parentEventId?: string;  // 🆕 Issue #12: 关联的父事件 ID（Timer 子事件关联到的父事件）
  startTime: number;     // Unix timestamp
  originalStartTime: number; // 原始开始时间
  elapsedTime: number;   // 已经过的时间（毫秒）
  isRunning: boolean;    // 是否正在运行
  isPaused: boolean;     // 是否暂停
}