/**
 * AI 配置管理器
 * 
 * 管理 AI 模型配置、地区检测和用户偏好设置
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

export interface AIConfig {
  /** 当前使用的模型 */
  currentModel: 'qwen' | 'gemma';
  
  /** Ollama 服务地址 */
  ollamaBaseUrl: string;
  
  /** Qwen 模型版本 */
  qwenModel: string;
  
  /** Gemma 模型版本 */
  gemmaModel: string;
  
  /** 是否自动检测地区 */
  autoDetectRegion: boolean;
  
  /** 手动指定地区（覆盖自动检测） */
  manualRegion?: 'china' | 'global';
  
  /** 云端 API Key（预留，未来扩展） */
  dashscopeApiKey?: string;    // 阿里云通义千问
  googleAIApiKey?: string;      // Google AI Studio
}

/**
 * AI 配置管理器
 * 
 * 使用示例：
 * ```typescript
 * // 获取配置
 * const config = AIConfigManager.getConfig();
 * 
 * // 保存配置
 * AIConfigManager.saveConfig({ currentModel: 'gemma' });
 * 
 * // 检测地区
 * const region = await AIConfigManager.detectRegion(); // 'china' | 'global'
 * 
 * // 获取推荐模型
 * const model = await AIConfigManager.getRecommendedModel(); // 'qwen' | 'gemma'
 * ```
 */
export class AIConfigManager {
  private static readonly STORAGE_KEY = 'remarkable-ai-config';

  /**
   * 获取默认配置
   */
  static getDefaultConfig(): AIConfig {
    return {
      currentModel: 'qwen',                    // 默认 Qwen（中国优化）
      ollamaBaseUrl: 'http://localhost:11434',
      qwenModel: 'qwen2.5:7b',                 // Qwen 2.5 - 7B 参数版本
      gemmaModel: 'gemma2:9b',                 // Gemma 2 - 9B 参数版本
      autoDetectRegion: true
    };
  }

  /**
   * 获取用户配置（合并默认配置）
   */
  static getConfig(): AIConfig {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...this.getDefaultConfig(), ...parsed };
      }
    } catch (error) {
      console.error('[AIConfig] 读取配置失败:', error);
    }
    return this.getDefaultConfig();
  }

  /**
   * 保存配置（增量更新）
   */
  static saveConfig(config: Partial<AIConfig>): void {
    try {
      const current = this.getConfig();
      const updated = { ...current, ...config };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
      console.log('[AIConfig] 配置已保存:', updated);
    } catch (error) {
      console.error('[AIConfig] 保存配置失败:', error);
      throw new Error('配置保存失败，请检查浏览器存储');
    }
  }

  /**
   * 重置为默认配置
   */
  static resetConfig(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('[AIConfig] 配置已重置');
    } catch (error) {
      console.error('[AIConfig] 重置配置失败:', error);
    }
  }

  /**
   * 自动检测用户所在地区
   * 
   * 检测逻辑：
   * 1. 检查时区（Asia/Shanghai, Asia/Beijing）
   * 2. 检查浏览器语言（zh-CN）
   * 3. 默认返回 'china'
   * 
   * @returns 'china' 或 'global'
   */
  static async detectRegion(): Promise<'china' | 'global'> {
    try {
      // 方法1：检测时区
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (
        timezone.includes('Shanghai') || 
        timezone.includes('Beijing') || 
        timezone.includes('Chongqing') ||
        timezone.includes('Asia/Shanghai')
      ) {
        console.log('[AIConfig] 🇨🇳 检测到中国时区:', timezone);
        return 'china';
      }

      // 方法2：检测浏览器语言
      const language = navigator.language;
      if (language.startsWith('zh')) {
        console.log('[AIConfig] 🇨🇳 检测到中文环境:', language);
        return 'china';
      }

      console.log('[AIConfig] 🌍 检测到非中国地区');
      return 'global';
    } catch (error) {
      console.error('[AIConfig] 地区检测失败，默认中国:', error);
      return 'china'; // 保守策略：默认中国
    }
  }

  /**
   * 根据地区获取推荐模型
   * 
   * 推荐规则：
   * - 中国地区：Qwen 2.5（中文优化）
   * - 海外地区：Gemma 2（开源 Gemini）
   */
  static async getRecommendedModel(): Promise<'qwen' | 'gemma'> {
    const config = this.getConfig();
    
    // 如果用户手动指定了地区，优先使用
    if (!config.autoDetectRegion && config.manualRegion) {
      console.log('[AIConfig] 使用手动指定的地区:', config.manualRegion);
      return config.manualRegion === 'china' ? 'qwen' : 'gemma';
    }

    // 自动检测地区
    const region = await this.detectRegion();
    const recommendedModel = region === 'china' ? 'qwen' : 'gemma';
    
    console.log(`[AIConfig] 推荐模型: ${recommendedModel} (基于地区: ${region})`);
    return recommendedModel;
  }

  /**
   * 获取当前模型的完整名称（包括版本号）
   */
  static getCurrentModelName(): string {
    const config = this.getConfig();
    return config.currentModel === 'qwen' ? config.qwenModel : config.gemmaModel;
  }

  /**
   * 检查配置是否有效
   */
  static validateConfig(): { valid: boolean; errors: string[] } {
    const config = this.getConfig();
    const errors: string[] = [];

    // 验证 Ollama 地址
    if (!config.ollamaBaseUrl) {
      errors.push('Ollama 服务地址未配置');
    } else if (!config.ollamaBaseUrl.startsWith('http')) {
      errors.push('Ollama 服务地址格式错误');
    }

    // 验证模型名称
    if (!config.qwenModel || !config.gemmaModel) {
      errors.push('模型名称未配置');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
