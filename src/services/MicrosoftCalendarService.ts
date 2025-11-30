import { PublicClientApplication } from '@azure/msal-browser';
import { MICROSOFT_GRAPH_CONFIG } from '../config/calendar';
import { formatTimeForStorage } from '../utils/timeUtils';
import { STORAGE_KEYS } from '../constants/storage';
import { Contact } from '../types';

import { logger } from '../utils/logger';

const MSCalendarLogger = logger.module('MSCalendar');

// ReMarkable 联系人信息标记（类似签名机制）
const REMARKABLE_CONTACTS_PREFIX = '【参会人】';
const REMARKABLE_ORGANIZER_PREFIX = '【组织者】';
const REMARKABLE_CONTACTS_MARKER = '<!-- ReMarkable Contacts -->';

/**
 * 将不符合 Outlook 格式的联系人信息整合到描述中
 * @param description 原始描述
 * @param organizer 组织者
 * @param attendees 参会人列表
 * @returns 整合后的描述
 */
function integrateContactsToDescription(
  description: string | undefined,
  organizer?: Contact,
  attendees?: Contact[]
): string {
  let result = description || '';
  
  // 移除旧的联系人信息（如果存在）
  result = removeContactsFromDescription(result);
  
  const contactsInfo: string[] = [];
  
  // 添加组织者信息（如果没有邮箱）
  if (organizer && organizer.name && !organizer.email) {
    contactsInfo.push(`${REMARKABLE_ORGANIZER_PREFIX}${organizer.name}`);
  }
  
  // 添加参会人信息（仅包含没有邮箱的）
  if (attendees && attendees.length > 0) {
    const invalidAttendees = attendees.filter(a => a.name && !a.email);
    if (invalidAttendees.length > 0) {
      const names = invalidAttendees.map(a => a.name).join('/');
      contactsInfo.push(`${REMARKABLE_CONTACTS_PREFIX}${names}`);
    }
  }
  
  // 如果有需要整合的联系人信息，添加到描述开头
  if (contactsInfo.length > 0) {
    const contactsBlock = `${REMARKABLE_CONTACTS_MARKER}\n${contactsInfo.join('\n')}\n${REMARKABLE_CONTACTS_MARKER}\n\n`;
    result = contactsBlock + result;
  }
  
  return result;
}

/**
 * 从描述中移除 ReMarkable 联系人信息
 * @param description 包含联系人信息的描述
 * @returns 清理后的描述
 */
function removeContactsFromDescription(description: string): string {
  if (!description) return '';
  
  // 移除标记块之间的内容
  const markerPattern = new RegExp(
    `${REMARKABLE_CONTACTS_MARKER}[\\s\\S]*?${REMARKABLE_CONTACTS_MARKER}\\n*`,
    'g'
  );
  
  return description.replace(markerPattern, '').trim();
}

/**
 * 从描述中提取 ReMarkable 联系人信息
 * @param description 包含联系人信息的描述
 * @returns 提取出的组织者和参会人
 */
function extractContactsFromDescription(description: string): {
  organizer?: Contact;
  attendees: Contact[];
  cleanDescription: string;
} {
  if (!description) {
    return { attendees: [], cleanDescription: '' };
  }
  
  let organizer: Contact | undefined;
  const attendees: Contact[] = [];
  
  // 提取标记块中的内容
  const markerPattern = new RegExp(
    `${REMARKABLE_CONTACTS_MARKER}([\\s\\S]*?)${REMARKABLE_CONTACTS_MARKER}`,
    ''
  );
  
  const match = description.match(markerPattern);
  if (match) {
    const contactsBlock = match[1];
    const lines = contactsBlock.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.startsWith(REMARKABLE_ORGANIZER_PREFIX)) {
        const name = line.substring(REMARKABLE_ORGANIZER_PREFIX.length).trim();
        organizer = { name, isReMarkable: true };
      } else if (line.startsWith(REMARKABLE_CONTACTS_PREFIX)) {
        const names = line.substring(REMARKABLE_CONTACTS_PREFIX.length).trim();
        const nameList = names.split('/').map(n => n.trim());
        nameList.forEach(name => {
          if (name) {
            attendees.push({ name, isReMarkable: true });
          }
        });
      }
    }
  }
  
  const cleanDescription = removeContactsFromDescription(description);
  
  return { organizer, attendees, cleanDescription };
}

export interface GraphEvent {
  id?: string;
  subject?: string;
  body?: {
    content?: string;
    contentType?: string;
  };
  start?: {
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    timeZone?: string;
  };
  location?: {
    displayName?: string;
  };
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  attendees?: Array<{
    type?: string;
    status?: {
      response?: string;
      time?: string;
    };
    emailAddress?: {
      name?: string;
      address?: string;
    };
  }>;
  isAllDay?: boolean;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
}

export interface CalendarGroup {
  id?: string;
  name?: string;
  changeKey?: string;
  classId?: string;
}

export interface Calendar {
  id?: string;
  name?: string;
  color?: string;
  changeKey?: string;
  canShare?: boolean;
  canViewPrivateItems?: boolean;
  canEdit?: boolean;
  allowedOnlineMeetingProviders?: string[];
  defaultOnlineMeetingProvider?: string;
  isTallyingResponses?: boolean;
  isRemovable?: boolean;
  owner?: {
    name?: string;
    address?: string;
  };
}

export interface CalendarSyncMeta {
  lastSyncTime: string;
  calendarGroupsCount: number;
  calendarsCount: number;
  isOfflineMode: boolean;
  lastCalendarListSyncTime?: string; // 🆕 日历列表最后同步时间（用于增量检查）
}

export class MicrosoftCalendarService {
  private msalInstance!: PublicClientApplication;
  private isAuthenticated: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: Date = new Date();
  private eventChangeListeners: Array<(events: GraphEvent[]) => void> = [];
  private simulationMode: boolean = false;
  private accessToken: string | null = null;
  private calendarGroups: CalendarGroup[] = [];
  private calendars: Calendar[] = [];
  private selectedCalendarId: string | null = null;
  
  // 🚀 [NEW] 日历缓存加载锁（防止并发重复请求）
  private calendarCacheLoadingPromise: Promise<void> | null = null;

  constructor() {
    try {
      this.msalInstance = new PublicClientApplication({
        auth: {
          clientId: MICROSOFT_GRAPH_CONFIG.clientId,
          authority: MICROSOFT_GRAPH_CONFIG.authority,
          redirectUri: MICROSOFT_GRAPH_CONFIG.redirectUri
        },
        cache: {
          cacheLocation: 'localStorage',
          storeAuthStateInCookie: false
        }
      });

      if (typeof window !== 'undefined') {
        (window as any).microsoftCalendarService = this;
        if (!(window as any).debug) {
          (window as any).debug = {};
        }
        (window as any).debug.microsoftCalendarService = this;
      }

      this.initializeGraph();
      
    } catch (error) {
      MSCalendarLogger.error('❌ MicrosoftCalendarService constructor error:', error);
      this.enableSimulationMode();
    }
  }

  // ===== 缓存管理方法 =====
  
  /**
   * 获取缓存的日历分组（永不过期，直到手动刷新）
   */
  public getCachedCalendarGroups(): CalendarGroup[] {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CALENDAR_GROUPS_CACHE);
      if (cached) {
        const groups = JSON.parse(cached);
        MSCalendarLogger.log('📋 [Cache] Retrieved calendar groups from cache:', groups.length, 'groups');
        return groups;
      }
      return [];
    } catch (error) {
      MSCalendarLogger.error('❌ [Cache] Failed to get cached calendar groups:', error);
      return [];
    }
  }

  /**
   * 获取缓存的日历列表（永不过期，直到手动刷新）
   */
  public getCachedCalendars(): Calendar[] {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CALENDARS_CACHE);
      if (cached) {
        const calendars = JSON.parse(cached);
        
        // 🔧 [FIX v1.7.4] 同步更新内存中的 calendars 数组
        // 确保 this.calendars 与 localStorage 保持一致
        this.calendars = calendars;
        
        MSCalendarLogger.log('📋 [Cache] Retrieved calendars from cache:', calendars.length, 'calendars');
        return calendars;
      }
      return [];
    } catch (error) {
      MSCalendarLogger.error('❌ [Cache] Failed to get cached calendars:', error);
      return [];
    }
  }

  /**
   * 🆕 获取缓存的 To Do Lists（永不过期，直到手动刷新）
   */
  public getCachedTodoLists(): any[] {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.TODO_LISTS_CACHE);
      if (cached) {
        const todoLists = JSON.parse(cached);
        MSCalendarLogger.log('📋 [Cache] Retrieved To Do Lists from cache:', todoLists.length, 'lists');
        return todoLists;
      }
      return [];
    } catch (error) {
      MSCalendarLogger.error('❌ [Cache] Failed to get cached To Do Lists:', error);
      return [];
    }
  }

  /**
   * 🆕 缓存 To Do Lists 到 localStorage
   */
  private setCachedTodoLists(todoLists: any[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TODO_LISTS_CACHE, JSON.stringify(todoLists));
      MSCalendarLogger.log('💾 [Cache] Saved To Do Lists to cache:', todoLists.length, 'lists');
    } catch (error) {
      MSCalendarLogger.error('❌ [Cache] Failed to save To Do Lists to cache:', error);
    }
  }

  /**
   * 缓存日历分组到 localStorage（永久存储）
   */
  private setCachedCalendarGroups(groups: CalendarGroup[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CALENDAR_GROUPS_CACHE, JSON.stringify(groups));
      MSCalendarLogger.log('💾 [Cache] Saved calendar groups to cache:', groups.length, 'groups');
    } catch (error) {
      MSCalendarLogger.error('❌ [Cache] Failed to save calendar groups to cache:', error);
    }
  }

  /**
   * 缓存日历列表到 localStorage（永久存储）
   */
  private setCachedCalendars(calendars: Calendar[]): void {
    try {
      // 🔧 [FIX v1.7.4] 同时更新内存中的 calendars 数组
      this.calendars = calendars;
      
      localStorage.setItem(STORAGE_KEYS.CALENDARS_CACHE, JSON.stringify(calendars));
      MSCalendarLogger.log('💾 [Cache] Saved calendars to cache:', calendars.length, 'calendars');
    } catch (error) {
      MSCalendarLogger.error('❌ [Cache] Failed to save calendars to cache:', error);
    }
  }

  /**
   * 获取同步元数据
   */
  public getSyncMeta(): CalendarSyncMeta | null {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CALENDAR_SYNC_META);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      MSCalendarLogger.error('❌ [Cache] Failed to get sync meta:', error);
      return null;
    }
  }

  /**
   * 更新同步元数据
   */
  private setSyncMeta(meta: CalendarSyncMeta): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CALENDAR_SYNC_META, JSON.stringify(meta));
      MSCalendarLogger.log('💾 [Cache] Updated sync meta:', meta);
    } catch (error) {
      MSCalendarLogger.error('❌ [Cache] Failed to save sync meta:', error);
    }
  }

  /**
   * 🚀 [NEW] 确保日历缓存已加载（如果为空则自动同步）
   * 使用互斥锁防止并发重复请求
   */
  private async ensureCalendarCacheLoaded(): Promise<void> {
    // 🔒 如果正在加载中，直接返回现有Promise
    if (this.calendarCacheLoadingPromise) {
      MSCalendarLogger.log('⏳ Calendar cache loading in progress, waiting...');
      return this.calendarCacheLoadingPromise;
    }
    
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CALENDARS_CACHE);
      if (!cached || JSON.parse(cached).length === 0) {
        MSCalendarLogger.log('📅 Calendar cache empty, syncing from remote...');
        
        // 🔒 设置加载锁
        this.calendarCacheLoadingPromise = this.syncCalendarGroupsFromRemote()
          .then(() => {
            MSCalendarLogger.log('✅ Calendar cache loaded successfully');
          })
          .finally(() => {
            // 🔓 释放锁
            this.calendarCacheLoadingPromise = null;
          });
        
        await this.calendarCacheLoadingPromise;
      } else {
        MSCalendarLogger.log('✅ Calendar cache already exists, loading into memory...');
        
        // 🔧 [FIX v1.7.4] 从 localStorage 加载到内存（this.calendars）
        this.getCachedCalendars(); // 这会更新 this.calendars
        
        // 🔄 检查是否需要增量同步（24小时检查一次）
        await this.checkCalendarListChanges();
      }
    } catch (error) {
      MSCalendarLogger.error('❌ Failed to ensure calendar cache:', error);
      // 🔓 失败时也要释放锁
      this.calendarCacheLoadingPromise = null;
      throw error;
    }
  }

  /**
   * 🆕 检查日历列表是否有变化（增量同步）
   * 策略：24小时检查一次，对比远程日历数量是否变化
   */
  private async checkCalendarListChanges(): Promise<void> {
    try {
      const meta = this.getSyncMeta();
      const now = new Date();
      
      // 检查上次同步时间
      if (meta?.lastCalendarListSyncTime) {
        const lastSync = new Date(meta.lastCalendarListSyncTime);
        const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
        
        // 24小时内不重复检查
        if (hoursSinceLastSync < 24) {
          MSCalendarLogger.log(`⏭️ Calendar list checked ${hoursSinceLastSync.toFixed(1)}h ago, skipping`);
          return;
        }
      }
      
      MSCalendarLogger.log('🔍 Checking calendar list changes (24h+ since last check)...');
      
      // 只获取日历数量进行对比（轻量级请求）
      const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars?$select=id&$top=999', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to check calendar list: ${response.status}`);
      }
      
      const data = await response.json();
      const remoteCount = data.value.length;
      const cachedCount = meta?.calendarsCount || 0;
      
      // 更新检查时间
      if (meta) {
        this.setSyncMeta({
          ...meta,
          // 🔧 修复：使用 formatTimeForStorage 保持一致性
          lastCalendarListSyncTime: formatTimeForStorage(now)
        });
      }
      
      // 数量不一致，触发完整同步
      if (remoteCount !== cachedCount) {
        MSCalendarLogger.log(`📊 Calendar count changed: ${cachedCount} → ${remoteCount}, syncing...`);
        await this.syncCalendarGroupsFromRemote();
      } else {
        MSCalendarLogger.log(`✅ Calendar list unchanged (${cachedCount} calendars)`);
      }
      
    } catch (error) {
      MSCalendarLogger.error('❌ Failed to check calendar list changes:', error);
      // 静默失败，不影响主流程
    }
  }

  /**
   * 强制从远程同步日历分组和日历（覆盖缓存）
   */
  public async syncCalendarGroupsFromRemote(): Promise<{ groups: CalendarGroup[], calendars: Calendar[] }> {
    MSCalendarLogger.log('🔄 [Sync] Starting remote calendar sync...');
    
    try {
      if (!this.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      // 获取日历分组
      const groups = await this.fetchCalendarGroups();
      
      // 获取所有日历
      const calendars = await this.fetchAllCalendars();

      // 更新缓存
      this.setCachedCalendarGroups(groups);
      this.setCachedCalendars(calendars);

      // 更新同步元数据
      // 🔧 修复：使用 formatTimeForStorage 保持一致性
      const now = formatTimeForStorage(new Date());
      this.setSyncMeta({
        lastSyncTime: now,
        calendarGroupsCount: groups.length,
        calendarsCount: calendars.length,
        isOfflineMode: false,
        lastCalendarListSyncTime: now // 🆕 记录日历列表同步时间
      });

      MSCalendarLogger.log('✅ [Sync] Remote calendar sync completed successfully');
      return { groups, calendars };
      
    } catch (error) {
      MSCalendarLogger.error('❌ [Sync] Failed to sync from remote:', error);
      
      // 标记为离线模式
      const currentMeta = this.getSyncMeta();
      if (currentMeta) {
        this.setSyncMeta({
          ...currentMeta,
          isOfflineMode: true
        });
      }
      
      throw error;
    }
  }

  /**
   * 获取所有日历分组和日历（优先使用缓存）
   * @param forceRefresh 是否强制刷新（⚠️ 仅在缓存为空时才会同步日历列表）
   */
  public async getAllCalendarData(forceRefresh: boolean = false): Promise<{ groups: CalendarGroup[], calendars: Calendar[] }> {
    // 先尝试从缓存获取
    const cachedGroups = this.getCachedCalendarGroups();
    const cachedCalendars = this.getCachedCalendars();

    // 如果有缓存，直接返回（即使forceRefresh=true）
    if (cachedGroups.length > 0 || cachedCalendars.length > 0) {
      MSCalendarLogger.log('📋 [Cache] Using cached calendar data');
      
      // 🔄 后台检查日历列表是否有变化（24小时检查一次）
      if (forceRefresh) {
        this.checkCalendarListChanges().catch(error => {
          MSCalendarLogger.error('❌ Background check failed:', error);
        });
      }
      
      return { groups: cachedGroups, calendars: cachedCalendars };
    }

    // 缓存为空，必须从远程同步
    MSCalendarLogger.log('📋 [Cache] No cached data found, syncing from remote...');
    return await this.syncCalendarGroupsFromRemote();
  }

  /**
   * 清除所有日历缓存
   */
  public clearCalendarCache(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CALENDAR_GROUPS_CACHE);
      localStorage.removeItem(STORAGE_KEYS.CALENDARS_CACHE);
      localStorage.removeItem(STORAGE_KEYS.CALENDAR_SYNC_META);
      MSCalendarLogger.log('🗑️ [Cache] Cleared all calendar cache');
    } catch (error) {
      MSCalendarLogger.error('❌ [Cache] Failed to clear calendar cache:', error);
    }
  }

  /**
   * 🆕 获取所有 To Do Lists（优先使用缓存）
   */
  public async getAllTodoListData(forceRefresh: boolean = false): Promise<{ todoLists: any[] }> {
    // 先尝试从缓存获取
    const cachedTodoLists = this.getCachedTodoLists();

    // 如果有缓存，直接返回
    if (cachedTodoLists.length > 0 && !forceRefresh) {
      MSCalendarLogger.log('📋 [Cache] Using cached To Do Lists');
      return { todoLists: cachedTodoLists };
    }

    // 缓存为空或强制刷新，从远程同步
    MSCalendarLogger.log('📋 [Cache] No cached To Do Lists or force refresh, syncing from remote...');
    return await this.syncTodoListsFromRemote();
  }

  /**
   * 🆕 从远程同步 To Do Lists（覆盖缓存）
   */
  public async syncTodoListsFromRemote(): Promise<{ todoLists: any[] }> {
    MSCalendarLogger.log('🔄 [Sync] Starting remote To Do Lists sync...');
    
    try {
      if (!this.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      // 获取所有 To Do Lists
      const response = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch To Do Lists: ${response.status}`);
      }

      const data = await response.json();
      const todoLists = data.value || [];

      // 🔍 调试：检查第一个 To Do List 的数据结构
      if (todoLists.length > 0) {
        MSCalendarLogger.log('🔍 [Debug] First To Do List structure:', todoLists[0]);
      }

      // 更新缓存
      this.setCachedTodoLists(todoLists);

      MSCalendarLogger.log('✅ [Sync] Remote To Do Lists sync completed:', todoLists.length, 'lists');
      return { todoLists };
      
    } catch (error) {
      MSCalendarLogger.error('❌ [Sync] Failed to sync To Do Lists from remote:', error);
      throw error;
    }
  }

  /**
   * 🆕 创建任务到指定的 To Do List
   */
  public async syncTaskToTodoList(todoListId: string, task: { title: string; body?: string; dueDate?: string }): Promise<any> {
    MSCalendarLogger.log('📝 [To Do] Creating task in list:', todoListId, task);
    
    try {
      if (!this.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      const taskData: any = {
        title: task.title
      };

      if (task.body) {
        taskData.body = {
          content: task.body,
          contentType: 'text'
        };
      }

      if (task.dueDate) {
        taskData.dueDateTime = {
          dateTime: task.dueDate,
          timeZone: 'UTC'
        };
      }

      const response = await fetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${todoListId}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create task: ${response.status} - ${errorText}`);
      }

      const createdTask = await response.json();
      MSCalendarLogger.log('✅ [To Do] Task created successfully:', createdTask.id);
      return createdTask;
      
    } catch (error) {
      MSCalendarLogger.error('❌ [To Do] Failed to create task:', error);
      throw error;
    }
  }

  /**
   * 内部方法：从远程获取日历分组
   */
  private async fetchCalendarGroups(): Promise<CalendarGroup[]> {
    return await this.getCalendarGroups();
  }

  /**
   * 内部方法：从远程获取所有日历
   */
  private async fetchAllCalendars(): Promise<Calendar[]> {
    return await this.getAllCalendars();
  }

  private convertUtcToBeijing(utcTimeStr: string): string {
    if (!utcTimeStr) return this.formatTimeForOutlook(new Date());
    
    try {
      let cleanTime = utcTimeStr.includes('.') ? utcTimeStr.split('.')[0] : utcTimeStr;
      const utcDate = new Date(cleanTime + 'Z');
      const beijingDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
      
      const year = beijingDate.getUTCFullYear();
      const month = (beijingDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = beijingDate.getUTCDate().toString().padStart(2, '0');
      const hours = beijingDate.getUTCHours().toString().padStart(2, '0');
      const minutes = beijingDate.getUTCMinutes().toString().padStart(2, '0');
      const seconds = beijingDate.getUTCSeconds().toString().padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    } catch (error) {
      MSCalendarLogger.error('❌ Time conversion error:', error);
      return utcTimeStr;
    }
  }

  private async initializeGraph() {
    try {
      // 🔧 Electron环境：优先从localStorage加载令牌
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const token = localStorage.getItem('ms-access-token');
        const expiresAt = localStorage.getItem('ms-token-expires');
        
        if (token && expiresAt) {
          const expiresTime = parseInt(expiresAt);
          const now = Date.now();
          
          if (now < expiresTime - 60000) {
            MSCalendarLogger.log('✅ [Electron] 从localStorage加载了有效的访问令牌');
            this.accessToken = token;
            this.isAuthenticated = true;
            this.simulationMode = false;
            
            // 🔧 触发全局认证状态更新事件
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth-state-changed', { 
                detail: { isAuthenticated: true } 
              }));
              MSCalendarLogger.log('🔔 触发了 auth-state-changed 事件（Electron恢复）');
            }
            
            // 🚀 [FIX] 检查日历缓存，如果为空则同步
            this.ensureCalendarCacheLoaded().catch(error => {
              MSCalendarLogger.error('❌ Failed to ensure calendar cache:', error);
            });
            
            return;
          } else {
            MSCalendarLogger.log('⚠️ [Electron] 访问令牌已过期');
          }
        }
      }

      await this.msalInstance.initialize();
      
      // 处理重定向回调（适用于所有环境）
      try {
        const redirectResponse = await this.msalInstance.handleRedirectPromise();
        if (redirectResponse) {
          MSCalendarLogger.log('✅ 重定向认证成功:', redirectResponse.account?.username);
          this.msalInstance.setActiveAccount(redirectResponse.account);
          await this.acquireToken();
          return;
        }
      } catch (error) {
        MSCalendarLogger.log('⚠️ 处理重定向响应时出错:', error);
      }
      
      // 🔧 Web环境：尝试静默获取token
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        MSCalendarLogger.log('✅ 找到已登录账户:', accounts[0].username);
        this.msalInstance.setActiveAccount(accounts[0]);
        
        try {
          await this.acquireToken();
          MSCalendarLogger.log('✅ 静默获取token成功');
        } catch (error) {
          MSCalendarLogger.warn('⚠️ 静默获取token失败，尝试从localStorage恢复:', error);
          
          // 🔧 静默获取失败，尝试从localStorage恢复
          const token = localStorage.getItem('ms-access-token');
          const expiresAt = localStorage.getItem('ms-token-expires');
          
          if (token && expiresAt) {
            const expiresTime = parseInt(expiresAt);
            const now = Date.now();
            const BUFFER_TIME = 5 * 60 * 1000; // 5分钟缓冲
            
            if (now < expiresTime - BUFFER_TIME) {
              MSCalendarLogger.log('✅ 从localStorage恢复了有效的访问令牌');
              this.accessToken = token;
              this.isAuthenticated = true;
              this.simulationMode = false;
              
              // 🔧 触发全局认证状态更新事件
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth-state-changed', { 
                  detail: { isAuthenticated: true } 
                }));
                MSCalendarLogger.log('🔔 触发了 auth-state-changed 事件（localStorage恢复）');
              }
              
              // 🚀 [FIX] 检查日历缓存，如果为空则同步
              this.ensureCalendarCacheLoaded().catch(error => {
                MSCalendarLogger.error('❌ Failed to ensure calendar cache:', error);
              });
            } else {
              MSCalendarLogger.log('⚠️ localStorage中的token也已过期');
            }
          }
        }
      }
    } catch (error) {
      MSCalendarLogger.error('❌ MSAL initialization failed:', error);
      this.enableSimulationMode();
    }
  }

  private async acquireToken(): Promise<void> {
    try {
      const account = this.msalInstance.getActiveAccount();
      if (!account) return;

      const tokenRequest = {
        scopes: MICROSOFT_GRAPH_CONFIG.scopes,
        account: account
      };
      
      const response = await this.msalInstance.acquireTokenSilent(tokenRequest);
      this.accessToken = response.accessToken;
      
      // 🔧 先设置认证状态为 true（因为已经获得了 token）
      this.isAuthenticated = true;
      this.simulationMode = false;
      
      // � [FIX] 检查日历缓存，如果为空则同步
      this.ensureCalendarCacheLoaded().catch(error => {
        MSCalendarLogger.error('❌ Failed to ensure calendar cache:', error);
      });
      
      // �🔧 测试连接（即使失败也不影响认证状态）
      try {
        await this.testConnection();
        MSCalendarLogger.log('✅ API 连接测试成功');
      } catch (testError) {
        MSCalendarLogger.warn('⚠️ API 连接测试失败，但 token 有效:', testError);
      }
      
    } catch (tokenError: any) {
      if (tokenError?.name === 'InteractionRequiredAuthError') {
        try {
          const account = this.msalInstance.getActiveAccount();
          if (account) {
            const response = await this.msalInstance.acquireTokenPopup({
              scopes: MICROSOFT_GRAPH_CONFIG.scopes,
              account: account
            });
            this.accessToken = response.accessToken;
            
            // 🔧 先设置认证状态为 true（因为已经获得了 token）
            this.isAuthenticated = true;
            this.simulationMode = false;
            
            // � [FIX] 检查日历缓存，如果为空则同步
            this.ensureCalendarCacheLoaded().catch(error => {
              MSCalendarLogger.error('❌ Failed to ensure calendar cache:', error);
            });
            
            // �🔧 测试连接（即使失败也不影响认证状态）
            try {
              await this.testConnection();
              MSCalendarLogger.log('✅ API 连接测试成功');
            } catch (testError) {
              MSCalendarLogger.warn('⚠️ API 连接测试失败，但 token 有效:', testError);
            }
            return;
          }
        } catch (interactiveError: any) {
          MSCalendarLogger.error('❌ Interactive token acquisition failed:', interactiveError);
          
          // 如果弹窗被阻止，提示用户使用重定向方式
          if (interactiveError.message && interactiveError.message.includes('popup_window_error')) {
            MSCalendarLogger.warn('⚠️ 令牌获取弹窗被阻止，建议使用重定向方式重新登录');
            if (typeof window !== 'undefined') {
              setTimeout(() => {
                alert('无法打开认证弹窗，请点击"连接"按钮重新登录');
              }, 1000);
            }
          }
        }
      }
      
      this.enableSimulationMode();
    }
  }

  private async callGraphAPI(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const url = `https://graph.microsoft.com/v1.0${endpoint}`;
    
    // 🔍 [DEBUG] 添加详细的API调用日志
    
    if (body && method !== 'GET') {
      MSCalendarLogger.log('📦 [callGraphAPI] Request body:', JSON.stringify(body, null, 2));
    }
    
    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      

      if (!response.ok) {
        console.error('❌ [callGraphAPI] Request failed:', {
          status: response.status,
          statusText: response.statusText,
          method: method,
          endpoint: endpoint
        });
        
        if (response.status === 401) {
          MSCalendarLogger.log('🔄 [callGraphAPI] Token expired, acquiring new token...');
          await this.acquireToken();
          
          MSCalendarLogger.log('🔄 [callGraphAPI] Retrying request with new token...');
          const retryResponse = await fetch(url, {
            method: method,
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
          });
          
          
          if (retryResponse.status === 401) {
            // 重试后仍然是 401，说明 token 真的过期了
            MSCalendarLogger.error('🔴 [callGraphAPI] Still 401 after retry - authentication truly failed');
            this.handleAuthenticationFailure();
            throw new Error('认证已过期，请重新登录 Microsoft 账户');
          }
          
          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            MSCalendarLogger.error('❌ [callGraphAPI] Retry failed:', errorText);
            throw new Error(`Graph API call failed: ${retryResponse.status} ${retryResponse.statusText}`);
          }
          
          const result = retryResponse.status === 204 ? null : await retryResponse.json();
          MSCalendarLogger.log('✅ [callGraphAPI] Retry successful');
          return result;
        } else {
          const errorText = await response.text();
          MSCalendarLogger.error('❌ [callGraphAPI] Error response:', errorText);
          throw new Error(`Graph API call failed: ${response.status} ${response.statusText}`);
        }
      }

      const result = response.status === 204 ? null : await response.json();
      
      return result;
      
    } catch (error) {
      console.error('❌ [callGraphAPI] Exception occurred:', {
        method: method,
        endpoint: endpoint,
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private enableSimulationMode() {
    this.simulationMode = true;
    this.isAuthenticated = false;
    this.accessToken = null;
  }

  private async testConnection(): Promise<void> {
    try {
      await this.callGraphAPI('/me?$select=id,displayName');
    } catch (error) {
      MSCalendarLogger.error('❌ API connection test failed:', error);
      throw error;
    }
  }

  async signIn(): Promise<boolean> {
    try {
      // 检查是否在Electron环境
      const isElectron = typeof window !== 'undefined' && window.electronAPI;
      
      if (isElectron) {
        // Electron环境：使用 BrowserWindow 弹窗认证
        MSCalendarLogger.log('🔧 Electron环境：使用 BrowserWindow 认证窗口');
        
        try {
          // 先尝试无声登录
          const silentResult = await this.msalInstance.ssoSilent({
            scopes: MICROSOFT_GRAPH_CONFIG.scopes,
            account: this.msalInstance.getAllAccounts()[0]
          });
          
          if (silentResult) {
            MSCalendarLogger.log('✅ 无声登录成功');
            this.msalInstance.setActiveAccount(silentResult.account);
            await this.acquireToken();
            return this.isAuthenticated;
          }
        } catch (silentError) {
          MSCalendarLogger.log('🔄 无声登录失败，需要交互式登录');
        }
        
        // 构建认证URL
        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
          `client_id=${MICROSOFT_GRAPH_CONFIG.clientId}&` +
          `response_type=code&` +
          `redirect_uri=${encodeURIComponent(MICROSOFT_GRAPH_CONFIG.redirectUri)}&` +
          `scope=${encodeURIComponent(MICROSOFT_GRAPH_CONFIG.scopes.join(' '))}&` +
          `response_mode=query`;
        
        // 🚀 [FIX] 使用 microsoft-login-window IPC 打开认证窗口
        if (window.electronAPI?.invoke) {
          try {
            MSCalendarLogger.log('🔐 打开 Microsoft 登录窗口...');
            const result = await window.electronAPI.invoke('microsoft-login-window', authUrl);
            
            if (result.success && result.code) {
              MSCalendarLogger.log('✅ 获取到授权码，正在交换 access token...');
              
              // 🔄 使用授权码交换 access token
              const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  client_id: MICROSOFT_GRAPH_CONFIG.clientId,
                  scope: MICROSOFT_GRAPH_CONFIG.scopes.join(' '),
                  code: result.code,
                  redirect_uri: MICROSOFT_GRAPH_CONFIG.redirectUri,
                  grant_type: 'authorization_code',
                }),
              });
              
              if (!tokenResponse.ok) {
                throw new Error(`Token exchange failed: ${tokenResponse.status}`);
              }
              
              const tokenData = await tokenResponse.json();
              this.accessToken = tokenData.access_token;
              
              // 保存到 localStorage（Electron 持久化）
              const expiresAt = Date.now() + (tokenData.expires_in * 1000);
              localStorage.setItem('ms-access-token', tokenData.access_token);
              localStorage.setItem('ms-token-expires', expiresAt.toString());
              
              if (tokenData.refresh_token) {
                localStorage.setItem('ms-refresh-token', tokenData.refresh_token);
              }
              
              // 设置认证状态
              this.isAuthenticated = true;
              this.simulationMode = false;
              
              MSCalendarLogger.log('✅ Electron 登录成功，已获取 access token');
              
              // 🔔 触发认证状态更新事件
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth-state-changed', { 
                  detail: { isAuthenticated: true } 
                }));
              }
              
              // 🚀 确保日历缓存加载
              await this.ensureCalendarCacheLoaded();
              
              // 🔧 启用自动同步
              this.startRealTimeSync();
              
              return true;
            } else {
              MSCalendarLogger.error('❌ 未获取到授权码');
              return false;
            }
          } catch (error) {
            MSCalendarLogger.error('❌ Electron 认证失败:', error);
            throw error;
          }
        } else {
          throw new Error('electronAPI.invoke 不可用');
        }
      } else {
        // Web环境：先尝试弹窗，如果失败则使用重定向
        MSCalendarLogger.log('🌐 Web环境：使用弹窗认证');
        try {
          const loginResponse = await this.msalInstance.loginPopup({
            scopes: MICROSOFT_GRAPH_CONFIG.scopes
          });
          
          this.msalInstance.setActiveAccount(loginResponse.account);
        } catch (popupError: any) {
          MSCalendarLogger.warn('⚠️ 弹窗认证失败，尝试重定向认证:', popupError);
          
          // 检查是否是弹窗被阻止的错误
          if (popupError.message && popupError.message.includes('popup_window_error')) {
            MSCalendarLogger.log('🔄 弹窗被阻止，使用重定向认证方式');
            
            // 显示用户友好提示
            if (typeof window !== 'undefined') {
              if (window.confirm('弹窗被浏览器阻止。是否使用页面重定向方式进行认证？\n\n点击确定将跳转到Microsoft登录页面，登录完成后会返回到此页面。')) {
                await this.msalInstance.loginRedirect({
                  scopes: MICROSOFT_GRAPH_CONFIG.scopes
                });
                return true; // 重定向不会立即返回结果
              } else {
                throw new Error('用户取消了认证流程');
              }
            } else {
              // 直接使用重定向
              await this.msalInstance.loginRedirect({
                scopes: MICROSOFT_GRAPH_CONFIG.scopes
              });
              return true;
            }
          } else {
            // 其他类型的错误，重新抛出
            throw popupError;
          }
        }
      }
      
      await this.acquireToken();
      
      if (this.isAuthenticated) {
        // ✅ 日历缓存会在 acquireToken() -> ensureCalendarCacheLoaded() 中自动加载
        // ❌ 移除此处的冗余调用，避免重复请求
        
        // 🔧 启用自动同步
        this.startRealTimeSync();
        return true;
      }
      return false;
      
    } catch (error) {
      MSCalendarLogger.error('❌ Login error:', error);
      
      // 如果认证失败，提供更详细的错误信息
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.showNotification(
          '认证失败', 
          '无法连接到Microsoft账户，请检查网络连接或稍后重试'
        );
      }
      
      this.enableSimulationMode();
      return false;
    }
  }

  async signOut(): Promise<void> {
    this.stopRealTimeSync();
    
    const account = this.msalInstance.getActiveAccount();
    if (account) {
      try {
        await this.msalInstance.logoutPopup({ account });
      } catch (error) {
        MSCalendarLogger.error('❌ Logout error:', error);
      }
    }
    this.accessToken = null;
    this.isAuthenticated = false;
    this.simulationMode = false;
  }

  async getUserInfo() {
    if (this.simulationMode) {
      return {
        id: 'simulation-user',
        displayName: '模拟用户',
        mail: 'simulation@example.com'
      };
    }

    if (!this.accessToken) throw new Error('Not authenticated');
    
    try {
      return await this.callGraphAPI('/me');
    } catch (error) {
      MSCalendarLogger.error('❌ Get user info error:', error);
      this.enableSimulationMode();
      throw error;
    }
  }

  private getUserSettings(): any {
    try {
      const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      MSCalendarLogger.error('❌ Error reading user settings:', error);
      return null;
    }
  }

  public async getEvents(): Promise<GraphEvent[]> {
    if (this.simulationMode && this.msalInstance?.getActiveAccount()) {
      try {
        await this.acquireToken();
        if (this.isAuthenticated && this.accessToken) {
          this.simulationMode = false;
        }
      } catch (authError) {
        // 保持模拟模式
      }
    }

    if (!this.isAuthenticated || !this.accessToken) {
      const activeAccount = this.msalInstance?.getActiveAccount();
      if (activeAccount && !this.simulationMode) {
        try {
          await this.acquireToken();
        } catch (authError) {
          // 继续到模拟模式
        }
      }
    }

    if (this.simulationMode) {
      return this.getSimulatedEvents();
    }

    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    // 🔧 统一同步范围：固定为 ±3 个月（与 TimeCalendar 显示范围一致）
    // 移除了 legacy 的 ongoingDays 设置
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 3); // 往前 3 个月
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setMonth(now.getMonth() + 3); // 往后 3 个月
    endDate.setHours(23, 59, 59, 999);

    // Querying events in date range

    const queryParams = new URLSearchParams({
      '$select': 'id,subject,body,bodyPreview,start,end,location,organizer,attendees,isAllDay,createdDateTime,lastModifiedDateTime',
      '$orderby': 'start/dateTime desc',
      '$top': '1000',
      '$filter': `start/dateTime ge '${this.formatTimeForOutlook(startDate)}' and start/dateTime lt '${this.formatTimeForOutlook(endDate)}'`
    });

    try {
      let response = await fetch(`https://graph.microsoft.com/v1.0/me/events?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        await this.acquireToken();
        response = await fetch(`https://graph.microsoft.com/v1.0/me/events?${queryParams}`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!response.ok) {
        this.enableSimulationMode();
        return this.getSimulatedEvents();
      }

      const data = await response.json();
      const events = data.value || [];
      
      // 🔧 统一过滤范围：与查询范围一致（±3 个月）
      const userFilterStart = new Date(now);
      userFilterStart.setMonth(now.getMonth() - 3);
      userFilterStart.setHours(0, 0, 0, 0);

      const userFilterEnd = new Date(now);
      userFilterEnd.setMonth(now.getMonth() + 3);
      userFilterEnd.setHours(23, 59, 59, 999);

      const filteredEvents = events.filter((event: any) => {
        if (!event.start?.dateTime) return false;
        
        const beijingTime = this.convertUtcToBeijing(event.start.dateTime);
        const eventDate = new Date(beijingTime);
        
        return eventDate >= userFilterStart && eventDate <= userFilterEnd;
      });

      // Filtered events by date range

      const processedEvents = filteredEvents.map((outlookEvent: any) => {
        const startTime = this.convertUtcToBeijing(outlookEvent.start?.dateTime);
        const endTime = this.convertUtcToBeijing(outlookEvent.end?.dateTime);
        
        const rawDescription = outlookEvent.body?.content || `${outlookEvent.subject} - 来自 Outlook 的日程`;
        
        // 🆕 处理组织者信息
        let organizer: Contact | null = outlookEvent.organizer?.emailAddress ? {
          name: outlookEvent.organizer.emailAddress.name || outlookEvent.organizer.emailAddress.address,
          email: outlookEvent.organizer.emailAddress.address,
          isOutlook: true
        } : null;
        
        // 🆕 处理与会者信息
        let attendees: Contact[] = outlookEvent.attendees ? outlookEvent.attendees.map((attendee: any) => ({
          name: attendee.emailAddress?.name || attendee.emailAddress?.address,
          email: attendee.emailAddress?.address,
          type: attendee.type || 'required',
          status: attendee.status?.response || 'none',
          isOutlook: true
        })).filter((a: any) => a.email) : [];
        
        // 🔍 从描述中提取 ReMarkable 联系人信息
        const extractedContacts = extractContactsFromDescription(rawDescription);
        if (extractedContacts.organizer) {
          organizer = extractedContacts.organizer;
        }
        if (extractedContacts.attendees.length > 0) {
          attendees = extractedContacts.attendees;
        }
        const cleanDescription = extractedContacts.cleanDescription || rawDescription;
        const eventTitle = outlookEvent.subject || 'Untitled Event';
        
        return {
          id: `outlook-${outlookEvent.id}`,
          title: { simpleTitle: eventTitle, colorTitle: eventTitle, fullTitle: JSON.stringify([{ type: 'paragraph', children: [{ text: eventTitle }] }]) },
          subject: eventTitle,
          description: cleanDescription,
          bodyPreview: outlookEvent.bodyPreview || outlookEvent.body?.content?.substring(0, 100) || `${eventTitle} - 来自 Outlook 的日程`,
          startTime: startTime,
          endTime: endTime,
          start: startTime,
          end: endTime,
          created: this.safeFormatDateTime(outlookEvent.createdDateTime),
          modified: this.safeFormatDateTime(outlookEvent.lastModifiedDateTime),
          createdAt: this.safeFormatDateTime(outlookEvent.createdDateTime),
          updatedAt: this.safeFormatDateTime(outlookEvent.lastModifiedDateTime),
          location: outlookEvent.location?.displayName || '',
          organizer: organizer,
          attendees: attendees,
          isAllDay: outlookEvent.isAllDay || false,
          isTimeCalendar: true, // 🆕 标记为 TimeCalendar 事件，确保在 PlanManager 中显示
          reminder: 0,
          externalId: outlookEvent.id,
          calendarIds: ['microsoft'], // 🔧 使用数组格式，与类型定义保持一致
          source: 'outlook',
          remarkableSource: true,
          syncStatus: 'synced'
        };
      }).filter(Boolean);

      // Processed events successfully
      return processedEvents;
      
    } catch (parseError) {
      MSCalendarLogger.error('❌ Error parsing response:', parseError);
      this.enableSimulationMode();
      return this.getSimulatedEvents();
    }
  }

  // 🔧 获取指定日历的事件
  public async getEventsFromCalendar(calendarId: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    if (this.simulationMode) {
      // console.log('📝 Simulating getEventsFromCalendar for:', calendarId);
      return this.getSimulatedEvents();
    }

    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    // ✅ 使用传入的日期范围，或回退到用户设置
    let queryStartDate: Date;
    let queryEndDate: Date;
    
    if (startDate && endDate) {
      queryStartDate = startDate;
      queryEndDate = endDate;
      // console.log('📅 [getEventsFromCalendar] Using provided date range:', {
      //   start: startDate.toLocaleDateString(),
      //   end: endDate.toLocaleDateString()
      // });
    } else {
      // 🔧 统一同步范围：固定为 ±3 个月（移除 legacy ongoingDays）
      const now = new Date();
      queryStartDate = new Date(now);
      queryStartDate.setMonth(now.getMonth() - 3);
      queryStartDate.setHours(0, 0, 0, 0);
      
      queryEndDate = new Date(now);
      queryEndDate.setMonth(now.getMonth() + 3);
      queryEndDate.setHours(23, 59, 59, 999);
    }

    // Querying specific calendar
    

    const queryParams = new URLSearchParams({
      '$select': 'id,subject,body,bodyPreview,start,end,location,organizer,attendees,isAllDay,createdDateTime,lastModifiedDateTime',
      '$orderby': 'start/dateTime desc',
      '$top': '1000',
      '$filter': `start/dateTime ge '${this.formatTimeForOutlook(queryStartDate)}' and start/dateTime lt '${this.formatTimeForOutlook(queryEndDate)}'`
    });

    try {
      let allEvents: any[] = [];
      let nextLink: string | null = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events?${queryParams}`;
      let pageCount = 0;
      
      // 🔧 [SMART PAGINATION] 智能分页：自动拉取所有页，直到没有更多数据
      // 最大限制 100 页（100,000 个事件），避免极端情况下的无限循环
      const ABSOLUTE_MAX_PAGES = 100;
      
      // 🔧 处理分页，确保获取所有事件
      while (nextLink && pageCount < ABSOLUTE_MAX_PAGES) {
        pageCount++;
        
        let response: Response = await fetch(nextLink, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          await this.acquireToken();
          response = await fetch(nextLink, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            }
          });
        }

        if (!response.ok) {
          MSCalendarLogger.warn(`⚠️ Failed to get events from calendar ${calendarId}:`, response.status);
          break;
        }

        const data: any = await response.json();
        const events = data.value || [];
        allEvents = allEvents.concat(events);
        
        // 检查是否有下一页
        nextLink = data['@odata.nextLink'] || null;
        
        if (nextLink) {
          // 📊 每 10 页显示一次进度
          if (pageCount % 10 === 0) {
            MSCalendarLogger.log(`📄 [Pagination] Fetched ${pageCount} pages (${allEvents.length} events so far), continuing...`);
          }
        }
      }
      
      // ⚠️ 如果达到绝对最大限制，发出警告
      if (pageCount >= ABSOLUTE_MAX_PAGES && nextLink) {
        MSCalendarLogger.warn(`⚠️ [Pagination] Calendar ${calendarId} has >100,000 events! Only fetched first ${allEvents.length} events.`);
        MSCalendarLogger.warn(`⚠️ [Pagination] This is an extreme case. Remaining events will NOT be synced.`);
        MSCalendarLogger.warn(`⚠️ [Pagination] CRITICAL: Please clean up old events or split into multiple calendars.`);
        
        // 🔔 通知用户
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-pagination-limit', {
            detail: {
              calendarId,
              fetchedCount: allEvents.length,
              pageCount,
              hasMore: true,
              warning: `Calendar has more than ${allEvents.length} events. This may cause sync issues.`
            }
          }));
        }
      }
      
      // 📊 显示分页统计
      if (pageCount > 1) {
        MSCalendarLogger.log(`✅ [Pagination] Fetched ${allEvents.length} events from ${pageCount} pages for calendar ${calendarId}`);
      }
      
      // 📈 如果超过 50 页（50,000 个事件），给出建议
      if (pageCount > 50 && !nextLink) {
        MSCalendarLogger.warn(`⚠️ [Pagination] Calendar ${calendarId} has ${allEvents.length} events across ${pageCount} pages.`);
        MSCalendarLogger.warn(`⚠️ [Pagination] Consider archiving old events to improve sync performance.`);
      }

      // Got events from calendar

      const processedEvents = allEvents.map((outlookEvent: any) => {
        const startTime = this.convertUtcToBeijing(outlookEvent.start?.dateTime);
        const endTime = this.convertUtcToBeijing(outlookEvent.end?.dateTime);
        
        const rawDescription = outlookEvent.body?.content || `${outlookEvent.subject} - 来自 Outlook 的日程`;
        
        // 🆕 处理组织者信息
        let organizer: Contact | null = outlookEvent.organizer?.emailAddress ? {
          name: outlookEvent.organizer.emailAddress.name || outlookEvent.organizer.emailAddress.address,
          email: outlookEvent.organizer.emailAddress.address,
          isOutlook: true
        } : null;
        
        // 🆕 处理与会者信息
        let attendees: Contact[] = outlookEvent.attendees ? outlookEvent.attendees.map((attendee: any) => ({
          name: attendee.emailAddress?.name || attendee.emailAddress?.address,
          email: attendee.emailAddress?.address,
          type: attendee.type || 'required',
          status: attendee.status?.response || 'none',
          isOutlook: true
        })).filter((a: any) => a.email) : [];
        
        // 🔍 从描述中提取 ReMarkable 联系人信息
        const extractedContacts = extractContactsFromDescription(rawDescription);
        if (extractedContacts.organizer) {
          organizer = extractedContacts.organizer;
        }
        if (extractedContacts.attendees.length > 0) {
          attendees = extractedContacts.attendees;
        }
        const cleanDescription = extractedContacts.cleanDescription || rawDescription;
        const eventTitle = outlookEvent.subject || 'Untitled Event';
        
        return {
          id: `outlook-${outlookEvent.id}`,
          title: { simpleTitle: eventTitle, colorTitle: eventTitle, fullTitle: JSON.stringify([{ type: 'paragraph', children: [{ text: eventTitle }] }]) },
          subject: eventTitle,
          description: cleanDescription,
          bodyPreview: outlookEvent.bodyPreview || outlookEvent.body?.content?.substring(0, 100) || `${eventTitle} - 来自 Outlook 的日程`,
          startTime: startTime,
          endTime: endTime,
          start: {
            dateTime: startTime,
            timeZone: outlookEvent.start?.timeZone || 'UTC'
          },
          end: {
            dateTime: endTime,
            timeZone: outlookEvent.end?.timeZone || 'UTC'
          },
          created: this.safeFormatDateTime(outlookEvent.createdDateTime),
          modified: this.safeFormatDateTime(outlookEvent.lastModifiedDateTime),
          createdAt: this.safeFormatDateTime(outlookEvent.createdDateTime),
          updatedAt: this.safeFormatDateTime(outlookEvent.lastModifiedDateTime),
          location: outlookEvent.location?.displayName || '',
          organizer: organizer,
          attendees: attendees,
          isAllDay: outlookEvent.isAllDay || false,
          isTimeCalendar: true, // 🆕 标记为 TimeCalendar 事件，确保在 PlanManager 中显示
          reminder: 0,
          externalId: outlookEvent.id,
          calendarIds: [calendarId], // 🔧 使用数组格式，与类型定义保持一致
          source: 'outlook',
          remarkableSource: true,
          syncStatus: 'synced'
        };
      }).filter(Boolean);

      // Processed events from calendar
      return processedEvents;
      
    } catch (error) {
      MSCalendarLogger.error(`❌ Error getting events from calendar ${calendarId}:`, error);
      return [];
    }
  }

  // 🔧 统一的 updateEvent 方法
  async updateEvent(eventId: string, eventData: any): Promise<any> {
    if (this.simulationMode) {
      MSCalendarLogger.log('📝 Simulating event update:', eventId);
      return { id: eventId, ...eventData };
    }

    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const startDateTime = eventData.start?.dateTime || eventData.startTime;
      const endDateTime = eventData.end?.dateTime || eventData.endTime;
      
      // 处理组织者和参会人：分离有效和无效的联系人
      const invalidContacts = {
        organizer: eventData.organizer?.name && !eventData.organizer?.email ? eventData.organizer : undefined,
        attendees: eventData.attendees?.filter((a: any) => a.name && !a.email) || []
      };
      
      // 整合无效联系人到描述中
      const description = integrateContactsToDescription(
        eventData.description,
        invalidContacts.organizer,
        invalidContacts.attendees
      );
      
      const outlookEventData: any = {
        subject: eventData.subject || eventData.title?.simpleTitle || 'Untitled Event',
        body: eventData.body || { contentType: 'Text', content: description }
      };
      
      // 🔧 强化时间字段处理和验证
      if (startDateTime && endDateTime) {
        try {
          // ✅ 转换为 Date 对象
          const startDate = typeof startDateTime === 'string' ? new Date(startDateTime) : startDateTime;
          const endDate = typeof endDateTime === 'string' ? new Date(endDateTime) : endDateTime;
          
          // 验证时间有效性
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid date values detected');
          }
          
          // ✅ 使用 formatTimeForOutlook 生成 ISO 8601 格式（T分隔）
          outlookEventData.start = {
            dateTime: this.formatTimeForOutlook(startDate),
            timeZone: 'Asia/Shanghai'
          };
          outlookEventData.end = {
            dateTime: this.formatTimeForOutlook(endDate),
            timeZone: 'Asia/Shanghai'
          };
          
          
        } catch (timeError) {
          MSCalendarLogger.error('❌ [updateEvent] Time format error:', timeError);
          throw new Error(`Time format error: ${timeError instanceof Error ? timeError.message : 'Unknown time error'}`);
        }
      } else {
        MSCalendarLogger.warn('⚠️ [updateEvent] Missing time data, skipping time fields');
      }
      
      // 🔧 只有当位置信息存在时才添加位置字段
      if (eventData.location) {
        outlookEventData.location = { displayName: eventData.location };
      }
      
      // 🔧 只有当 isAllDay 字段明确指定时才添加
      if (typeof eventData.isAllDay === 'boolean') {
        outlookEventData.isAllDay = eventData.isAllDay;
      }
      
      // 🔧 添加组织者（仅当有邮箱时）
      if (eventData.organizer?.email) {
        outlookEventData.organizer = {
          emailAddress: {
            name: eventData.organizer.name || eventData.organizer.email,
            address: eventData.organizer.email
          }
        };
      }
      
      // 🔧 添加参会人（仅包含有邮箱的）
      if (eventData.attendees?.length > 0) {
        outlookEventData.attendees = eventData.attendees
          .filter((a: any) => a.email)
          .map((attendee: any) => ({
            emailAddress: {
              name: attendee.name || attendee.email,
              address: attendee.email
            },
            type: attendee.type || 'required',
          }));
      }
      
      const eventResponse = await this.callGraphAPI(`/me/events/${eventId}`, 'PATCH', outlookEventData);
      return eventResponse;
      
    } catch (error) {
      // 🔧 如果事件已经不存在（404），抛出特定错误
      if (error instanceof Error && error.message.includes('404')) {
        MSCalendarLogger.warn('⚠️ Event not found for update, may have been deleted:', eventId);
        throw new Error(`Event not found: ${eventId}`);
      }
      MSCalendarLogger.error('❌ Failed to update event:', error);
      throw error;
    }
  }

  // 🔧 统一的 deleteEvent 方法
  async deleteEvent(eventId: string): Promise<void> {
    if (this.simulationMode) {
      MSCalendarLogger.log('🗑️ Simulating event deletion:', eventId);
      return;
    }

    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }
      
      await this.callGraphAPI(`/me/events/${eventId}`, 'DELETE');
      
    } catch (error) {
      // 🔧 如果事件已经不存在（404），认为删除成功
      if (error instanceof Error && error.message.includes('404')) {
        MSCalendarLogger.log('⚠️ Event already deleted or not found, treating as successful deletion:', eventId);
        return; // 删除成功
      }
      MSCalendarLogger.error('❌ Failed to delete event:', error);
      throw error;
    }
  }

  // 🔧 统一的 createEvent 方法
  async createEvent(eventData: any): Promise<any> {
    if (this.simulationMode) {
      return this.createSimulatedEvent(eventData);
    }

    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const startDateTime = eventData.start?.dateTime || eventData.startTime;
      const endDateTime = eventData.end?.dateTime || eventData.endTime;
      
      const outlookEventData = {
        subject: eventData.subject || eventData.title?.simpleTitle || 'Untitled Event',
        body: eventData.body || { contentType: 'Text', content: eventData.description || '' },
        start: {
          dateTime: this.formatTimeForOutlook(typeof startDateTime === 'string' ? new Date(startDateTime) : startDateTime),
          timeZone: 'Asia/Shanghai'
        },
        end: {
          dateTime: this.formatTimeForOutlook(typeof endDateTime === 'string' ? new Date(endDateTime) : endDateTime),
          timeZone: 'Asia/Shanghai'
        },
        location: eventData.location ? { displayName: eventData.location } : undefined,
        isAllDay: eventData.isAllDay || false,
        // 添加组织者（仅当有邮箱时）
        organizer: eventData.organizer?.email ? {
          emailAddress: {
            name: eventData.organizer.name || eventData.organizer.email,
            address: eventData.organizer.email
          }
        } : undefined,
        // 添加参会人（仅包含有邮箱的）
        attendees: eventData.attendees?.length > 0 
          ? eventData.attendees
              .filter((a: any) => a.email)
              .map((attendee: any) => ({
                emailAddress: {
                  name: attendee.name || attendee.email,
                  address: attendee.email
                },
                type: attendee.type || 'required',
              }))
          : undefined
      };
      
      const eventResponse = await this.callGraphAPI('/me/events', 'POST', outlookEventData);
      return eventResponse;
      
    } catch (error) {
      MSCalendarLogger.error('❌ Failed to create event:', error);
      this.enableSimulationMode();
      return this.createSimulatedEvent(eventData);
    }
  }

  // 🔧 统一的 forceSync 方法 - 简化版，不触发window事件
  async forceSync(): Promise<GraphEvent[]> {
    MSCalendarLogger.log(`🚀 [forceSync] Starting manual sync (no auto-events)...`);
    try {
      const events = await this.getEvents();
      
      // Force sync completed
      this.notifyEventChange(events);
      this.lastSyncTime = new Date();
      
      return events;
    } catch (error) {
      MSCalendarLogger.error('❌ Force sync error:', error);
      throw error;
    }
  }

  private safeFormatDateTime(dateTimeStr: string | undefined | null): string {
    if (!dateTimeStr) return formatTimeForStorage(new Date());
    
    try {
      const date = new Date(dateTimeStr);
      return isNaN(date.getTime()) ? formatTimeForStorage(new Date()) : formatTimeForStorage(date);
    } catch (error) {
      return formatTimeForStorage(new Date());
    }
  }

  private formatTimeForOutlook(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  private getSimulatedEvents(): GraphEvent[] {
    return [];
  }

  private createSimulatedEvent(event: any): GraphEvent {
    return {
      id: `simulated-${Date.now()}`,
      subject: event.title?.simpleTitle || 'Simulated Event'
    };
  }

  private notifyEventChange(events: GraphEvent[]) {
    this.eventChangeListeners.forEach(listener => {
      try {
        listener(events);
      } catch (error) {
        MSCalendarLogger.error('❌ Event listener error:', error);
      }
    });
  }

  // 🔧 临时禁用的方法
  startRealTimeSync() {
    MSCalendarLogger.log(`⏸️ [startRealTimeSync] TEMPORARILY DISABLED - preventing infinite loop`);
    return;
  }

  private async checkForOutlookChanges() {
    MSCalendarLogger.log(`⏸️ [checkForOutlookChanges] TEMPORARILY DISABLED - preventing infinite loop`);
    return;
  }

  stopRealTimeSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  isSignedIn(): boolean {
    return this.isAuthenticated && !!this.accessToken;
  }

  /**
   * 🔧 [NEW] 主动检查 token 是否过期
   * 返回 true 表示 token 有效，false 表示已过期
   */
  checkTokenExpiration(): boolean {
    if (!this.isAuthenticated || !this.accessToken) {
      return false;
    }

    // 从 localStorage 读取过期时间
    const expiresAt = localStorage.getItem('ms-token-expires');
    if (!expiresAt) {
      MSCalendarLogger.warn('⚠️ [Token Check] No expiration time found in localStorage');
      return true; // 没有过期时间，假设有效（避免误判）
    }

    const expiresTime = parseInt(expiresAt);
    const now = Date.now();
    
    // 提前 5 分钟判定为过期（避免在使用时才发现过期）
    const bufferTime = 5 * 60 * 1000; // 5 分钟
    
    if (now >= expiresTime - bufferTime) {
      MSCalendarLogger.warn('⚠️ [Token Check] Token expired or expiring soon', {
        expiresAt: new Date(expiresTime).toLocaleString(),
        now: new Date(now).toLocaleString(),
        remainingMinutes: Math.floor((expiresTime - now) / 60000)
      });
      
      // Token 已过期，触发认证失败处理
      this.handleAuthenticationFailure();
      return false;
    }

    return true;
  }

  /**
   * 处理认证失败（401 错误）
   * 清除认证状态并通知应用
   */
  handleAuthenticationFailure(): void {
    MSCalendarLogger.error('🔴 [Auth] Authentication failed - Token expired or invalid');
    
    // 清除认证状态
    this.isAuthenticated = false;
    this.accessToken = null;
    
    // 清除 localStorage 中的认证标记
    localStorage.setItem('remarkable-outlook-authenticated', 'false');
    
    // 触发自定义事件通知应用
    window.dispatchEvent(new CustomEvent('auth-expired', {
      detail: { 
        message: 'Microsoft 账户认证已过期，请重新登录',
        timestamp: new Date()
      }
    }));
    
    MSCalendarLogger.log('📢 [Auth] Dispatched auth-expired event');
  }

  /**
   * 重新加载令牌（用于 Electron 环境认证后）
   */
  async reloadToken(): Promise<boolean> {
    try {
      MSCalendarLogger.log('🔄 [ReloadToken] 重新加载访问令牌...');
      
      // 从 localStorage 加载
      const token = localStorage.getItem('ms-access-token');
      const expiresAt = localStorage.getItem('ms-token-expires');
      
      if (token && expiresAt) {
        const expiresTime = parseInt(expiresAt);
        const now = Date.now();
        
        if (now < expiresTime - 60000) {
          MSCalendarLogger.log('✅ [ReloadToken] 成功加载有效的访问令牌');
          this.accessToken = token;
          this.isAuthenticated = true;
          this.simulationMode = false;
          
          // 🔧 [FIX v1.7.4] 触发认证状态更新事件
          // 确保 StatusBar 和其他组件能够实时更新状态
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-state-changed', { 
              detail: { isAuthenticated: true } 
            }));
            MSCalendarLogger.log('🔔 [ReloadToken] 触发了 auth-state-changed 事件');
          }
          
          return true;
        } else {
          MSCalendarLogger.log('⚠️ [ReloadToken] 访问令牌已过期');
          return false;
        }
      }
      
      MSCalendarLogger.log('⚠️ [ReloadToken] 未找到访问令牌');
      return false;
    } catch (error) {
      MSCalendarLogger.error('❌ [ReloadToken] 重新加载令牌失败:', error);
      return false;
    }
  }

  getCurrentAccount() {
    return this.msalInstance.getActiveAccount();
  }

  getIsSimulationMode(): boolean {
    return this.simulationMode;
  }

  addEventChangeListener(listener: (events: GraphEvent[]) => void) {
    this.eventChangeListeners.push(listener);
  }

  removeEventChangeListener(listener: (events: GraphEvent[]) => void) {
    this.eventChangeListeners = this.eventChangeListeners.filter(l => l !== listener);
  }

  // =================================
  // 日历分组管理方法
  // =================================

  /**
   * 获取所有日历分组
   */
  async getCalendarGroups(): Promise<CalendarGroup[]> {
    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error('未认证，无法获取日历分组');
    }

    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/calendarGroups', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`获取日历分组失败: ${response.status}`);
      }

      const data = await response.json();
      this.calendarGroups = data.value || [];
      
      MSCalendarLogger.log('✅ 成功获取日历分组:', this.calendarGroups.length, '个');
      return this.calendarGroups;
      
    } catch (error) {
      MSCalendarLogger.error('❌ 获取日历分组失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定分组下的日历列表
   */
  async getCalendarsInGroup(groupId: string): Promise<Calendar[]> {
    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error('未认证，无法获取日历列表');
    }

    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendarGroups/${groupId}/calendars`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`获取日历列表失败: ${response.status}`);
      }

      const data = await response.json();
      const calendars = data.value || [];
      
      MSCalendarLogger.log(`✅ 成功获取分组 ${groupId} 下的日历:`, calendars.length, '个');
      return calendars;
      
    } catch (error) {
      MSCalendarLogger.error('❌ 获取日历列表失败:', error);
      throw error;
    }
  }

  /**
   * 🔧 获取用户的默认日历
   * 通过 /me/calendar 端点获取，这是 Microsoft Graph API 的标准方式
   */
  async getDefaultCalendar(): Promise<Calendar> {
    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error('未认证，无法获取默认日历');
    }

    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`获取默认日历失败: ${response.status}`);
      }

      const calendar = await response.json();
      MSCalendarLogger.log('✅ 成功获取默认日历:', {
        id: calendar.id,
        name: calendar.name
      });
      return calendar;
      
    } catch (error) {
      MSCalendarLogger.error('❌ 获取默认日历失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有日历（包括默认日历）
   */
  async getAllCalendars(): Promise<Calendar[]> {
    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error('未认证，无法获取日历列表');
    }

    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`获取所有日历失败: ${response.status}`);
      }

      const data = await response.json();
      this.calendars = data.value || [];
      
      MSCalendarLogger.log('✅ 成功获取所有日历:', this.calendars.length, '个');
      return this.calendars;
      
    } catch (error) {
      MSCalendarLogger.error('❌ 获取所有日历失败:', error);
      throw error;
    }
  }

  /**
   * 🔧 [NEW] 验证日历是否存在
   * @param calendarId 要验证的日历ID
   * @returns true 表示日历存在，false 表示不存在
   */
  async validateCalendarExists(calendarId: string): Promise<boolean> {
    if (!calendarId) {
      MSCalendarLogger.warn('⚠️ [validateCalendarExists] Empty calendarId provided');
      return false;
    }

    try {
      // 🔧 [FIX v1.7.4] 先确保日历缓存已加载到内存
      // 避免缓存正在加载时直接发起 API 请求
      if (!this.calendars || this.calendars.length === 0) {
        MSCalendarLogger.log('📥 [validateCalendarExists] Calendar cache empty, loading from storage...');
        await this.ensureCalendarCacheLoaded();
      }
      
      // 检查缓存（现在应该已经加载到内存了）
      if (this.calendars && this.calendars.length > 0) {
        const existsInCache = this.calendars.some(cal => cal.id === calendarId);
        if (existsInCache) {
          MSCalendarLogger.log('✅ [validateCalendarExists] Calendar found in cache:', calendarId);
          return true;
        }
        
        // 🔧 缓存中找不到，记录详细信息用于调试
        MSCalendarLogger.warn('⚠️ [validateCalendarExists] Calendar not in cache:', {
          searchId: calendarId,
          cachedCount: this.calendars.length,
          cachedIds: this.calendars.map(c => c.id).slice(0, 5) // 只显示前5个
        });
      }

      // 缓存中没有，尝试直接访问该日历
      MSCalendarLogger.log('🔍 [validateCalendarExists] Checking via API...');
      const url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}`;
      const calendar = await this.callGraphAPI(url, 'GET');
      
      if (calendar && calendar.id) {
        MSCalendarLogger.log('✅ [validateCalendarExists] Calendar exists:', {
          id: calendar.id,
          name: calendar.name
        });
        return true;
      }
      
      return false;
    } catch (error) {
      MSCalendarLogger.warn('⚠️ [validateCalendarExists] Calendar not found or inaccessible:', {
        calendarId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * 创建新的日历分组
   */
  async createCalendarGroup(name: string): Promise<CalendarGroup> {
    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error('未认证，无法创建日历分组');
    }

    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/calendarGroups', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name
        })
      });

      if (!response.ok) {
        throw new Error(`创建日历分组失败: ${response.status}`);
      }

      const newGroup = await response.json();
      this.calendarGroups.push(newGroup);
      
      MSCalendarLogger.log('✅ 成功创建日历分组:', newGroup.name);
      return newGroup;
      
    } catch (error) {
      MSCalendarLogger.error('❌ 创建日历分组失败:', error);
      throw error;
    }
  }

  /**
   * 在指定分组中创建新日历
   */
  async createCalendarInGroup(groupId: string, name: string, color?: string): Promise<Calendar> {
    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error('未认证，无法创建日历');
    }

    try {
      const calendarData: any = { name };
      if (color) {
        calendarData.color = color;
      }

      const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendarGroups/${groupId}/calendars`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(calendarData)
      });

      if (!response.ok) {
        throw new Error(`创建日历失败: ${response.status}`);
      }

      const newCalendar = await response.json();
      
      MSCalendarLogger.log('✅ 成功创建日历:', newCalendar.name);
      return newCalendar;
      
    } catch (error) {
      MSCalendarLogger.error('❌ 创建日历失败:', error);
      throw error;
    }
  }

  /**
   * 删除日历分组
   */
  async deleteCalendarGroup(groupId: string): Promise<void> {
    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error('未认证，无法删除日历分组');
    }

    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendarGroups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`删除日历分组失败: ${response.status}`);
      }

      this.calendarGroups = this.calendarGroups.filter(group => group.id !== groupId);
      
      MSCalendarLogger.log('✅ 成功删除日历分组');
      
    } catch (error) {
      MSCalendarLogger.error('❌ 删除日历分组失败:', error);
      throw error;
    }
  }

  /**
   * 设置默认同步日历
   */
  setSelectedCalendar(calendarId: string): void {
    this.selectedCalendarId = calendarId;
    localStorage.setItem('selectedCalendarId', calendarId);
    MSCalendarLogger.log('📅 设置默认同步日历:', calendarId);
  }

  /**
   * 获取当前选择的日历ID
   */
  getSelectedCalendarId(): string | null {
    if (!this.selectedCalendarId) {
      this.selectedCalendarId = localStorage.getItem('selectedCalendarId');
    }
    return this.selectedCalendarId;
  }
  
  /**
   * 获取有效的日历ID，如果没有选定的日历，则异步获取默认日历
   * @returns Promise<string> 有效的日历ID
   */
  async getValidCalendarId(): Promise<string> {
    let calendarId = this.getSelectedCalendarId();
    
    if (!calendarId) {
      // 获取默认日历并保存
      const defaultCalendar = await this.getDefaultCalendar();
      calendarId = defaultCalendar.id;
      this.setSelectedCalendar(calendarId);
      MSCalendarLogger.log('📅 自动设置默认日历:', calendarId);
    }
    
    return calendarId;
  }

  /**
   * 同步事件到指定日历
   */
  async syncEventToCalendar(event: any, calendarId?: string): Promise<string> {
    const targetCalendarId = calendarId || this.getSelectedCalendarId();
    
    
    if (!targetCalendarId) {
      throw new Error('未指定目标日历，请先选择默认日历');
    }

    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error('未认证，无法同步事件');
    }

    try {
      // 转换事件格式为 Outlook 格式
      const startDateTime = event.start?.dateTime || event.startTime;
      const endDateTime = event.end?.dateTime || event.endTime;
      
      // 处理组织者和参会人：分离有效和无效的联系人
      const validAttendees = event.attendees?.filter((a: any) => a.email) || [];
      const invalidContacts = {
        organizer: event.organizer?.name && !event.organizer?.email ? event.organizer : undefined,
        attendees: event.attendees?.filter((a: any) => a.name && !a.email) || []
      };
      
      // 整合无效联系人到描述中
      const description = integrateContactsToDescription(
        event.description,
        invalidContacts.organizer,
        invalidContacts.attendees
      );
      
      const outlookEventData = {
        subject: event.subject || event.title?.simpleTitle || 'Untitled Event',
        body: event.body || { contentType: 'Text', content: description },
        start: {
          dateTime: typeof startDateTime === 'string' ? startDateTime : formatTimeForStorage(startDateTime),
          timeZone: 'Asia/Shanghai'
        },
        end: {
          dateTime: typeof endDateTime === 'string' ? endDateTime : formatTimeForStorage(endDateTime),
          timeZone: 'Asia/Shanghai'
        },
        location: event.location 
          ? (typeof event.location === 'string' 
              ? { displayName: event.location }
              : event.location)
          : undefined,
        isAllDay: event.isAllDay || false,
        // 只添加有邮箱的组织者
        organizer: event.organizer?.email ? {
          emailAddress: {
            name: event.organizer.name || event.organizer.email,
            address: event.organizer.email
          }
        } : undefined,
        // 只添加有邮箱的参会人
        attendees: validAttendees.length > 0 
          ? validAttendees.map((attendee: any) => ({
              emailAddress: {
                name: attendee.name || attendee.email,
                address: attendee.email
              },
              type: attendee.type || 'required', // required, optional, resource
            }))
          : undefined
      };
      
      MSCalendarLogger.log('🎯 [syncEventToCalendar] Converted event data:', outlookEventData);
      MSCalendarLogger.log('📝 [syncEventToCalendar] Invalid contacts integrated to description:', invalidContacts);
      
      // 🔍 验证数据：确保所有字段都是正确的类型
      const cleanedData = {
        subject: outlookEventData.subject,
        body: outlookEventData.body && typeof outlookEventData.body === 'object' 
          ? {
              contentType: outlookEventData.body.contentType || 'Text',
              content: (outlookEventData.body.content || '').toString().trim() || ' ' // ✅ Outlook 不接受空字符串，用单空格代替
            }
          : { contentType: 'Text', content: ' ' },
        start: outlookEventData.start,
        end: outlookEventData.end,
        location: outlookEventData.location || undefined,
        isAllDay: Boolean(outlookEventData.isAllDay),
        organizer: outlookEventData.organizer || undefined,
        attendees: outlookEventData.attendees || undefined
      };
      
      // 🔍 移除所有 undefined 字段（Outlook API 可能不接受 undefined）
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key as keyof typeof cleanedData] === undefined) {
          delete cleanedData[key as keyof typeof cleanedData];
        }
      });
      
      MSCalendarLogger.log('🧹 [syncEventToCalendar] Cleaned data (removed undefined):', cleanedData);
      
      const endpoint = `https://graph.microsoft.com/v1.0/me/calendars/${targetCalendarId}/events`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanedData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        MSCalendarLogger.error('❌ Graph API Error Response:', errorText);
        throw new Error(`同步事件到指定日历失败: ${response.status} - ${errorText}`);
      }

      const createdEvent = await response.json();
      MSCalendarLogger.log('✅ 成功同步事件到日历:', targetCalendarId);
      return createdEvent.id;
      
    } catch (error) {
      MSCalendarLogger.error('❌ 同步事件到指定日历失败:', error);
      throw error;
    }
  }
}