export const MICROSOFT_GRAPH_CONFIG = {
  clientId: 'cf163673-488e-44d9-83ac-0f11d90016ca',
  authority: 'https://login.microsoftonline.com/common',
  redirectUri: typeof window !== 'undefined' && window.electronAPI 
    ? 'http://localhost:3000' // Electron环境
    : window.location.origin, // Web环境
  scopes: [
    'User.Read',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Tasks.ReadWrite'  // 🆕 v1.7.5: To Do Lists 支持
  ]
};

// 检查是否已配置
export const isMicrosoftConfigured = () => {
  return MICROSOFT_GRAPH_CONFIG.clientId !== 'YOUR_AZURE_APP_CLIENT_ID';
};