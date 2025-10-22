import React, { useState } from 'react';

interface AuthTestPageProps {
  onAuthComplete?: (token: string) => void;
}

const AuthTestPage: React.FC<AuthTestPageProps> = ({ onAuthComplete }) => {
  const [authStep, setAuthStep] = useState<'start' | 'waiting' | 'input' | 'success'>('start');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const clientId = '你的应用ID'; // 需要从配置中获取实际值
  
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${clientId}&` +
    `response_type=token&` +
    `redirect_uri=${encodeURIComponent('https://login.microsoftonline.com/common/oauth2/nativeclient')}&` +
    `scope=${encodeURIComponent('https://graph.microsoft.com/Calendars.ReadWrite')}&` +
    `response_mode=fragment&` +
    `prompt=select_account`;

  const handleStartAuth = async () => {
    setAuthStep('waiting');
    setError('');
    
    try {
      if (window.electronAPI?.openExternalAuth) {
        await window.electronAPI.openExternalAuth(authUrl);
      } else {
        window.open(authUrl, '_blank');
      }
      
      setTimeout(() => setAuthStep('input'), 3000);
    } catch (err) {
      setError('无法打开认证页面');
      setAuthStep('start');
    }
  };

  const handleTokenSubmit = () => {
    if (!token.trim()) {
      setError('请输入访问令牌');
      return;
    }

    if (token.length < 100) {
      setError('令牌长度似乎不正确，请检查是否完整复制');
      return;
    }

    // 保存令牌
    const expiryTime = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期
    localStorage.setItem('ms-access-token', token.trim());
    localStorage.setItem('ms-token-expiry', expiryTime.toISOString());
    
    setAuthStep('success');
    onAuthComplete?.(token.trim());
    
    setTimeout(() => {
      setAuthStep('start');
      setToken('');
    }, 3000);
  };

  const checkExistingAuth = () => {
    const existingToken = localStorage.getItem('ms-access-token');
    const expiry = localStorage.getItem('ms-token-expiry');
    
    if (existingToken && expiry && new Date(expiry) > new Date()) {
      return true;
    }
    return false;
  };

  const clearAuth = () => {
    localStorage.removeItem('ms-access-token');
    localStorage.removeItem('ms-token-expiry');
    setError('');
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '20px auto',
      padding: '24px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h2 style={{ 
        color: '#2d3748', 
        marginBottom: '16px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px' 
      }}>
        🔐 Microsoft 日历认证
        {checkExistingAuth() && <span style={{ fontSize: '12px', color: '#48bb78', backgroundColor: '#f0fff4', padding: '2px 8px', borderRadius: '12px' }}>已认证</span>}
      </h2>

      {authStep === 'start' && (
        <div>
          <p style={{ color: '#4a5568', lineHeight: '1.6', marginBottom: '16px' }}>
            由于 Electron 环境的安全限制，需要通过外部浏览器完成 Microsoft 账户认证。
          </p>
          
          <div style={{ 
            backgroundColor: '#ebf8ff', 
            border: '1px solid #bee3f8', 
            borderRadius: '8px', 
            padding: '16px', 
            marginBottom: '20px' 
          }}>
            <h4 style={{ color: '#2b6cb0', marginTop: 0, marginBottom: '8px' }}>认证步骤：</h4>
            <ol style={{ color: '#2d3748', paddingLeft: '20px', margin: 0 }}>
              <li>点击下方"开始认证"按钮</li>
              <li>在打开的浏览器窗口中登录 Microsoft 账户</li>
              <li>登录成功后，复制页面中显示的访问令牌</li>
              <li>返回此页面，粘贴令牌并点击确认</li>
            </ol>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleStartAuth}
              style={{
                backgroundColor: '#4299e1',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3182ce'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4299e1'}
            >
              🚀 开始认证
            </button>
            
            {checkExistingAuth() && (
              <button
                onClick={clearAuth}
                style={{
                  backgroundColor: '#f56565',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e53e3e'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f56565'}
              >
                🗑️ 清除认证
              </button>
            )}
          </div>
        </div>
      )}

      {authStep === 'waiting' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#4a5568', marginBottom: '8px' }}>正在打开认证页面...</p>
          <p style={{ color: '#718096', fontSize: '14px' }}>
            请在浏览器中完成登录，然后返回此页面
          </p>
          <button
            onClick={() => setAuthStep('input')}
            style={{
              backgroundColor: '#38a169',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: '12px'
            }}
          >
            我已完成登录
          </button>
        </div>
      )}

      {authStep === 'input' && (
        <div>
          <p style={{ color: '#4a5568', marginBottom: '16px' }}>
            请将从认证页面复制的访问令牌粘贴到下方输入框中：
          </p>
          
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="粘贴访问令牌到这里..."
            style={{
              width: '100%',
              height: '120px',
              padding: '12px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'monospace',
              resize: 'vertical',
              marginBottom: '16px',
              outline: 'none'
            }}
            onFocus={(e) => e.target.style.borderColor = '#4299e1'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
          
          {error && (
            <div style={{
              backgroundColor: '#fed7d7',
              border: '1px solid #fc8181',
              borderRadius: '6px',
              padding: '8px 12px',
              marginBottom: '16px',
              color: '#c53030',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleTokenSubmit}
              disabled={!token.trim()}
              style={{
                backgroundColor: token.trim() ? '#38a169' : '#a0aec0',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: token.trim() ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s'
              }}
            >
              ✅ 确认令牌
            </button>
            
            <button
              onClick={() => setAuthStep('start')}
              style={{
                backgroundColor: '#718096',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              🔙 返回
            </button>
          </div>
        </div>
      )}

      {authStep === 'success' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h3 style={{ color: '#38a169', marginBottom: '8px' }}>认证成功！</h3>
          <p style={{ color: '#4a5568', fontSize: '14px' }}>
            访问令牌已保存，现在可以同步 Microsoft 日历了。
          </p>
        </div>
      )}
    </div>
  );
};

export default AuthTestPage;