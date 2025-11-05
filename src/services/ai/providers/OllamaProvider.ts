/**
 * Ollama Provider - 本地 AI 模型适配器
 * 
 * 支持通过 Ollama 运行本地 LLM（Qwen, Gemma 等）
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import { AIProvider, ExtractedEventInfo } from '../AIProvider.interface';

export interface OllamaConfig {
  /** Ollama 服务地址 */
  baseUrl?: string;
  /** 模型名称（如 'qwen2.5:7b', 'gemma2:9b'） */
  model?: string;
  /** 显示名称 */
  name?: string;
}

/**
 * Ollama Provider 实现
 * 
 * 使用示例：
 * ```typescript
 * const provider = new OllamaProvider({
 *   baseUrl: 'http://localhost:11434',
 *   model: 'qwen2.5:7b'
 * });
 * 
 * const available = await provider.isAvailable();
 * if (available) {
 *   const result = await provider.extractEventInfo(text, prompt);
 * }
 * ```
 */
export class OllamaProvider implements AIProvider {
  name: string;
  baseUrl: string;
  model: string;

  constructor(config?: OllamaConfig) {
    this.baseUrl = config?.baseUrl || 'http://localhost:11434';
    this.model = config?.model || 'qwen2.5:7b'; // 默认 Qwen 2.5
    this.name = config?.name || `Ollama (${this.model})`;
  }

  /**
   * 检查 Ollama 服务是否可用，并验证模型是否已下载
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      
      if (!response.ok) {
        console.warn(`[OllamaProvider] 服务不可用: ${response.status}`);
        return false;
      }

      // 检查模型是否已下载
      const data = await response.json();
      const modelPrefix = this.model.split(':')[0]; // 提取模型名（去掉版本号）
      const modelExists = data.models?.some((m: any) => 
        m.name.startsWith(modelPrefix)
      );

      if (!modelExists) {
        console.warn(`[OllamaProvider] 模型 ${this.model} 未安装`);
        console.log(`[OllamaProvider] 请运行: ollama pull ${this.model}`);
      }

      return modelExists;
    } catch (error) {
      console.error(`[OllamaProvider] 检测失败:`, error);
      return false;
    }
  }

  /**
   * 从文本中提取事件信息
   * 
   * @param text - 待提取的文本内容
   * @param prompt - AI 提示词
   * @returns 提取的事件信息
   * @throws Error 如果 API 调用失败或返回格式错误
   */
  async extractEventInfo(text: string, prompt: string): Promise<ExtractedEventInfo> {
    console.log(`🤖 [OllamaProvider] 使用模型: ${this.model}`);
    console.log(`📝 [OllamaProvider] 文本长度: ${text.length} 字符`);
    
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `${prompt}\n\n文档内容：\n${text}`,
          stream: false,
          format: 'json', // 要求返回 JSON 格式
          options: {
            temperature: 0.2,    // 低温度提高准确性
            num_predict: 2000,   // 最多生成 2000 tokens
            top_p: 0.8,          // 核采样参数
            repeat_penalty: 1.1  // 减少重复
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API 失败: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;
      console.log(`⏱️ [OllamaProvider] AI 处理耗时: ${elapsed}ms`);

      // 解析 JSON 响应
      let parsed: any;
      try {
        parsed = JSON.parse(data.response);
      } catch (e) {
        console.error('[OllamaProvider] JSON 解析失败');
        console.error('[OllamaProvider] 原始响应:', data.response);
        throw new Error('AI 返回的数据格式错误，请重试');
      }

      // 验证必需字段
      if (!parsed.title || !parsed.startTime || !parsed.endTime) {
        console.error('[OllamaProvider] 数据不完整:', parsed);
        throw new Error('AI 提取的信息不完整，缺少标题或时间');
      }

      // 验证时间格式（ISO 8601）
      if (!this.isValidISODate(parsed.startTime) || !this.isValidISODate(parsed.endTime)) {
        console.warn('[OllamaProvider] 时间格式可能不正确');
      }

      // 标准化返回格式
      const result: ExtractedEventInfo = {
        title: parsed.title,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        location: parsed.location || '',
        attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
        agenda: parsed.agenda || '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85
      };

      console.log('✅ [OllamaProvider] 提取成功:', {
        title: result.title,
        confidence: result.confidence
      });

      return result;
    } catch (error) {
      console.error('[OllamaProvider] 提取失败:', error);
      throw error;
    }
  }

  /**
   * 验证 ISO 8601 日期格式
   */
  private isValidISODate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      return !isNaN(date.getTime()) && dateString.includes('T');
    } catch {
      return false;
    }
  }
}
