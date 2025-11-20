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
 * 附件元数据
 * 用于 Event.eventlog.attachments
 */
export interface Attachment {
  id: string;
  filename: string;
  size: number;              // 文件大小（字节）
  mimeType: string;          // MIME 类型
  localPath?: string;        // 本地路径（Electron userData/attachments/）
  cloudUrl?: string;         // 云端 URL（OneDrive）
  status: 'local-only' | 'synced' | 'pending-upload' | 'cloud-only' | 'upload-failed';
  uploadedAt: string;        // 上传时间
  lastAccessedAt?: string;   // 最后访问时间
  isPinned?: boolean;        // 是否固定（不自动清理）
}

/**
 * EventLog 版本快照
 * 用于版本控制和冲突解决
 */
export interface EventLogVersion {
  id: string;
  createdAt: string;         // 版本创建时间
  content: string;           // Slate JSON 快照
  diff?: any;                // Delta（可选，用于压缩存储）
  triggerType: 'auto' | 'manual' | 'sync' | 'conflict-resolved';
  changesSummary?: string;   // 变更摘要（如 "添加 3 段，删除 1 段"）
  contentHash?: string;      // SHA-256 哈希
}

/**
 * EventLog 同步状态
 */
export interface EventLogSyncState {
  lastSyncedAt?: string;     // 最后同步时间
  contentHash?: string;      // 内容哈希（用于冲突检测）
  status?: 'pending' | 'synced' | 'conflict';
}

/**
 * EventLog 完整结构
 * 用于 Event.eventlog 字段（重构后）
 */
export interface EventLog {
  content: string;              // Slate JSON 字符串（主存储，用户编辑）
  descriptionHtml?: string;     // HTML（自动从 content 生成，用于 Outlook 同步）
  descriptionPlainText?: string; // 纯文本（用于搜索）
  attachments?: Attachment[];   // 附件列表
  versions?: EventLogVersion[]; // 版本历史（最多 50 个）
  syncState?: EventLogSyncState; // 同步状态
  createdAt?: string;
  updatedAt?: string;
}

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
 * 计划安排同步配置类型
 */
export type PlanSyncMode = 
  | 'receive-only'           // 只接收
  | 'send-only'              // 只发送（全部参会人）
  | 'send-only-private'      // 只发送（仅自己）⭐ 新增
  | 'bidirectional'          // 双向同步（全部参会人）
  | 'bidirectional-private'; // 双向同步（仅自己）⭐ 新增

/**
 * 实际进展同步配置类型  
 */
export type ActualSyncMode = 
  | 'send-only'              // 只发送（全部参会人）
  | 'send-only-private'      // 只发送（仅自己）⭐ 新增
  | 'bidirectional'          // 双向同步（全部参会人）
  | 'bidirectional-private'; // 双向同步（仅自己）⭐ 新增
  // 注意：Actual 不支持 receive-only，外部信息都应该归为 Plan

/**
 * 计划安排同步配置
 */
export interface PlanSyncConfig {
  mode: PlanSyncMode;
  targetCalendars: string[];  // 目标日历 ID 列表
}

/**
 * 实际进展同步配置
 */
export interface ActualSyncConfig {
  mode: ActualSyncMode;
  targetCalendars: string[];  // 目标日历 ID 列表
}

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
  /** 职位 */
  position?: string;
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
  /** 时间戳 */
  createdAt?: string;
  updatedAt?: string;
}

export interface Event {
  id: string;
  // ========== 标题字段（双向同步） ==========
  simpleTitle?: string;       // 纯文本标题（用于TimeCalendar周/日视图）
  fullTitle?: string;         // 富文本标题HTML（用于Plan页面，支持高亮/加粗等）
  // ⚠️ DEPRECATED: 兼容旧代码，逐步迁移到 simpleTitle
  title: string;              // 别名，指向 simpleTitle（向后兼容）
  description?: string;       // 纯文本描述（后台字段，仅用于Outlook同步）
  // ========== 时间字段（由 TimeHub 管理） ==========
  // ⚠️ v1.8 重要变更：时间字段允许 undefined
  // - Task 类型（isTask=true）：时间可选，支持无时间待办事项
  // - Calendar 事件（isTask=false/undefined）：时间必需，同步到 Outlook Calendar
  startTime?: string;   // 开始时间（'YYYY-MM-DD HH:mm:ss' 格式 或 undefined）
  endTime?: string;     // 结束时间（'YYYY-MM-DD HH:mm:ss' 格式 或 undefined）
  isAllDay?: boolean;   // 是否全天事件（undefined 表示未设置）
  location?: string;
  organizer?: Contact;  // 🔧 修改：使用统一的 Contact 接口
  attendees?: Contact[]; // 🔧 修改：使用统一的 Contact 接口
  reminder?: number;
  externalId?: string;
  calendarIds?: string[]; // 🆕 多日历分组支持（用于事件同步到 Calendar）
  todoListIds?: string[]; // 🆕 To Do List 分组支持（用于任务同步到 To Do）
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
  isTimeLog?: boolean;   // 🆕 添加：标记为纯系统时间日志事件（如自动记录的活动轨迹）
  isOutsideApp?: boolean; // 🆕 添加：标记为外部应用数据（如听歌记录、录屏等）
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
  // ⚠️ DEPRECATED: content 字段已废弃，使用 fullTitle 代替
  content?: string;      // 废弃：请使用 fullTitle
  emoji?: string;        // emoji 图标
  color?: string;        // 自定义颜色
  dueDate?: string;      // 截止日期（用于任务类型）
  notes?: string;        // 备注
  priority?: 'low' | 'medium' | 'high' | 'urgent'; // 优先级
  isCompleted?: boolean; // 是否完成
  level?: number;        // 层级缩进（用于 Plan 页面显示）
  mode?: 'title' | 'eventlog'; // 显示模式（title或eventlog行）
  type?: 'todo' | 'task' | 'event'; // 事件类型（向后兼容）
  
  // 🆕 v1.8: Rich-text description support
  // 🔧 v2.0: 重构为完整的 EventLog 对象
  /**
   * 富文本日志字段
   * 
   * ⚠️ 兼容性说明：
   * - 旧数据：string（HTML 格式）
   * - 新数据：EventLog 对象（Slate JSON + 元数据）
   * 
   * 使用方式：
   * ```typescript
   * // 读取时检测类型
   * if (typeof event.eventlog === 'string') {
   *   // 旧格式：HTML 字符串
   *   const html = event.eventlog;
   * } else if (event.eventlog && 'content' in event.eventlog) {
   *   // 新格式：EventLog 对象
   *   const slateJSON = event.eventlog.content;
   * }
   * 
   * // 写入时使用新格式
   * event.eventlog = {
   *   content: JSON.stringify(slateNodes),
   *   descriptionHtml: '<p>...</p>',
   * };
   * ```
   */
  eventlog?: string | EventLog;
  
  // 🆕 Issue #12: Timer ↔ Plan 集成
  parentEventId?: string;   // 父事件 ID（用于 Timer 子事件关联）
  timerLogs?: string[];     // 计时日志（子 Timer 事件 ID 列表）
  
  // 🆕 签到功能：用于任务管理和定时打卡
  checked?: string[];       // 签到时间戳数组（ISO格式）
  unchecked?: string[];     // 取消签到时间戳数组（ISO格式）
  
  // 🆕 v2.1: 日历同步配置（支持 Private 模式和独立事件架构）
  /**
   * 计划安排同步配置
   * 支持 5 种模式：receive-only, send-only, send-only-private, bidirectional, bidirectional-private
   */
  planSyncConfig?: PlanSyncConfig;
  
  /**
   * 实际进展同步配置
   * 支持 4 种模式：send-only, send-only-private, bidirectional, bidirectional-private
   * null 表示继承 planSyncConfig
   */
  actualSyncConfig?: ActualSyncConfig;
  
  /**
   * 计划安排的远程事件 ID
   * Plan 同步创建的远程事件 ID（独立于 Actual）
   */
  syncedPlanEventId?: string | null;
  
  /**
   * 实际进展的远程事件 ID  
   * Actual 同步创建的远程事件 ID（独立于 Plan）
   * 对于 Timer 子事件，存储对应的远程子事件 ID
   */
  syncedActualEventId?: string | null;
  
  /**
   * @deprecated 旧的同步事件 ID，将被 syncedPlanEventId 和 syncedActualEventId 替代
   */
  syncedOutlookEventId?: string | null;
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

// 🆕 v1.7.5: Microsoft To Do List 接口
export interface TodoList {
  id: string;                // To Do List ID
  name: string;              // 列表名称
  displayName?: string;      // 显示名称
  isOwner?: boolean;         // 是否为所有者
  isShared?: boolean;        // 是否共享
  wellknownListName?: 'none' | 'defaultList' | 'flaggedEmails';  // 系统列表类型
  color?: string;            // 颜色（可能不存在）
}
