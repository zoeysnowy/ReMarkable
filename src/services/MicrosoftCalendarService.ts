import { PublicClientApplication } from '@azure/msal-browser';
import { MICROSOFT_GRAPH_CONFIG } from '../config/calendar';
import { formatTimeForStorage } from '../utils/timeUtils';
import { STORAGE_KEYS } from '../constants/storage';

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
  isAllDay?: boolean;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
}

export class MicrosoftCalendarService {
  private msalInstance!: PublicClientApplication;
  private isAuthenticated: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: Date = new Date();
  private eventChangeListeners: Array<(events: GraphEvent[]) => void> = [];
  private simulationMode: boolean = false;
  private accessToken: string | null = null;

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
      console.error('❌ MicrosoftCalendarService constructor error:', error);
      this.enableSimulationMode();
    }
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
      console.error('❌ Time conversion error:', error);
      return utcTimeStr;
    }
  }

  private async initializeGraph() {
    try {
      await this.msalInstance.initialize();
      
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        this.msalInstance.setActiveAccount(accounts[0]);
        await this.acquireToken();
      }
    } catch (error) {
      console.error('❌ MSAL initialization failed:', error);
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
        } catch (interactiveError) {
          console.error('❌ Interactive token acquisition failed:', interactiveError);
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
        if (response.status === 401) {
          await this.acquireToken();
          
          const retryResponse = await fetch(url, {
            method: method,
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
          });
          
          if (!retryResponse.ok) {
            throw new Error(`Graph API call failed: ${retryResponse.status} ${retryResponse.statusText}`);
          }
          
          return retryResponse.status === 204 ? null : await retryResponse.json();
        } else {
          throw new Error(`Graph API call failed: ${response.status} ${response.statusText}`);
        }
      }

      return response.status === 204 ? null : await response.json();
      
    } catch (error) {
      console.error('❌ Graph API call failed:', error);
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
      console.error('❌ API connection test failed:', error);
      throw error;
    }
  }

  async signIn(): Promise<boolean> {
    try {
      const loginResponse = await this.msalInstance.loginPopup({
        scopes: MICROSOFT_GRAPH_CONFIG.scopes
      });

      this.msalInstance.setActiveAccount(loginResponse.account);
      await this.acquireToken();
      
      if (this.isAuthenticated) {
        // 🔧 临时禁用自动同步
        // this.startRealTimeSync();
        return true;
      }
      return false;
      
    } catch (error) {
      console.error('❌ Login error:', error);
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
        console.error('❌ Logout error:', error);
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
      console.error('❌ Get user info error:', error);
      this.enableSimulationMode();
      throw error;
    }
  }

  private getUserSettings(): any {
    try {
      const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      console.error('❌ Error reading user settings:', error);
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
    
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - ongoingDays - 1);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 2);
    endDate.setHours(23, 59, 59, 999);

    console.log(`📅 Querying events: ${ongoingDays} days back from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

    const queryParams = new URLSearchParams({
      '$select': 'id,subject,body,bodyPreview,start,end,location,isAllDay,createdDateTime,lastModifiedDateTime',
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
      
      const userFilterStart = new Date(now);
      userFilterStart.setDate(now.getDate() - ongoingDays);
      userFilterStart.setHours(0, 0, 0, 0);

      const userFilterEnd = new Date(now);
      userFilterEnd.setDate(now.getDate() + 1);
      userFilterEnd.setHours(23, 59, 59, 999);

      const filteredEvents = events.filter((event: any) => {
        if (!event.start?.dateTime) return false;
        
        const beijingTime = this.convertUtcToBeijing(event.start.dateTime);
        const eventDate = new Date(beijingTime);
        
        return eventDate >= userFilterStart && eventDate <= userFilterEnd;
      });

      console.log(`📅 Filtered ${filteredEvents.length} events within ${ongoingDays} days`);

      const processedEvents = filteredEvents.map((outlookEvent: any) => {
        const startTime = this.convertUtcToBeijing(outlookEvent.start?.dateTime);
        const endTime = this.convertUtcToBeijing(outlookEvent.end?.dateTime);
        
        const rawDescription = outlookEvent.body?.content || `${outlookEvent.subject} - 来自 Outlook 的日程`;
        
        console.log('📝 [MicrosoftCalendarService] Processing event description:', {
          eventId: outlookEvent.id,
          subject: outlookEvent.subject,
          rawDescription: rawDescription.substring(0, 100) + '...',
          fullRawDescription: rawDescription
        });

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

      console.log(`✅ Processed ${processedEvents.length} events successfully`);
      return processedEvents;
      
    } catch (parseError) {
      console.error('❌ Error parsing response:', parseError);
      this.enableSimulationMode();
      return this.getSimulatedEvents();
    }
  }

  // 🔧 统一的 updateEvent 方法
  async updateEvent(eventId: string, eventData: any): Promise<any> {
    if (this.simulationMode) {
      console.log('📝 Simulating event update:', eventId);
      return { id: eventId, ...eventData };
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
      
      const eventResponse = await this.callGraphAPI(`/me/events/${eventId}`, 'PATCH', outlookEventData);
      return eventResponse;
      
    } catch (error) {
      console.error('❌ Failed to update event:', error);
      throw error;
    }
  }

  // 🔧 统一的 deleteEvent 方法
  async deleteEvent(eventId: string): Promise<void> {
    if (this.simulationMode) {
      console.log('🗑️ Simulating event deletion:', eventId);
      return;
    }

    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }
      
      await this.callGraphAPI(`/me/events/${eventId}`, 'DELETE');
      
    } catch (error) {
      console.error('❌ Failed to delete event:', error);
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
      console.error('❌ Failed to create event:', error);
      this.enableSimulationMode();
      return this.createSimulatedEvent(eventData);
    }
  }

  // 🔧 统一的 forceSync 方法 - 简化版，不触发window事件
  async forceSync(): Promise<GraphEvent[]> {
    console.log(`🚀 [forceSync] Starting manual sync (no auto-events)...`);
    try {
      const events = await this.getEvents();
      
      console.log(`🚀 [forceSync] Got ${events.length} events, notifying ${this.eventChangeListeners.length} listeners only`);
      this.notifyEventChange(events);
      this.lastSyncTime = new Date();
      
      return events;
    } catch (error) {
      console.error('❌ Force sync error:', error);
      throw error;
    }
  }

  private safeFormatDateTime(dateTimeStr: string | undefined | null): string {
    if (!dateTimeStr) return new Date().toISOString();
    
    try {
      const date = new Date(dateTimeStr);
      return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    } catch (error) {
      return new Date().toISOString();
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
        console.error('❌ Event listener error:', error);
      }
    });
  }

  // 🔧 临时禁用的方法
  startRealTimeSync() {
    console.log(`⏸️ [startRealTimeSync] TEMPORARILY DISABLED - preventing infinite loop`);
    return;
  }

  private async checkForOutlookChanges() {
    console.log(`⏸️ [checkForOutlookChanges] TEMPORARILY DISABLED - preventing infinite loop`);
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
}