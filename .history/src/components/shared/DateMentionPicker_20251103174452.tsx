/**
 * DateMentionPicker - 日期提及选择器
 * 支持自然语言输入日期
 */

import React, { useState, useCallback } from 'react';
import { parseNaturalDate, formatDateDisplay, DATE_EXAMPLES, ParsedDate } from '../../utils/dateParser';
import { parseToTimeSpec } from '../../services/TimeParsingService';

export interface DateMentionPickerProps {
  // Return selected dates along with the raw input text the user typed (for inline display)
  onDateSelect: (date: Date, endDate: Date | undefined, rawText: string) => void;
  onClose?: () => void;
  eventId?: string;
  useTimeHub?: boolean;
}

export const DateMentionPicker: React.FC<DateMentionPickerProps> = ({
  onDateSelect,
  onClose,
  eventId,
  useTimeHub,
}) => {
  const [input, setInput] = useState('');
  const [parsedDate, setParsedDate] = useState<ParsedDate | null>(null);
  const [error, setError] = useState<string>('');

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setError('');
    
    if (value.trim()) {
      const result = parseNaturalDate(value);
      if (result) {
        setParsedDate(result);
      } else {
        setParsedDate(null);
        setError('无法识别日期');
      }
    } else {
      setParsedDate(null);
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!parsedDate) return;

    // 优先调用 TimeParsingService 生成 TimeSpec，再根据策略写入 TimeHub
    const spec = parseToTimeSpec(input);
    if (useTimeHub && eventId && spec) {
      try {
        const { TimeHub } = await import('../../services/TimeHub');
        const resolvedStart = spec.resolved?.start || spec.start;
        const resolvedEnd = spec.resolved?.end || spec.end || spec.resolved?.start;
        await TimeHub.setEventTime(eventId, {
          start: resolvedStart,
          end: resolvedEnd,
          kind: spec.kind,
          allDay: spec.kind === 'all-day' ? true : undefined,
          source: 'parser',
          rawText: spec.rawText || input,
          policy: spec.policy,
        });
      } catch {}
    }

    // 仍然把解析结果回传，供外层插入文本或其它用途
    onDateSelect(parsedDate.start, parsedDate.end, input);
    onClose?.();
  }, [parsedDate, onDateSelect, onClose, input, useTimeHub, eventId]);

  const handleExampleClick = useCallback((example: string) => {
    setInput(example);
    handleInputChange(example);
  }, [handleInputChange]);

  return (
    <div 
      style={{
        padding: '12px',
        minWidth: '320px',
        maxWidth: '400px',
      }}
    >
      {/* 输入框 */}
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && parsedDate) {
              e.preventDefault();
              handleConfirm();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose?.();
            }
          }}
          placeholder="输入日期，如：明天下午3点"
          autoFocus
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>

      {/* 解析结果 */}
      {parsedDate && (
        <div 
          style={{
            padding: '8px 12px',
            marginBottom: '12px',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        >
          <div style={{ color: '#1e40af', fontWeight: '500' }}>
            📅 {formatDateDisplay(parsedDate.start, undefined, parsedDate.timePeriod)}
          </div>
          {parsedDate.end && (
            <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
              至 {formatDateDisplay(parsedDate.end)}
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div 
          style={{
            padding: '8px 12px',
            marginBottom: '12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* 示例 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
          常用示例：
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {DATE_EXAMPLES.slice(0, 6).map((example) => (
            <button
              key={example}
              onClick={() => handleExampleClick(example)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                background: '#f9fafb',
                color: '#374151',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '6px 16px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: 'white',
            color: '#374151',
            cursor: 'pointer',
          }}
        >
          取消
        </button>
        <button
          onClick={handleConfirm}
          disabled={!parsedDate}
          style={{
            padding: '6px 16px',
            fontSize: '14px',
            border: 'none',
            borderRadius: '6px',
            background: parsedDate ? '#3b82f6' : '#e5e7eb',
            color: parsedDate ? 'white' : '#9ca3af',
            cursor: parsedDate ? 'pointer' : 'not-allowed',
            fontWeight: '500',
          }}
        >
          确定
        </button>
      </div>
    </div>
  );
};
