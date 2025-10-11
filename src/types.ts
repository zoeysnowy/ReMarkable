export interface TimerSession {
  id: string;
  taskName: string;
  duration: number; // 持续时间（秒）
  startTime: string;    // 🔧 修改：使用字符串存储本地时间
  endTime: string;      // 🔧 修改：使用字符串存储本地时间
  completedAt: string;  // 🔧 修改：使用字符串存储本地时间
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: string;    // 🔧 修改：使用字符串存储本地时间
  endTime: string;      // 🔧 修改：使用字符串存储本地时间
  isAllDay: boolean;
  location?: string;
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
}

export interface EventTag {
  id: string;
  name: string;
  color: string;
  category: 'personal' | 'work' | 'study' | 'ongoing' | 'other';
  createdAt: string;     // 🔧 修改：使用字符串存储本地时间
}