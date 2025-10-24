/**
 * ElectronWindowAuth - 使用BrowserWindow的Microsoft OAuth认证
 * 用户在Electron窗口内完成登录，无需手动操作令牌
 */

export interface WindowAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

export class ElectronWindowAuth {
  // 使用与 ElectronMicrosoftAuth 相同的 Client ID
  private clientId = 'cf163673-488e-44d9-83ac-0f11d90016ca';
  private redirectUri = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
  private scopes = [
    'https://graph.microsoft.com/User.Read',
    'https://graph.microsoft.com/Calendars.Read',
    'https://graph.microsoft.com/Calendars.ReadWrite',
    'offline_access'
  ];

  /**
   * 使用BrowserWindow打开登录窗口
   * 用户在窗口内完成登录，自动获取授权码
   */
  async authenticateWithWindow(forceConsent: boolean = false): Promise<WindowAuthResult> {
    try {
      console.log('🪟 [WindowAuth] 打开登录窗口...');
      
      // 第一步：构建OAuth URL
      const authUrl = this.buildAuthUrl(forceConsent);
      console.log('🔗 [WindowAuth] Auth URL:', authUrl);
      
      // 第二步：打开BrowserWindow并等待授权码
      const result = await (window as any).electronAPI.microsoftLoginWindow(authUrl);
      
      if (!result.success) {
        throw new Error(result.error || '登录失败');
      }
      
      console.log('✅ [WindowAuth] 获取到授权码');
      
      // 第三步：用授权码交换访问令牌
      const tokenResponse = await this.exchangeCodeForToken(result.code);
      
      console.log('🎉 [WindowAuth] 认证成功！');
      return tokenResponse;
      
    } catch (error) {
      console.error('❌ [WindowAuth] 认证失败:', error);
      throw error;
    }
  }

  /**
   * 构建OAuth认证URL
   */
  private buildAuthUrl(forceConsent: boolean = false): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      response_mode: 'query',
      prompt: forceConsent ? 'consent' : 'select_account' // consent 会强制显示权限同意页面
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * 用授权码交换访问令牌
   */
  private async exchangeCodeForToken(code: string): Promise<WindowAuthResult> {
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    
    const body = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scopes.join(' '),
      code: code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code'
    });

    console.log('🔄 [WindowAuth] 交换授权码...');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [WindowAuth] Token交换失败:', errorData);
      throw new Error(`Token交换失败: ${errorData.error_description || errorData.error}`);
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
   * 使用refresh token刷新访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<WindowAuthResult> {
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    
    const body = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scopes.join(' '),
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    console.log('🔄 [WindowAuth] 刷新访问令牌...');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [WindowAuth] Token刷新失败:', errorData);
      throw new Error(`Token刷新失败: ${errorData.error_description || errorData.error}`);
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };
  }
}

// 导出单例
export const electronWindowAuth = new ElectronWindowAuth();
