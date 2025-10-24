import React, { useState } from 'react';
import { electronMicrosoftAuth } from '../services/ElectronMicrosoftAuth';
import { electronWindowAuth } from '../services/ElectronWindowAuth';
import './SimpleMicrosoftLogin.css';

interface SimpleMicrosoftLoginProps {
  onSuccess: (authResult: any) => void;
  onError: (error: Error) => void;
}

/**
 * 简化的Microsoft登录组件
 * 支持BrowserWindow窗口登录（推荐）、设备代码流程和浏览器OAuth流程
 */
export const SimpleMicrosoftLogin: React.FC<SimpleMicrosoftLoginProps> = ({
  onSuccess,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<'window' | 'device' | 'browser'>('window');
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [verificationUri, setVerificationUri] = useState<string>('');

  const handleWindowLogin = async () => {
    setIsLoading(true);
    try {
      console.log('🪟 开始窗口认证...');
      const result = await electronWindowAuth.authenticateWithWindow();
      
      // 保存令牌
      localStorage.setItem('ms-access-token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('ms-refresh-token', result.refreshToken);
      }
      localStorage.setItem('ms-token-expires', (Date.now() + result.expiresIn * 1000).toString());
      
      console.log('✅ 窗口认证成功');
      onSuccess(result);
    } catch (error) {
      console.error('❌ 窗口认证失败:', error);
      onError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeviceCodeLogin = async () => {
    setIsLoading(true);
    try {
      console.log('🔐 开始设备代码认证...');
      const result = await electronMicrosoftAuth.authenticateWithDeviceCode();
      
      // 保存令牌
      localStorage.setItem('ms-access-token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('ms-refresh-token', result.refreshToken);
      }
      localStorage.setItem('ms-token-expires', (Date.now() + result.expiresIn * 1000).toString());
      
      console.log('✅ 设备代码认证成功');
      onSuccess(result);
    } catch (error) {
      console.error('❌ 设备代码认证失败:', error);
      onError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowserLogin = async () => {
    setIsLoading(true);
    try {
      console.log('🌐 开始浏览器认证...');
      const result = await electronMicrosoftAuth.authenticateWithBrowser();
      
      // 保存令牌
      localStorage.setItem('ms-access-token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('ms-refresh-token', result.refreshToken);
      }
      localStorage.setItem('ms-token-expires', (Date.now() + result.expiresIn * 1000).toString());
      
      console.log('✅ 浏览器认证成功');
      onSuccess(result);
    } catch (error) {
      console.error('❌ 浏览器认证失败:', error);
      onError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    const refreshToken = localStorage.getItem('ms-refresh-token');
    if (!refreshToken) {
      onError(new Error('没有可用的刷新令牌'));
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 刷新访问令牌...');
      const result = await electronMicrosoftAuth.refreshToken(refreshToken);
      
      // 更新令牌
      localStorage.setItem('ms-access-token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('ms-refresh-token', result.refreshToken);
      }
      localStorage.setItem('ms-token-expires', (Date.now() + result.expiresIn * 1000).toString());
      
      console.log('✅ 令牌刷新成功');
      onSuccess(result);
    } catch (error) {
      console.error('❌ 令牌刷新失败:', error);
      onError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log('📋 已复制到剪贴板');
    });
  };

  const checkExistingToken = () => {
    const accessToken = localStorage.getItem('ms-access-token');
    const expiresAt = localStorage.getItem('ms-token-expires');
    
    if (accessToken && expiresAt) {
      const expiresTime = parseInt(expiresAt);
      const now = Date.now();
      
      if (now < expiresTime - 60000) { // 提前1分钟检查过期
        console.log('✅ 发现有效的访问令牌');
        return true;
      }
    }
    
    return false;
  };

  const logout = () => {
    localStorage.removeItem('ms-access-token');
    localStorage.removeItem('ms-refresh-token');
    localStorage.removeItem('ms-token-expires');
    console.log('👋 已登出');
  };

  const hasValidToken = checkExistingToken();

  return (
    <div className="simple-microsoft-login">
      <div className="login-header">
        <h3>Microsoft 账户登录</h3>
        <p>选择一种登录方式连接您的Microsoft日历</p>
      </div>

      {hasValidToken ? (
        <div className="token-status">
          <div className="status-card success">
            <div className="status-icon">✅</div>
            <div className="status-content">
              <h4>已登录</h4>
              <p>您的Microsoft账户已连接</p>
            </div>
          </div>
          
          <div className="action-buttons">
            <button 
              className="btn-secondary"
              onClick={handleRefreshToken}
              disabled={isLoading}
            >
              {isLoading ? '刷新中...' : '刷新令牌'}
            </button>
            <button 
              className="btn-danger"
              onClick={logout}
            >
              登出
            </button>
          </div>
        </div>
      ) : (
        <div className="login-methods">
          {/* 方法选择 */}
          <div className="method-selector">
            <div className="radio-group">
              <label className={`radio-option ${authMethod === 'window' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="authMethod"
                  value="window"
                  checked={authMethod === 'window'}
                  onChange={(e) => setAuthMethod(e.target.value as 'window' | 'device' | 'browser')}
                />
                <div className="radio-content">
                  <strong>🪟 窗口登录（推荐）</strong>
                  <span>在Electron窗口内完成登录，无需额外操作</span>
                </div>
              </label>

              <label className={`radio-option ${authMethod === 'device' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="authMethod"
                  value="device"
                  checked={authMethod === 'device'}
                  onChange={(e) => setAuthMethod(e.target.value as 'window' | 'device' | 'browser')}
                />
                <div className="radio-content">
                  <strong>设备代码流程</strong>
                  <span>需要手动输入代码的登录方式</span>
                </div>
              </label>
              
              <label className={`radio-option ${authMethod === 'browser' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="authMethod"
                  value="browser"
                  checked={authMethod === 'browser'}
                  onChange={(e) => setAuthMethod(e.target.value as 'window' | 'device' | 'browser')}
                />
                <div className="radio-content">
                  <strong>浏览器OAuth</strong>
                  <span>传统的浏览器重定向方式</span>
                </div>
              </label>
            </div>
          </div>

          {/* 登录说明 */}
          <div className="login-instructions">
            {authMethod === 'window' ? (
              <div className="instruction-card">
                <h4>🪟 窗口登录步骤：</h4>
                <ol>
                  <li>点击"开始登录"按钮</li>
                  <li>在弹出的窗口中输入您的Microsoft账户</li>
                  <li>完成登录后窗口自动关闭，无需其他操作</li>
                </ol>
                <div className="pros">
                  <strong>优点：</strong> 最简单、最快速，一键完成登录
                </div>
              </div>
            ) : authMethod === 'device' ? (
              <div className="instruction-card">
                <h4>📱 设备代码登录步骤：</h4>
                <ol>
                  <li>点击"开始登录"按钮</li>
                  <li>系统会自动打开浏览器并显示登录代码</li>
                  <li>在浏览器中输入代码并使用Microsoft账户登录</li>
                  <li>完成后返回应用即可使用</li>
                </ol>
                <div className="pros">
                  <strong>优点：</strong> 安全、简单、无需复杂配置
                </div>
              </div>
            ) : (
              <div className="instruction-card">
                <h4>🌐 浏览器登录步骤：</h4>
                <ol>
                  <li>点击"开始登录"按钮</li>
                  <li>系统会打开浏览器进行登录</li>
                  <li>登录成功后会自动返回应用</li>
                </ol>
                <div className="pros">
                  <strong>优点：</strong> 传统OAuth流程，适合开发调试
                </div>
              </div>
            )}
          </div>

          {/* 登录按钮 */}
          <div className="login-actions">
            {authMethod === 'window' ? (
              <button
                className="btn-primary"
                onClick={handleWindowLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    正在登录...
                  </>
                ) : (
                  <>
                    🪟 开始窗口登录
                  </>
                )}
              </button>
            ) : authMethod === 'device' ? (
              <button
                className="btn-primary"
                onClick={handleDeviceCodeLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    正在认证...
                  </>
                ) : (
                  <>
                    🔐 开始设备代码登录
                  </>
                )}
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={handleBrowserLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    正在认证...
                  </>
                ) : (
                  <>
                    🌐 开始浏览器登录
                  </>
                )}
              </button>
            )}
          </div>

          {/* 设备代码显示区域 */}
          {deviceCode && verificationUri && (
            <div className="device-code-display">
              <div className="code-card">
                <h4>请完成登录：</h4>
                <div className="code-info">
                  <div className="code-item">
                    <label>访问地址：</label>
                    <div className="code-value">
                      <span>{verificationUri}</span>
                      <button onClick={() => copyToClipboard(verificationUri)}>📋</button>
                    </div>
                  </div>
                  <div className="code-item">
                    <label>验证代码：</label>
                    <div className="code-value">
                      <span className="device-code">{deviceCode}</span>
                      <button onClick={() => copyToClipboard(deviceCode)}>📋</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 故障排除 */}
      <div className="troubleshooting">
        <details>
          <summary>遇到问题？</summary>
          <div className="troubleshooting-content">
            <h5>常见问题解决：</h5>
            <ul>
              <li><strong>无法打开浏览器：</strong> 请手动复制链接到浏览器</li>
              <li><strong>代码无效：</strong> 确保在5分钟内完成登录</li>
              <li><strong>权限错误：</strong> 确保Microsoft账户有日历访问权限</li>
              <li><strong>网络错误：</strong> 检查网络连接和防火墙设置</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
};