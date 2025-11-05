/**
 * PDF 解析服务
 * 
 * 使用 PDF.js 提取 PDF 文件中的文本内容
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import * as pdfjsLib from 'pdfjs-dist';

// 配置 PDF.js Worker（使用本地文件，避免 CDN 加载失败）
if (typeof window !== 'undefined') {
  // 使用 public 目录下的本地 worker 文件（.js 后缀兼容性更好）
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

/**
 * PDF 解析服务
 * 
 * 使用示例：
 * ```typescript
 * const file = event.target.files[0];
 * 
 * if (PDFParserService.isPDF(file)) {
 *   const text = await PDFParserService.extractText(file);
 *   console.log('提取的文本:', text);
 * }
 * ```
 */
export class PDFParserService {
  /**
   * 从 PDF 文件中提取文本内容
   * 
   * @param file - PDF 文件对象
   * @returns 提取的文本内容
   * @throws Error 如果文件不是 PDF 或解析失败
   */
  static async extractText(file: File): Promise<string> {      // console.log('[PDFParser] 文件大小:', (file.size / 1024).toFixed(2), 'KB');

    try {
      // 1. 验证文件类型
      if (!this.isPDF(file)) {
        throw new Error('文件不是 PDF 格式');
      }

      // 2. 读取文件为 ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // 3. 加载 PDF 文档
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      // 4. 逐页提取文本
      let fullText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        
        // 将文本项合并为字符串
        const pageText = content.items
          .map((item: any) => {
            // 保留文本和基本格式
            return item.str;
          })
          .join(' ');
        
        fullText += pageText + '\n\n';
      }

      const trimmedText = fullText.trim();
      // 验证提取结果
      if (trimmedText.length < 10) {
        throw new Error('PDF 内容为空或无法识别，可能是扫描版 PDF');
      }

      return trimmedText;
    } catch (error) {
      console.error('[PDFParser] ❌ 解析失败:', error);
      
      if (error instanceof Error) {
        throw new Error(`PDF 解析失败: ${error.message}`);
      } else {
        throw new Error('PDF 解析失败: 未知错误');
      }
    }
  }

  /**
   * 检查文件是否为 PDF
   * 
   * @param file - 文件对象
   * @returns 是否为 PDF
   */
  static isPDF(file: File): boolean {
    return (
      file.type === 'application/pdf' || 
      file.name.toLowerCase().endsWith('.pdf')
    );
  }

  /**
   * 检查文件是否为文本文件
   * 
   * @param file - 文件对象
   * @returns 是否为文本文件
   */
  static isTextFile(file: File): boolean {
    return (
      file.type.startsWith('text/') ||
      file.name.toLowerCase().endsWith('.txt') ||
      file.name.toLowerCase().endsWith('.md')
    );
  }

  /**
   * 获取支持的文件类型描述
   */
  static getSupportedFormats(): string {
    return 'PDF 文件 (.pdf) 或文本文件 (.txt)';
  }
}
