import { electronMicrosoftAuth } from './ElectronMicrosoftAuth';
import { electronWindowAuth } from './ElectronWindowAuth';

/**
 * Microsoft日历认证服务 - 简化版本
 * 使用新的ElectronMicrosoftAuth进行认证
 */
export class SimplifiedMicrosoftCalendarService {
  private accessToken: string | null = null;
  private isAuthenticated: boolean = false;

  constructor() {
    this.loadStoredToken();
  }

  /**
   * 从本地存储加载访问令牌
   */
  private loadStoredToken(): void {
    try {
      // 优先从主进程获取共享令牌（如果在Electron中）
      if ((window as any).electronAPI && (window as any).electronAPI.getAuthTokens) {
        (window as any).electronAPI.getAuthTokens().then((tokens: any) => {
          if (tokens && tokens.accessToken && tokens.expiresAt) {
            const now = Date.now();
            if (now < tokens.expiresAt - 60000) {
              this.accessToken = tokens.accessToken;
              this.isAuthenticated = true;
              console.log('✅ 从主进程加载了有效的访问令牌');
              return;
            }
          }

          // 回退到localStorage
          const token = localStorage.getItem('ms-access-token');
          const expiresAt = localStorage.getItem('ms-token-expires');
          if (token && expiresAt) {
            const expiresTime = parseInt(expiresAt);
            const now2 = Date.now();
            if (now2 < expiresTime - 60000) {
              this.accessToken = token;
              this.isAuthenticated = true;
              console.log('✅ 从localStorage加载了有效的访问令牌');
            } else {
              console.log('⚠️ 访问令牌已过期');
              this.clearStoredTokens();
            }
          }
        }).catch((err: any) => {
          console.warn('无法从主进程读取令牌，回退到localStorage', err);
          const token = localStorage.getItem('ms-access-token');
          const expiresAt = localStorage.getItem('ms-token-expires');
          if (token && expiresAt) {
            const expiresTime = parseInt(expiresAt);
            const now2 = Date.now();
            if (now2 < expiresTime - 60000) {
              this.accessToken = token;
              this.isAuthenticated = true;
              console.log('✅ 从localStorage加载了有效的访问令牌');
            } else {
              console.log('⚠️ 访问令牌已过期');
              this.clearStoredTokens();
            }
          }
        });
        return;
      }

      // 非Electron或主进程不可用时使用localStorage
      const token = localStorage.getItem('ms-access-token');
      const expiresAt = localStorage.getItem('ms-token-expires');
      
      if (token && expiresAt) {
        const expiresTime = parseInt(expiresAt);
        const now = Date.now();
        
        if (now < expiresTime - 60000) { // 提前1分钟检查过期
          this.accessToken = token;
          this.isAuthenticated = true;
          console.log('✅ 加载了有效的访问令牌');
        } else {
          console.log('⚠️ 访问令牌已过期');
          this.clearStoredTokens();
        }
      }
    } catch (error) {
      console.error('❌ 加载令牌失败:', error);
    }
  }

  /**
   * 清除存储的令牌
   */
  private clearStoredTokens(): void {
    localStorage.removeItem('ms-access-token');
    localStorage.removeItem('ms-refresh-token');
    localStorage.removeItem('ms-token-expires');
    this.accessToken = null;
    this.isAuthenticated = false;
  }

  /**
   * 使用设备代码流程登录
   */
  public async authenticateWithDeviceCode(): Promise<any> {
    try {
      console.log('🔐 开始设备代码认证...');
      const result = await electronMicrosoftAuth.authenticateWithDeviceCode();
      
      // 保存令牌
      localStorage.setItem('ms-access-token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('ms-refresh-token', result.refreshToken);
      }
      localStorage.setItem('ms-token-expires', (Date.now() + result.expiresIn * 1000).toString());
      
      this.accessToken = result.accessToken;
      this.isAuthenticated = true;
      
      // 将令牌写入主进程以供widget等窗口共享
      try {
        if ((window as any).electronAPI && (window as any).electronAPI.setAuthTokens) {
          (window as any).electronAPI.setAuthTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: Date.now() + result.expiresIn * 1000
          });
        }
      } catch (err) {
        console.warn('无法将令牌写入主进程', err);
      }

      console.log('✅ 设备代码认证成功');
      return result;
    } catch (error) {
      console.error('❌ 设备代码认证失败:', error);
      throw error;
    }
  }

  /**
   * 使用浏览器OAuth流程登录
   */
  public async authenticateWithBrowser(): Promise<any> {
    try {
      console.log('🌐 开始浏览器认证...');
      const result = await electronMicrosoftAuth.authenticateWithBrowser();
      
      // 保存令牌
      localStorage.setItem('ms-access-token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('ms-refresh-token', result.refreshToken);
      }
      localStorage.setItem('ms-token-expires', (Date.now() + result.expiresIn * 1000).toString());
      
      this.accessToken = result.accessToken;
      this.isAuthenticated = true;
      // 将令牌写入主进程以供widget等窗口共享
      try {
        if ((window as any).electronAPI && (window as any).electronAPI.setAuthTokens) {
          (window as any).electronAPI.setAuthTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: Date.now() + result.expiresIn * 1000
          });
        }
      } catch (err) {
        console.warn('无法将令牌写入主进程', err);
      }

      console.log('✅ 浏览器认证成功');
      return result;
    } catch (error) {
      console.error('❌ 浏览器认证失败:', error);
      throw error;
    }
  }

  /**
   * 使用BrowserWindow窗口登录（推荐）
   * 用户在Electron窗口内完成登录，无需手动操作
   */
  public async authenticateWithWindow(): Promise<any> {
    try {
      console.log('🪟 开始窗口认证...');
      const result = await electronWindowAuth.authenticateWithWindow();
      
      // 保存令牌
      localStorage.setItem('ms-access-token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('ms-refresh-token', result.refreshToken);
      }
      localStorage.setItem('ms-token-expires', (Date.now() + result.expiresIn * 1000).toString());
      
      this.accessToken = result.accessToken;
      this.isAuthenticated = true;
      
      // 将令牌写入主进程以供widget等窗口共享
      try {
        if ((window as any).electronAPI && (window as any).electronAPI.setAuthTokens) {
          (window as any).electronAPI.setAuthTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: Date.now() + result.expiresIn * 1000
          });
        }
      } catch (err) {
        console.warn('无法将令牌写入主进程', err);
      }

      console.log('✅ 窗口认证成功');
      return result;
    } catch (error) {
      console.error('❌ 窗口认证失败:', error);
      throw error;
    }
  }

  /**
   * 刷新访问令牌
   */
  public async refreshToken(): Promise<any> {
    const refreshToken = localStorage.getItem('ms-refresh-token');
    if (!refreshToken) {
      throw new Error('没有可用的刷新令牌');
    }

    try {
      console.log('🔄 刷新访问令牌...');
      const result = await electronMicrosoftAuth.refreshToken(refreshToken);
      
      // 更新令牌
      localStorage.setItem('ms-access-token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('ms-refresh-token', result.refreshToken);
      }
      localStorage.setItem('ms-token-expires', (Date.now() + result.expiresIn * 1000).toString());
      
      this.accessToken = result.accessToken;
      this.isAuthenticated = true;
      
      console.log('✅ 令牌刷新成功');
      return result;
    } catch (error) {
      console.error('❌ 令牌刷新失败:', error);
      this.clearStoredTokens();
      throw error;
    }
  }

  /**
   * 检查是否已认证
   */
  public isUserAuthenticated(): boolean {
    return this.isAuthenticated && !!this.accessToken;
  }

  /**
   * 登出
   */
  public logout(): void {
    this.clearStoredTokens();
    console.log('👋 已登出');
  }

  /**
   * 调用Microsoft Graph API
   */
  private async callGraphAPI(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    if (!this.accessToken) {
      // 尝试从主进程获取共享令牌（widget 场景）
      try {
        if ((window as any).electronAPI && (window as any).electronAPI.getAuthTokens) {
          const tokens = await (window as any).electronAPI.getAuthTokens();
          if (tokens && tokens.accessToken) {
            this.accessToken = tokens.accessToken;
            // 不标记为完全认证，以便refresh逻辑继续生效
            this.isAuthenticated = true;
            console.log('✅ 从主进程获取到访问令牌，继续请求');
          }
        }
      } catch (err) {
        console.warn('无法从主进程获取令牌', err);
      }

      if (!this.accessToken) {
        throw new Error('未认证，请先登录');
      }
    }

    const url = `https://graph.microsoft.com/v1.0${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    console.log(`🌐 调用 Graph API: ${method} ${url}`);

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Graph API 错误 (${response.status}):`, errorText);
        
        if (response.status === 401) {
          // 令牌过期，尝试刷新
          console.log('🔄 访问令牌可能已过期，尝试刷新...');
          await this.refreshToken();
          
          // 重试请求
          const retryOptions = {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${this.accessToken}`,
            },
          };
          
          const retryResponse = await fetch(url, retryOptions);
          if (!retryResponse.ok) {
            throw new Error(`API请求失败: ${retryResponse.status}`);
          }
          return retryResponse.json();
        }
        
        throw new Error(`API请求失败: ${response.status} ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('❌ Graph API 调用失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的日历列表
   */
  public async getCalendars(): Promise<any[]> {
    try {
      const response = await this.callGraphAPI('/me/calendars');
      return response.value || [];
    } catch (error) {
      console.error('❌ 获取日历列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取日历事件
   */
  public async getEvents(calendarId: string = 'primary', startDate?: Date, endDate?: Date): Promise<any[]> {
    try {
      let endpoint = `/me/calendars/${calendarId}/events`;
      
      // 添加日期过滤
      const params = new URLSearchParams();
      if (startDate) {
        params.append('$filter', `start/dateTime ge '${startDate.toISOString()}'`);
      }
      if (endDate) {
        const filter = params.get('$filter');
        const endFilter = `end/dateTime le '${endDate.toISOString()}'`;
        if (filter) {
          params.set('$filter', `${filter} and ${endFilter}`);
        } else {
          params.set('$filter', endFilter);
        }
      }
      
      params.append('$orderby', 'start/dateTime');
      params.append('$top', '1000');
      
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const response = await this.callGraphAPI(endpoint);
      return response.value || [];
    } catch (error) {
      console.error('❌ 获取事件失败:', error);
      throw error;
    }
  }

  /**
   * 创建事件
   */
  public async createEvent(calendarId: string, event: any): Promise<any> {
    try {
      const endpoint = `/me/calendars/${calendarId}/events`;
      return await this.callGraphAPI(endpoint, 'POST', event);
    } catch (error) {
      console.error('❌ 创建事件失败:', error);
      throw error;
    }
  }

  /**
   * 更新事件
   */
  public async updateEvent(calendarId: string, eventId: string, event: any): Promise<any> {
    try {
      const endpoint = `/me/calendars/${calendarId}/events/${eventId}`;
      return await this.callGraphAPI(endpoint, 'PATCH', event);
    } catch (error) {
      console.error('❌ 更新事件失败:', error);
      throw error;
    }
  }

  /**
   * 删除事件
   */
  public async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      const endpoint = `/me/calendars/${calendarId}/events/${eventId}`;
      await this.callGraphAPI(endpoint, 'DELETE');
    } catch (error) {
      console.error('❌ 删除事件失败:', error);
      throw error;
    }
  }

  /**
   * 测试连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.callGraphAPI('/me');
      console.log('✅ Microsoft Graph 连接测试成功');
      return true;
    } catch (error) {
      console.error('❌ Microsoft Graph 连接测试失败:', error);
      return false;
    }
  }
}

// 创建单例实例
export const simplifiedMicrosoftCalendarService = new SimplifiedMicrosoftCalendarService();