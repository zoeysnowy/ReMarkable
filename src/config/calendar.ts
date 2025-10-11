export const MICROSOFT_GRAPH_CONFIG = {
  clientId: 'cf163673-488e-44d9-83ac-0f11d90016ca',
  authority: 'https://login.microsoftonline.com/common',
  redirectUri: window.location.origin,
  scopes: [
    'User.Read',
    'Calendars.Read',
    'Calendars.ReadWrite'
  ]
};

// 检查是否已配置
export const isMicrosoftConfigured = () => {
  return MICROSOFT_GRAPH_CONFIG.clientId !== 'YOUR_AZURE_APP_CLIENT_ID';
};