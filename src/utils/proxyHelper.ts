/**
 * 代理服务器辅助工具
 * 
 * 提供代理服务器的健康检查和自动启动提示
 * 
 * @author Zoey Gong
 */

/**
 * 检查代理服务器是否运行
 */
export async function checkProxyHealth(proxyUrl: string): Promise<boolean> {
  try {
    const healthUrl = proxyUrl.replace('/api/hunyuan', '/health');
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2秒超时
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * 生成启动代理服务器的提示信息
 */
export function getProxyStartInstructions(proxyUrl: string): string {
  const isWindows = navigator.platform.toLowerCase().includes('win');
  
  if (isWindows) {
    return `
🚀 代理服务器未启动

请在新的终端窗口中运行以下命令：

【方式1：使用启动脚本（推荐）】
  cd ai-proxy
  .\\start-proxy.bat

【方式2：手动启动】
  cd ai-proxy
  npm install
  npm start

代理地址: ${proxyUrl}

启动后请刷新页面重试。
`.trim();
  } else {
    return `
🚀 代理服务器未启动

请在新的终端窗口中运行以下命令：

【方式1：使用启动脚本（推荐）】
  cd ai-proxy
  ./start-proxy.sh

【方式2：手动启动】
  cd ai-proxy
  npm install
  npm start

代理地址: ${proxyUrl}

启动后请刷新页面重试。
`.trim();
  }
}

/**
 * 自动检测并提示启动代理服务器
 */
export async function ensureProxyRunning(proxyUrl: string): Promise<void> {
  const isRunning = await checkProxyHealth(proxyUrl);
  
  if (!isRunning) {
    const instructions = getProxyStartInstructions(proxyUrl);
    throw new Error(instructions);
  }
}
