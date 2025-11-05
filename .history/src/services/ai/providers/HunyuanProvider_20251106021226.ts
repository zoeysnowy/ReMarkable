/**
 * Tencent Hunyuan AI Provider
 * 
 * ⚠️ 重要提示：腾讯云 API 不支持浏览器直接调用（CORS 限制）
 * 
 * 限制说明：
 * - 腾讯云 API 只能从服务器端调用
 * - 浏览器环境会遇到 CORS 错误
 * - Electron 桌面应用也受影响（Chromium 限制）
 * 
 * 解决方案：
 * 1. 使用 DashScope（阿里云）：支持浏览器直接调用 ✅
 * 2. 使用 Ollama 本地模型：完全离线 ✅
 * 3. 搭建代理服务器：转发腾讯云 API 请求（复杂）
 * 
 * 推荐：优先使用 DashScope（100万 tokens 免费，支持浏览器）
 * 
 * @author Zoey Gong
 */

import { AIProvider, ExtractedEventInfo, AIProviderTestResult } from '../AIProvider.interface';

export interface HunyuanConfig {
  secretId: string;
  secretKey: string;
  model?: 'hunyuan-lite' | 'hunyuan-standard' | 'hunyuan-pro';
  region?: string;
}

export class HunyuanProvider implements AIProvider {
  public readonly name = 'Hunyuan';
  private config: HunyuanConfig;
  private endpoint = 'hunyuan.tencentcloudapi.com';

  constructor(config: HunyuanConfig) {
    this.config = {
      model: 'hunyuan-lite',
      region: 'ap-guangzhou',
      ...config
    };
    
    // 输出警告信息
    console.warn(
      '[HunyuanProvider] ⚠️ 腾讯云 API 不支持浏览器直接调用！\n' +
      '建议切换到 DashScope（阿里云）或 Ollama 本地模型。\n' +
      '详情: https://cloud.tencent.com/document/api/1729/106050'
    );
  }

  /**
   * 生成腾讯云 API 签名（V3）
   */
  private async generateSignature(payload: string, timestamp: number): Promise<string> {
    const service = 'hunyuan';
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];
    const algorithm = 'TC3-HMAC-SHA256';
    
    // 简化版签名（实际应用中需要完整实现）
    // 这里使用 Authorization header 方式
    const authorization = `TC3-HMAC-SHA256 Credential=${this.config.secretId}/${date}/${service}/tc3_request`;
    
    return authorization;
  }

  /**
   * 调用腾讯云 API
   */
  private async callAPI(messages: Array<{ role: string; content: string }>, maxTokens: number = 2000): Promise<any> {
    // 提前抛出明确的 CORS 警告
    throw new Error(
      '⚠️ 腾讯云 API 不支持浏览器调用（CORS 限制）\n\n' +
      '推荐方案：\n' +
      '1. 切换到 DashScope（阿里云）- 支持浏览器 ✅\n' +
      '2. 使用 Ollama 本地模型 - 完全离线 ✅\n\n' +
      '如需使用腾讯混元，请搭建后端代理服务器。\n' +
      '技术细节: https://cloud.tencent.com/document/api/1729/106050'
    );
  }

  /**
   * 检测 API 可用性
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.test();
      return result.available;
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试 API（带详细信息）
   */
  async test(): Promise<AIProviderTestResult> {
    if (!this.config.secretId || !this.config.secretKey) {
      return {
        available: false,
        model: this.config.model!,
        error: 'SecretId 或 SecretKey 未配置。\n\n请访问：https://console.cloud.tencent.com/cam/capi'
      };
    }

    try {
      await this.callAPI([
        { role: 'user', content: 'Hello' }
      ], 10);

      return {
        available: true,
        model: this.config.model!
      };
    } catch (error: any) {
      return {
        available: false,
        model: this.config.model!,
        error: error.message || '网络错误'
      };
    }
  }

  /**
   * 提取事件信息
   */
  async extractEventInfo(text: string, prompt: string): Promise<ExtractedEventInfo> {
    if (!this.config.secretId || !this.config.secretKey) {
      throw new Error('腾讯混元 SecretId/SecretKey 未配置');
    }

    try {
      const response = await this.callAPI([
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `请从以下文本中提取事件信息：\n\n${text}`
        }
      ]);

      // 解析响应
      const content = response.Response?.Choices?.[0]?.Message?.Content;
      if (!content) {
        throw new Error('API 返回格式错误：缺少 content 字段');
      }

      // 提取 JSON（可能在 markdown 代码块中）
      let jsonText = content.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      // 解析 JSON
      const parsed = JSON.parse(jsonText);

      // 验证必需字段
      if (!parsed.title || !parsed.startTime || !parsed.endTime) {
        throw new Error('提取结果缺少必需字段（title/startTime/endTime）');
      }

      // 验证时间格式
      const startDate = new Date(parsed.startTime);
      const endDate = new Date(parsed.endTime);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('时间格式无效');
      }

      return {
        title: parsed.title,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        location: parsed.location || undefined,
        attendees: parsed.attendees || [],
        agenda: parsed.agenda || undefined,
        confidence: parsed.confidence || 0.85
      };

    } catch (error: any) {
      console.error('[HunyuanProvider] 提取失败:', error);
      throw new Error(`腾讯混元提取失败: ${error.message}`);
    }
  }
}
