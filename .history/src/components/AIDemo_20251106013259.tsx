/**
 * AI Event Extraction Demo Page
 * 
 * 独立的测试页面，用于验证 AI 事件提取功能的完整流程
 * 
 * 功能：
 * 1. 上传 PDF 或文本文件
 * 2. AI 自动提取事件信息
 * 3. 预览提取结果（Before/After）
 * 4. 编辑并创建事件
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import React, { useState, useRef } from 'react';
import { AIService } from '../services/ai/AIService';
import { AIConfigManager } from '../services/ai/AIConfig';
import { ExtractedEventInfo } from '../services/ai/AIProvider.interface';
import { EventService } from '../services/EventService';
import { Event } from '../types';
import './AIDemo.css';

export const AIDemo: React.FC = () => {
  // 配置状态
  const [config, setConfig] = useState(() => AIConfigManager.getConfig());
  const [showConfig, setShowConfig] = useState(false);
  const [apiKey, setApiKey] = useState(config.dashscopeApiKey || '');
  const [hunyuanSecretId, setHunyuanSecretId] = useState(config.hunyuanSecretId || '');
  const [hunyuanSecretKey, setHunyuanSecretKey] = useState(config.hunyuanSecretKey || '');
  const [provider, setProvider] = useState<'ollama' | 'dashscope' | 'hunyuan'>(
    config.provider as 'ollama' | 'dashscope' | 'hunyuan'
  );
  
  // 状态管理
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<ExtractedEventInfo | null>(null);
  const [aiStatus, setAIStatus] = useState<string>('未检测');
  
  // 编辑状态
  const [editedTitle, setEditedTitle] = useState('');
  const [editedStartTime, setEditedStartTime] = useState('');
  const [editedEndTime, setEditedEndTime] = useState('');
  const [editedLocation, setEditedLocation] = useState('');
  const [editedAgenda, setEditedAgenda] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 保存配置
  const handleSaveConfig = () => {
    try {
      AIConfigManager.saveConfig({
        provider,
        dashscopeApiKey: provider === 'dashscope' ? apiKey : undefined,
        hunyuanSecretId: provider === 'hunyuan' ? hunyuanSecretId : undefined,
        hunyuanSecretKey: provider === 'hunyuan' ? hunyuanSecretKey : undefined
      });
      
      setConfig(AIConfigManager.getConfig());
      setShowConfig(false);
      alert('✅ 配置保存成功！请重新检测 AI 可用性。');
    } catch (err: any) {
      alert('❌ 配置保存失败: ' + err.message);
    }
  };

  // 检测 AI 可用性
  const checkAIAvailability = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const aiService = new AIService();
      const test = await aiService.testAvailability();
      
      if (test.available) {
        setAIStatus(`✅ ${test.model} 可用`);
        setError(null);
      } else {
        setAIStatus('❌ 不可用');
        setError(test.error || '未知错误');
      }
    } catch (err: any) {
      setAIStatus('❌ 检测失败');
      setError(err.message || '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedInfo(null);
      setError(null);
    }
  };

  // 处理文件拖拽
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setExtractedInfo(null);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 提取事件信息
  const handleExtract = async () => {
    if (!file) {
      setError('请先选择文件');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const aiService = new AIService();
      const result = await aiService.extractEventFromDocument(file);
      
      setExtractedInfo(result);
      
      // 填充编辑字段
      setEditedTitle(result.title);
      setEditedStartTime(result.startTime.slice(0, 16)); // ISO -> datetime-local
      setEditedEndTime(result.endTime.slice(0, 16));
      setEditedLocation(result.location || '');
      setEditedAgenda(result.agenda || '');
      
    } catch (err: any) {
      setError(err.message || '提取失败');
      console.error('[AIDemo] 提取失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 创建事件
  const handleCreateEvent = async () => {
    if (!extractedInfo) return;

    try {
      // 构建 Event 对象
      const newEvent: Event = {
        id: `ai-${Date.now()}`,
        title: editedTitle,
        startTime: editedStartTime + ':00+08:00', // datetime-local -> ISO
        endTime: editedEndTime + ':00+08:00',
        location: editedLocation,
        description: editedAgenda,
        isAllDay: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['AI导入'],
        remarkableSource: true,
        syncStatus: 'pending',
        attendees: extractedInfo.attendees
      };

      const result = await EventService.createEvent(newEvent);
      
      if (result.success) {
        alert('✅ 事件创建成功！\n\n可以在 TimeCalendar 中查看该事件。');
        
        // 重置状态
        setFile(null);
        setExtractedInfo(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        alert('❌ 创建失败: ' + result.error);
      }
    } catch (err: any) {
      alert('❌ 创建失败: ' + err.message);
      console.error('[AIDemo] 创建失败:', err);
    }
  };

  return (
    <div className="ai-demo-page">
      <div className="ai-demo-container">
        {/* 头部 */}
        <div className="ai-demo-header">
          <h1>🤖 AI 事件提取 Demo</h1>
          <p className="subtitle">测试 AI 从文档中自动提取事件信息的功能</p>
          <button 
            className="btn-config"
            onClick={() => setShowConfig(!showConfig)}
          >
            ⚙️ {showConfig ? '关闭配置' : '配置 API'}
          </button>
        </div>

        {/* API 配置面板 */}
        {showConfig && (
          <div className="config-panel">
            <h3>🔧 API 配置</h3>
            
            <div className="config-group">
              <label>选择服务商：</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="dashscope"
                    checked={provider === 'dashscope'}
                    onChange={(e) => setProvider(e.target.value as any)}
                  />
                  <span>DashScope 云端</span>
                  <span className="badge">免费额度 100万 tokens</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    value="hunyuan"
                    checked={provider === 'hunyuan'}
                    onChange={(e) => setProvider(e.target.value as any)}
                  />
                  <span>腾讯混元云端（推荐）</span>
                  <span className="badge">10万 tokens/月</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    value="ollama"
                    checked={provider === 'ollama'}
                    onChange={(e) => setProvider(e.target.value as any)}
                  />
                  <span>Ollama 本地</span>
                  <span className="badge-warning">需下载 4.7GB 模型</span>
                </label>
              </div>
            </div>

            {provider === 'dashscope' && (
              <div className="config-group">
                <label>DashScope API Key：</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  className="api-key-input"
                />
                <div className="help-text">
                  <p>💡 获取 API Key：</p>
                  <a 
                    href="https://dashscope.console.aliyun.com/apiKey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    https://dashscope.console.aliyun.com/apiKey
                  </a>
                  <p className="hint">新用户免费赠送 100 万 tokens（约 1000-2000 次调用）</p>
                </div>
              </div>
            )}

            {provider === 'hunyuan' && (
              <div className="config-group">
                <label>腾讯云 SecretId：</label>
                <input
                  type="text"
                  value={hunyuanSecretId}
                  onChange={(e) => setHunyuanSecretId(e.target.value)}
                  placeholder="AKIDxxxxxxxxxxxxxxxx"
                  className="api-key-input"
                />
                <label>腾讯云 SecretKey：</label>
                <input
                  type="password"
                  value={hunyuanSecretKey}
                  onChange={(e) => setHunyuanSecretKey(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxx"
                  className="api-key-input"
                />
                <div className="help-text">
                  <p>💡 获取密钥：</p>
                  <a 
                    href="https://console.cloud.tencent.com/cam/capi" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    https://console.cloud.tencent.com/cam/capi
                  </a>
                  <p className="hint">每月免费 10 万 tokens（约 100-200 次调用，次月自动续费）</p>
                </div>
              </div>
            )}

            {provider === 'ollama' && (
              <div className="config-group">
                <div className="help-text warning">
                  <p>⚠️ 使用 Ollama 本地模型需要：</p>
                  <ul>
                    <li>下载 Qwen 2.5 模型（约 4.7GB）</li>
                    <li>占用 4-6GB 内存运行</li>
                    <li>首次加载需要 2-5 秒</li>
                  </ul>
                  <p>💡 推荐使用云端服务（零安装、更快、中文优化）</p>
                </div>
              </div>
            )}

            <div className="config-actions">
              <button className="btn-save" onClick={handleSaveConfig}>
                💾 保存配置
              </button>
              <button className="btn-cancel-config" onClick={() => setShowConfig(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        {/* AI 状态检测 */}
        <div className="ai-status-section">
          <h2>1️⃣ AI 服务状态</h2>
          <div className="status-card">
            <div className="status-row">
              <span className="label">服务商：</span>
              <span className="value">
                {config.provider === 'dashscope' ? '☁️ DashScope 云端' : '💻 Ollama 本地'}
              </span>
            </div>
            <div className="status-row">
              <span className="label">当前模型：</span>
              <span className="value">{config.currentModel === 'qwen' ? 'Qwen 2.5' : 'Gemma 2'}</span>
            </div>
            {config.provider === 'dashscope' ? (
              <>
                <div className="status-row">
                  <span className="label">模型版本：</span>
                  <span className="value">{config.dashscopeModel || 'qwen-plus'}</span>
                </div>
                <div className="status-row">
                  <span className="label">API Key：</span>
                  <span className="value">
                    {config.dashscopeApiKey 
                      ? '••••••••' + config.dashscopeApiKey.slice(-4) 
                      : '未配置'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="status-row">
                  <span className="label">模型版本：</span>
                  <span className="value">{AIConfigManager.getCurrentModelName()}</span>
                </div>
                <div className="status-row">
                  <span className="label">服务地址：</span>
                  <span className="value">{config.ollamaBaseUrl}</span>
                </div>
              </>
            )}
            <div className="status-row">
              <span className="label">状态：</span>
              <span className="value">{aiStatus}</span>
            </div>
            
            <button 
              className="btn-check"
              onClick={checkAIAvailability}
              disabled={loading}
            >
              {loading ? '检测中...' : '🔍 检测 AI 可用性'}
            </button>
            
            {error && aiStatus === '❌ 不可用' && (
              <div className="error-box">
                <p><strong>错误信息：</strong></p>
                <pre>{error}</pre>
                <div className="help-links">
                  <p>💡 解决方案：</p>
                  {config.provider === 'dashscope' ? (
                    <ol>
                      <li>确认 API Key 正确</li>
                      <li>检查网络连接</li>
                      <li>
                        获取 API Key: 
                        <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" rel="noopener">
                          点击获取
                        </a>
                      </li>
                    </ol>
                  ) : (
                    <ol>
                      <li>安装 Ollama: <a href="https://ollama.ai/download" target="_blank" rel="noopener">点击下载</a></li>
                      <li>启动服务: <code>ollama serve</code></li>
                      <li>下载模型: <code>ollama pull {config.currentModel === 'qwen' ? 'qwen2.5:7b' : 'gemma2:9b'}</code></li>
                    </ol>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 文件上传 */}
        <div className="file-upload-section">
          <h2>2️⃣ 上传文档</h2>
          <div 
            className="drop-zone"
            onDrop={handleFileDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="file-info">
                <div className="file-icon">📄</div>
                <div className="file-name">{file.name}</div>
                <div className="file-size">{(file.size / 1024).toFixed(2)} KB</div>
              </div>
            ) : (
              <div className="drop-zone-placeholder">
                <div className="upload-icon">📤</div>
                <p>拖拽文件到这里，或点击选择</p>
                <p className="file-types">支持 PDF 和文本文件</p>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
          
          <button
            className="btn-extract"
            onClick={handleExtract}
            disabled={!file || loading}
          >
            {loading ? '⏳ AI 分析中...' : '🚀 开始提取'}
          </button>
        </div>

        {/* 错误提示 */}
        {error && aiStatus !== '❌ 不可用' && (
          <div className="error-banner">
            ❌ {error}
          </div>
        )}

        {/* 提取结果 */}
        {extractedInfo && (
          <div className="extraction-result">
            <h2>3️⃣ 提取结果（可编辑）</h2>
            
            <div className="confidence-badge">
              置信度: {(extractedInfo.confidence * 100).toFixed(0)}%
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>会议名称 *</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="请输入会议名称"
                />
              </div>

              <div className="form-field">
                <label>开始时间 *</label>
                <input
                  type="datetime-local"
                  value={editedStartTime}
                  onChange={(e) => setEditedStartTime(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>结束时间 *</label>
                <input
                  type="datetime-local"
                  value={editedEndTime}
                  onChange={(e) => setEditedEndTime(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>地点</label>
                <input
                  type="text"
                  value={editedLocation}
                  onChange={(e) => setEditedLocation(e.target.value)}
                  placeholder="会议地点"
                />
              </div>

              {extractedInfo.attendees && extractedInfo.attendees.length > 0 && (
                <div className="form-field full-width">
                  <label>参与方</label>
                  <div className="attendees-list">
                    {extractedInfo.attendees.map((att, idx) => (
                      <span key={idx} className="attendee-tag">
                        {att.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-field full-width">
                <label>议程</label>
                <textarea
                  rows={6}
                  value={editedAgenda}
                  onChange={(e) => setEditedAgenda(e.target.value)}
                  placeholder="详细议程安排"
                />
              </div>
            </div>

            <div className="action-buttons">
              <button
                className="btn-create"
                onClick={handleCreateEvent}
                disabled={!editedTitle || !editedStartTime || !editedEndTime}
              >
                ✅ 确认创建事件
              </button>
              
              <button
                className="btn-cancel"
                onClick={() => {
                  setExtractedInfo(null);
                  setFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="usage-guide">
          <h3>📖 使用指南</h3>
          <ol>
            <li>确保 Ollama 服务已启动（<code>ollama serve</code>）</li>
            <li>确保已下载模型（<code>ollama pull qwen2.5:7b</code>）</li>
            <li>点击"检测 AI 可用性"验证服务状态</li>
            <li>上传会议邀请函 PDF 或文本文件</li>
            <li>点击"开始提取"，AI 将自动分析</li>
            <li>预览并编辑提取结果</li>
            <li>点击"确认创建事件"保存到日历</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
