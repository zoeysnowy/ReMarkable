/**
 * Tencent Hunyuan AI Provider
 * 
 * 使用腾讯混元 API 调用 Hunyuan 模型（云端）
 * 
 * 优势：
 * - 免费额度：10 万 tokens/月
 * - 中文优化：腾讯自研，中文理解强
 * - 速度快：国内服务器，延迟低
 * - 稳定性高：腾讯云基础设施
 * 
 * 定价：
 * - Hunyuan-Lite: ¥0.008/1k tokens
 * - Hunyuan-Standard: ¥0.012/1k tokens
 * - Hunyuan-Pro: ¥0.03/1k tokens
 * 
 * 文档：https://cloud.tencent.com/document/product/1729
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
      model: 'hunyuan-lite', // 默认使用 lite（速度快、成本低）
      region: 'ap-guangzhou', // 默认广州区域
      ...config
    };
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
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      Model: this.config.model,
      Messages: messages,
      TopP: 0.8,
      Temperature: 0.1,
      Stream: false
    };

    try {
      const response = await fetch(`https://${this.endpoint}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TC-Action': 'ChatCompletions',
          'X-TC-Version': '2023-09-01',
          'X-TC-Region': this.config.region!,
          'X-TC-Timestamp': timestamp.toString(),
          'Authorization': await this.generateSignature(JSON.stringify(payload), timestamp)
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.Response?.Error?.Message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(`腾讯混元 API 调用失败: ${error.message}`);
    }
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
