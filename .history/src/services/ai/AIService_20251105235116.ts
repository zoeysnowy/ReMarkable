/**
 * AI 服务
 * 
 * 协调 PDF 解析和 AI 提取，提供统一的事件提取接口
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import { AIProvider, ExtractedEventInfo } from './AIProvider.interface';
import { OllamaProvider } from './providers/OllamaProvider';
import { DashScopeProvider } from './providers/DashScopeProvider';
import { AIConfigManager } from './AIConfig';
import { PDFParserService } from '../PDFParserService';
import { EVENT_EXTRACTION_PROMPT } from '../../constants/ai/prompts';

/**
 * AI 服务
 * 
 * 使用示例：
 * ```typescript
 * const aiService = new AIService();
 * 
 * // 测试可用性
 * const test = await aiService.testAvailability();
 * if (test.available) {
 *   // 提取事件信息
 *   const file = event.target.files[0];
 *   const result = await aiService.extractEventFromDocument(file);
 *   console.log('提取结果:', result);
 * }
 * ```
 */
export class AIService {
  private provider: AIProvider | null = null;

  /**
   * 初始化 AI Provider（懒加载）
   * 
   * 根据用户配置和地区自动选择最佳模型
   */
  private async initializeProvider(): Promise<AIProvider> {
    // 如果已初始化，直接返回
    if (this.provider) {
      return this.provider;
    }

    console.log('[AIService] 🚀 初始化 AI Provider...');

    // 1. 读取配置
    const config = AIConfigManager.getConfig();
    
    // 2. 根据 provider 类型创建实例
    if (config.provider === 'dashscope') {
      // 使用 DashScope 云端 API
      if (!config.dashscopeApiKey) {
        throw new Error(
          'DashScope API Key 未配置。\n\n' +
          '请访问：https://dashscope.console.aliyun.com/apiKey\n' +
          '获取 API Key 后，在 AI Demo 页面的配置中填入。'
        );
      }

      this.provider = new DashScopeProvider({
        apiKey: config.dashscopeApiKey,
        model: config.dashscopeModel || 'qwen-plus'
      });

      console.log(`[AIService] ✅ 使用 DashScope 云端服务: ${config.dashscopeModel || 'qwen-plus'}`);
      
    } else {
      // 使用 Ollama 本地服务
      const modelName = config.currentModel === 'qwen' 
        ? config.ollamaQwenModel 
        : config.ollamaGemmaModel;
      
      this.provider = new OllamaProvider({
        baseUrl: config.ollamaBaseUrl,
        model: modelName,
        name: `Ollama (${modelName})`
      });

      // 检查本地模型可用性
      const available = await this.provider.isAvailable();
      if (!available) {
        const errorMessage = 
          `模型 ${modelName} 不可用。请按以下步骤操作：\n\n` +
          `1. 安装 Ollama: https://ollama.ai/download\n` +
          `2. 启动服务: ollama serve\n` +
          `3. 下载模型: ollama pull ${modelName}\n\n` +
          `当前配置: ${config.ollamaBaseUrl}\n\n` +
          `💡 提示：如果不想下载模型，可以在配置中切换到 DashScope 云端服务。`;
        
        throw new Error(errorMessage);
      }

      console.log(`[AIService] ✅ 使用 Ollama 本地服务: ${modelName}`);
    }

    return this.provider;
  }

  /**
   * 从文档中提取事件信息
   * 
   * @param file - PDF 或文本文件
   * @returns 提取的事件信息
   * @throws Error 如果文件类型不支持或处理失败
   */
  async extractEventFromDocument(file: File): Promise<ExtractedEventInfo> {
    console.log('[AIService] 📎 开始处理文件:', file.name);
    console.log('[AIService] 文件类型:', file.type);
    console.log('[AIService] 文件大小:', (file.size / 1024).toFixed(2), 'KB');

    // 1. 解析文件内容
    let text: string;
    try {
      if (PDFParserService.isPDF(file)) {
        console.log('[AIService] 使用 PDF 解析器');
        text = await PDFParserService.extractText(file);
      } else if (PDFParserService.isTextFile(file)) {
        console.log('[AIService] 使用文本读取');
        text = await file.text();
      } else {
        throw new Error(
          `不支持的文件类型: ${file.type}\n` +
          `支持的格式: ${PDFParserService.getSupportedFormats()}`
        );
      }
    } catch (error) {
      console.error('[AIService] ❌ 文件解析失败:', error);
      throw error;
    }

    // 2. 验证文本内容
    const trimmedText = text.trim();
    if (trimmedText.length < 10) {
      throw new Error('文件内容为空或过短（少于10个字符），无法提取有效信息');
    }

    console.log('[AIService] ✅ 文本提取成功，长度:', trimmedText.length);

    // 3. 初始化 AI Provider
    let provider: AIProvider;
    try {
      provider = await this.initializeProvider();
    } catch (error) {
      console.error('[AIService] ❌ AI Provider 初始化失败:', error);
      throw error;
    }

    // 4. 调用 AI 提取信息
    console.log('[AIService] 🤖 开始 AI 提取...');
    const startTime = Date.now();

    try {
      const result = await provider.extractEventInfo(trimmedText, EVENT_EXTRACTION_PROMPT);
      const elapsed = Date.now() - startTime;
      
      console.log(`[AIService] ✅ AI 提取成功，耗时: ${elapsed}ms`);
      console.log(`[AIService] 提取结果:`, {
        title: result.title,
        startTime: result.startTime,
        confidence: result.confidence
      });

      return result;
    } catch (error) {
      console.error('[AIService] ❌ AI 提取失败:', error);
      throw error;
    }
  }

  /**
   * 测试 AI 可用性
   * 
   * @returns 测试结果
   */
  async testAvailability(): Promise<{
    available: boolean;
    model: string;
    error?: string;
  }> {
    try {
      const provider = await this.initializeProvider();
      return {
        available: true,
        model: provider.name
      };
    } catch (error) {
      return {
        available: false,
        model: 'unknown',
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 重新初始化 Provider（用于切换模型）
   */
  resetProvider(): void {
    this.provider = null;
    console.log('[AIService] Provider 已重置');
  }

  /**
   * 获取当前使用的模型名称
   */
  getCurrentModel(): string {
    return AIConfigManager.getCurrentModelName();
  }
}
