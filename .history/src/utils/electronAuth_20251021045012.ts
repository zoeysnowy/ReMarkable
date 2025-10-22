// Electron 环境下的简化认证方案

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

export class ElectronAuthHelper {
  private static instance: ElectronAuthHelper;
  
  static getInstance(): ElectronAuthHelper {
    if (!ElectronAuthHelper.instance) {
      ElectronAuthHelper.instance = new ElectronAuthHelper();
    }
    return ElectronAuthHelper.instance;
  }

  /**
   * 简化的认证流程：提示用户手动获取访问令牌
   */
  async authenticateWithMicrosoft(): Promise<AuthResult> {
    try {
      // 检查是否已有存储的令牌
      const storedToken = localStorage.getItem('ms-access-token');
      const tokenExpiry = localStorage.getItem('ms-token-expiry');
      
      if (storedToken && tokenExpiry) {
        const expiry = new Date(tokenExpiry);
        if (expiry > new Date()) {
          console.log('✅ 使用已存储的访问令牌');
          return { success: true, accessToken: storedToken };
        }
      }

      // 构建认证指导消息
      const instructions = `
🔐 Microsoft 日历认证指南

由于 Electron 环境限制，请按以下步骤手动获取访问令牌：

1. 点击确定后，将打开 Microsoft 登录页面
2. 完成登录后，页面会显示访问令牌
3. 复制访问令牌并粘贴到后续弹窗中
4. 令牌将自动保存，下次使用时无需重复操作

是否继续？`;

      if (!confirm(instructions)) {
        return { success: false, error: '用户取消认证' };
      }

      // 打开认证页面
      const authUrl = this.buildAuthUrl();
      
      if (window.electronAPI?.openExternalAuth) {
        await window.electronAPI.openExternalAuth(authUrl);
      } else {
        window.open(authUrl, '_blank');
      }

      // 等待用户输入令牌
      await this.delay(3000); // 给用户时间完成认证
      
      const token = prompt(`请粘贴从认证页面获取的访问令牌：

提示：令牌通常以 "EwAoA" 或类似字符开头，长度较长。`);

      if (!token || token.trim().length < 50) {
        return { success: false, error: '访问令牌无效或为空' };
      }

      // 保存令牌（假设1小时有效期）
      const expiryTime = new Date(Date.now() + 60 * 60 * 1000);
      localStorage.setItem('ms-access-token', token.trim());
      localStorage.setItem('ms-token-expiry', expiryTime.toISOString());

      console.log('✅ 访问令牌已保存');
      return { success: true, accessToken: token.trim() };

    } catch (error) {
      console.error('❌ 认证失败:', error);
      return { success: false, error: '认证过程中出现错误' };
    }
  }

  /**
   * 清除已保存的认证信息
   */
  clearAuth(): void {
    localStorage.removeItem('ms-access-token');
    localStorage.removeItem('ms-token-expiry');
    console.log('🔄 认证信息已清除');
  }

  /**
   * 检查当前认证状态
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('ms-access-token');
    const expiry = localStorage.getItem('ms-token-expiry');
    
    if (!token || !expiry) return false;
    
    return new Date(expiry) > new Date();
  }

  /**
   * 获取当前访问令牌
   */
  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return localStorage.getItem('ms-access-token');
  }

  private buildAuthUrl(): string {
    const clientId = '你的客户端ID'; // 需要替换为实际的客户端ID
    const redirectUri = encodeURIComponent('https://login.microsoftonline.com/common/oauth2/nativeclient');
    const scope = encodeURIComponent('https://graph.microsoft.com/Calendars.ReadWrite offline_access');
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
           `client_id=${clientId}&` +
           `response_type=code&` +
           `redirect_uri=${redirectUri}&` +
           `scope=${scope}&` +
           `response_mode=query&` +
           `prompt=select_account`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ElectronAuthHelper;