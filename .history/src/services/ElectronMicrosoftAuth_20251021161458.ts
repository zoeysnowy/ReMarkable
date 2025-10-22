/**
 * ElectronMicrosoftAuth - 简化的Electron Microsoft认证服务
 * 使用本地OAuth流程，无需复杂的应用注册
 */

// 动态导入electron模块，避免在Web环境中报错
let electronShell: any = null;
try {
  if (typeof window !== 'undefined' && window.require) {
    electronShell = window.require('electron').shell;
  }
} catch (error) {
  console.log('Not running in Electron environment');
}

export interface ElectronAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

export class ElectronMicrosoftAuth {
  private clientId = 'cf163673-488e-44d9-83ac-0f11d90016ca'; // 公共测试clientId
  private redirectUri = 'http://localhost:3000/auth/callback';
  private scopes = [
    'https://graph.microsoft.com/User.Read',
    'https://graph.microsoft.com/Calendars.Read',
    'https://graph.microsoft.com/Calendars.ReadWrite',
    'offline_access'
  ];

  /**
   * 方法1: 使用设备代码流程（推荐）
   * 这是最简单和最可靠的方法
   */
  async authenticateWithDeviceCode(): Promise<ElectronAuthResult> {
    try {
      console.log('🔐 [ElectronAuth] 开始设备代码认证流程...');
      
      // 第一步：获取设备代码
      const deviceCodeResponse = await this.getDeviceCode();
      
      // 第二步：显示用户代码给用户
      this.showUserCode(deviceCodeResponse);
      
      // 第三步：轮询获取访问令牌
      const tokenResponse = await this.pollForToken(deviceCodeResponse.device_code);
      
      console.log('✅ [ElectronAuth] 认证成功！');
      return tokenResponse;
      
    } catch (error) {
      console.error('❌ [ElectronAuth] 认证失败:', error);
      throw error;
    }
  }

  /**
   * 方法2: 浏览器OAuth流程（备选）
   */
  async authenticateWithBrowser(): Promise<ElectronAuthResult> {
    return new Promise((resolve, reject) => {
      const authUrl = this.buildAuthUrl();
      
      console.log('🌐 [ElectronAuth] 打开浏览器进行认证...');
      console.log('认证URL:', authUrl);
      
      // 在系统默认浏览器中打开认证URL
      // 在Electron中打开外部浏览器
      if (electronShell) {
        electronShell.openExternal(authUrl);
      } else {
        // 在Web环境中打开新窗口
        window.open(authUrl, '_blank');
      }
      
      // 启动本地服务器监听回调
      this.startLocalServer(resolve, reject);
    });
  }

  /**
   * 获取设备代码
   */
  private async getDeviceCode(): Promise<any> {
    const deviceCodeUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode';
    
    const response = await fetch(deviceCodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        scope: this.scopes.join(' ')
      })
    });

    if (!response.ok) {
      throw new Error(`设备代码请求失败: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 显示用户代码
   */
  private showUserCode(deviceCodeData: any) {
    const { user_code, verification_uri, message } = deviceCodeData;
    
    console.log('\n🔑 请按照以下步骤完成认证:');
    console.log('1. 在浏览器中访问:', verification_uri);
    console.log('2. 输入代码:', user_code);
    console.log('3. 使用您的Microsoft账户登录');
    console.log('\n完整说明:', message);

    // 在Electron中显示对话框
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.showMessageBox({
        type: 'info',
        title: 'Microsoft 登录',
        message: '请完成浏览器中的登录步骤',
        detail: `1. 访问: ${verification_uri}\n2. 输入代码: ${user_code}\n3. 使用Microsoft账户登录`,
        buttons: ['确定', '复制代码', '打开浏览器']
      }).then((response) => {
        if (response.response === 1) {
          // 复制代码到剪贴板
          navigator.clipboard.writeText(user_code);
        } else if (response.response === 2) {
          // 打开浏览器
          if (electronShell) {
            electronShell.openExternal(verification_uri);
          } else {
            window.open(verification_uri, '_blank');
          }
        }
      });
    }

    // 自动打开浏览器
    if (electronShell) {
      electronShell.openExternal(verification_uri);
    } else {
      window.open(verification_uri, '_blank');
    }
  }

  /**
   * 轮询获取访问令牌
   */
  private async pollForToken(deviceCode: string): Promise<ElectronAuthResult> {
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const pollInterval = 5000; // 5秒
    const maxAttempts = 60; // 最多等待5分钟
    
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        console.log(`🔄 [ElectronAuth] 检查认证状态... (${attempts + 1}/${maxAttempts})`);
        
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            client_id: this.clientId,
            device_code: deviceCode
          })
        });

        const data = await response.json();

        if (response.ok) {
          // 认证成功
          return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
            tokenType: data.token_type,
            scope: data.scope
          };
        } else if (data.error === 'authorization_pending') {
          // 用户还没有完成认证，继续等待
          attempts++;
          await this.sleep(pollInterval);
        } else if (data.error === 'slow_down') {
          // 请求太频繁，延长等待时间
          await this.sleep(pollInterval + 5000);
        } else {
          // 其他错误
          throw new Error(`认证失败: ${data.error_description || data.error}`);
        }
      } catch (error) {
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        attempts++;
        await this.sleep(pollInterval);
      }
    }

    throw new Error('认证超时，请重试');
  }

  /**
   * 构建认证URL（用于浏览器方式）
   */
  private buildAuthUrl(): string {
    const authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      response_mode: 'query',
      state: this.generateRandomString()
    });

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * 启动本地服务器监听回调（用于浏览器方式）
   */
  private startLocalServer(resolve: Function, reject: Function) {
    // 这里需要在主进程中实现HTTP服务器
    // 由于这是在渲染进程中，我们通过IPC与主进程通信
    
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.startAuthServer(this.redirectUri)
        .then((authCode: string) => {
          // 收到授权码后，交换访问令牌
          return this.exchangeCodeForToken(authCode);
        })
        .then(resolve)
        .catch(reject);
    } else {
      reject(new Error('Electron API不可用'));
    }
  }

  /**
   * 交换授权码为访问令牌
   */
  private async exchangeCodeForToken(authCode: string): Promise<ElectronAuthResult> {
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code: authCode,
        redirect_uri: this.redirectUri,
        scope: this.scopes.join(' ')
      })
    });

    if (!response.ok) {
      throw new Error(`令牌交换失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(refreshToken: string): Promise<ElectronAuthResult> {
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        refresh_token: refreshToken,
        scope: this.scopes.join(' ')
      })
    });

    if (!response.ok) {
      throw new Error(`令牌刷新失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // 有时不返回新的refresh_token
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };
  }

  /**
   * 工具函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRandomString(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// 导出单例实例
export const electronMicrosoftAuth = new ElectronMicrosoftAuth();