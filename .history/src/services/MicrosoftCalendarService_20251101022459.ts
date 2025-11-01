import { PublicClientApplication } from '@azure/msal-browser';
import { MICROSOFT_GRAPH_CONFIG } from '../config/calendar';
import { formatTimeForStorage } from '../utils/timeUtils';
import { STORAGE_KEYS } from '../constants/storage';

import { logger } from '../utils/logger';

const MSCalendarLogger = logger.module('MSCalendar');

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
      this.setSyncMeta({
        lastSyncTime: new Date().toISOString(),
        calendarGroupsCount: groups.length,
        calendarsCount: calendars.length,
        isOfflineMode: false
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
   */
  public async getAllCalendarData(forceRefresh: boolean = false): Promise<{ groups: CalendarGroup[], calendars: Calendar[] }> {
    if (forceRefresh) {
      MSCalendarLogger.log('🔄 [Cache] Force refresh requested, syncing from remote...');
      return await this.syncCalendarGroupsFromRemote();
    }

    // 先尝试从缓存获取
    const cachedGroups = this.getCachedCalendarGroups();
    const cachedCalendars = this.getCachedCalendars();

    if (cachedGroups.length > 0 || cachedCalendars.length > 0) {
      MSCalendarLogger.log('📋 [Cache] Using cached calendar data');
      return { groups: cachedGroups, calendars: cachedCalendars };
    }

    // 缓存为空，尝试从远程同步
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
      
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        this.msalInstance.setActiveAccount(accounts[0]);
        await this.acquireToken();
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
      
      await this.testConnection();
      this.isAuthenticated = true;
      this.simulationMode = false;
      
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
            
            await this.testConnection();
            this.isAuthenticated = true;
            this.simulationMode = false;
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
        // Electron环境：使用外部浏览器认证
        MSCalendarLogger.log('🔧 Electron环境：使用外部浏览器认证');
        
        try {
          // 先尝试无声登录
          const silentResult = await this.msalInstance.ssoSilent({
            scopes: MICROSOFT_GRAPH_CONFIG.scopes,
            account: this.msalInstance.getAllAccounts()[0]
          });
          
          if (silentResult) {
            MSCalendarLogger.log('✅ 无声登录成功');
            this.msalInstance.setActiveAccount(silentResult.account);
            return true;
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
        
        // 在外部浏览器中打开认证页面
        if (window.electronAPI?.openExternalAuth) {
          try {
            await window.electronAPI.openExternalAuth(authUrl);
          } catch (error) {
            throw new Error('无法打开外部认证页面');
          }
        }
        
        // 显示提示信息
        alert('请在外部浏览器中完成Microsoft账户登录，然后返回应用。\n\n如果浏览器没有自动打开，请手动复制链接到浏览器中打开。');
        
        // 这里需要等待用户在外部浏览器完成登录
        // 在实际应用中，可能需要实现一个回调机制
        MSCalendarLogger.log('⚠️ 请在外部浏览器中完成登录，然后手动刷新应用');
        
        return false; // 暂时返回false，需要用户手动刷新
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
        // 🔧 临时禁用自动同步
        // this.startRealTimeSync();
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

    const userSettings = this.getUserSettings();
    const ongoingDays = userSettings?.ongoingDays ?? userSettings?.ongoing ?? 1;
    
    // 🔧 调试日志
    // User settings resolved
    
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - ongoingDays - 1);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 2);
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
      
      // 🔧 修复：用户过滤应该和查询范围一致，使用ongoingDays天数
      const userFilterStart = new Date(now);
      userFilterStart.setDate(now.getDate() - ongoingDays);
      userFilterStart.setHours(0, 0, 0, 0);

      const userFilterEnd = new Date(now);
      userFilterEnd.setDate(now.getDate() + 2); // 保持和查询范围一致
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
        const organizer = outlookEvent.organizer?.emailAddress ? {
          name: outlookEvent.organizer.emailAddress.name || outlookEvent.organizer.emailAddress.address,
          email: outlookEvent.organizer.emailAddress.address
        } : null;
        
        // 🆕 处理与会者信息
        const attendees = outlookEvent.attendees ? outlookEvent.attendees.map((attendee: any) => ({
          name: attendee.emailAddress?.name || attendee.emailAddress?.address,
          email: attendee.emailAddress?.address,
          type: attendee.type || 'required',
          status: attendee.status?.response || 'none'
        })).filter((a: any) => a.email) : [];
        
        return {
          id: `outlook-${outlookEvent.id}`,
          title: outlookEvent.subject || 'Untitled Event',
          subject: outlookEvent.subject || 'Untitled Event',
          description: rawDescription,
          bodyPreview: outlookEvent.bodyPreview || outlookEvent.body?.content?.substring(0, 100) || `${outlookEvent.subject} - 来自 Outlook 的日程`,
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
          reminder: 0,
          externalId: outlookEvent.id,
          calendarId: 'microsoft',
          source: 'outlook',
          remarkableSource: true,
          category: 'ongoing',
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
      const userSettings = this.getUserSettings();
      const ongoingDays = userSettings?.ongoingDays ?? userSettings?.ongoing ?? 1;
      
      const now = new Date();
      queryStartDate = new Date(now);
      queryStartDate.setDate(now.getDate() - ongoingDays - 1);
      queryStartDate.setHours(0, 0, 0, 0);
      
      queryEndDate = new Date(now);
      queryEndDate.setDate(now.getDate() + 2);
      queryEndDate.setHours(23, 59, 59, 999);
      
      // console.log('📅 [getEventsFromCalendar] Using ongoingDays setting:', ongoingDays);
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
      const MAX_PAGES = 10; // 防止无限循环
      
      // 🔧 [CRITICAL FIX] 处理分页，确保获取所有事件
      while (nextLink && pageCount < MAX_PAGES) {
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
          MSCalendarLogger.log(`📄 [Pagination] Fetched page ${pageCount} with ${events.length} events, fetching next page...`);
        }
      }
      
      if (pageCount >= MAX_PAGES && nextLink) {
        MSCalendarLogger.warn(`⚠️ [Pagination] Reached max pages (${MAX_PAGES}) but more data available`);
      }
      
      if (pageCount > 1) {
        MSCalendarLogger.log(`✅ [Pagination] Fetched ${allEvents.length} events from ${pageCount} pages for calendar ${calendarId}`);
      }

      // Got events from calendar

      const processedEvents = allEvents.map((outlookEvent: any) => {
        const startTime = this.convertUtcToBeijing(outlookEvent.start?.dateTime);
        const endTime = this.convertUtcToBeijing(outlookEvent.end?.dateTime);
        
        const rawDescription = outlookEvent.body?.content || `${outlookEvent.subject} - 来自 Outlook 的日程`;
        
        // 🆕 处理组织者信息
        const organizer = outlookEvent.organizer?.emailAddress ? {
          name: outlookEvent.organizer.emailAddress.name || outlookEvent.organizer.emailAddress.address,
          email: outlookEvent.organizer.emailAddress.address
        } : null;
        
        // 🆕 处理与会者信息
        const attendees = outlookEvent.attendees ? outlookEvent.attendees.map((attendee: any) => ({
          name: attendee.emailAddress?.name || attendee.emailAddress?.address,
          email: attendee.emailAddress?.address,
          type: attendee.type || 'required',
          status: attendee.status?.response || 'none'
        })).filter((a: any) => a.email) : [];
        
        return {
          id: `outlook-${outlookEvent.id}`,
          title: outlookEvent.subject || 'Untitled Event',
          subject: outlookEvent.subject || 'Untitled Event',
          description: rawDescription,
          bodyPreview: outlookEvent.bodyPreview || outlookEvent.body?.content?.substring(0, 100) || `${outlookEvent.subject} - 来自 Outlook 的日程`,
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
          reminder: 0,
          externalId: outlookEvent.id,
          calendarId: calendarId, // 使用实际的日历ID
          source: 'outlook',
          remarkableSource: true,
          category: 'ongoing',
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
      
      const outlookEventData: any = {
        subject: eventData.subject || eventData.title,
        body: eventData.body || { contentType: 'Text', content: eventData.description || '' }
      };
      
      // 🔧 强化时间字段处理和验证
      if (startDateTime && endDateTime) {
        try {
          const startFormatted = typeof startDateTime === 'string' ? startDateTime : formatTimeForStorage(startDateTime);
          const endFormatted = typeof endDateTime === 'string' ? endDateTime : formatTimeForStorage(endDateTime);
          
          // 验证时间格式
          if (!startFormatted || !endFormatted) {
            throw new Error('Invalid time format detected');
          }
          
          // 确保时间格式正确
          const startDate = new Date(startFormatted);
          const endDate = new Date(endFormatted);
          
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid date values detected');
          }
          
          outlookEventData.start = {
            dateTime: startFormatted,
            timeZone: 'Asia/Shanghai'
          };
          outlookEventData.end = {
            dateTime: endFormatted,
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
        subject: eventData.subject || eventData.title,
        body: eventData.body || { contentType: 'text', content: eventData.description || '' },
        start: {
          dateTime: typeof startDateTime === 'string' ? startDateTime : formatTimeForStorage(startDateTime),
          timeZone: 'Asia/Shanghai'
        },
        end: {
          dateTime: typeof endDateTime === 'string' ? endDateTime : formatTimeForStorage(endDateTime),
          timeZone: 'Asia/Shanghai'
        },
        location: eventData.location ? { displayName: eventData.location } : undefined,
        isAllDay: eventData.isAllDay || false
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
      subject: event.title || 'Simulated Event'
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
      
      const outlookEventData = {
        subject: event.subject || event.title,
        body: event.body || { contentType: 'Text', content: event.description || '' },
        start: {
          dateTime: typeof startDateTime === 'string' ? startDateTime : formatTimeForStorage(startDateTime),
          timeZone: 'Asia/Shanghai'
        },
        end: {
          dateTime: typeof endDateTime === 'string' ? endDateTime : formatTimeForStorage(endDateTime),
          timeZone: 'Asia/Shanghai'
        },
        location: event.location ? { displayName: event.location } : undefined,
        isAllDay: event.isAllDay || false
      };
      
      MSCalendarLogger.log('🎯 [syncEventToCalendar] Converted event data:', outlookEventData);
      
      const endpoint = `https://graph.microsoft.com/v1.0/me/calendars/${targetCalendarId}/events`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(outlookEventData)
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