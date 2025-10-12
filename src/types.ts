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
  syncStatus?: 'pending' | 'synced' | 'error';
  lastSyncTime?: string; // 🔧 修改：使用字符串存储本地时间
  createdAt: string;     // 🔧 修改：使用字符串存储本地时间
  updatedAt: string;     // 🔧 修改：使用字符串存储本地时间
  timerSessionId?: string;
  tagId?: string;
  category?: string;
  remarkableSource?: boolean;
  localVersion?: number;
  lastLocalChange?: string; // 🔧 修改：使用字符串存储本地时间
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