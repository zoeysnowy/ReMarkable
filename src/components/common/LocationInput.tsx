/**
 * LocationInput - 地址输入组件
 * 
 * 功能：
 * - 集成高德地图地址输入提示 API
 * - 地址自动补全
 * - Go 按钮跳转到地图应用
 */

import React, { useState, useEffect, useRef } from 'react';
import './LocationInput.css';

interface LocationSuggestion {
  id: string;
  name: string;
  district: string; // 区域
  address: string;  // 完整地址
  location?: string; // 经纬度
}

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onSelect?: (value: string) => void;
  placeholder?: string;
}

// 高德地图 Web 服务 API Key
// 申请地址: https://console.amap.com/dev/key/app
// 配置方法: 参见 docs/LOCATION_FEATURE_SETUP.md
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || 'YOUR_AMAP_KEY';

export const LocationInput: React.FC<LocationInputProps> = ({
  value,
  onChange,
  onBlur,
  onSelect,
  placeholder = '📍 地点'
}) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 搜索地址建议
  const searchAddressSuggestions = async (keyword: string) => {
    if (!keyword || keyword.trim().length < 2) {
      console.log('[LocationInput] 关键词太短，不搜索:', keyword);
      setSuggestions([]);
      return;
    }

    console.log('[LocationInput] 开始搜索地址:', keyword);
    setIsLoading(true);
    
    try {
      const url = `https://restapi.amap.com/v3/assistant/inputtips?key=${AMAP_KEY}&keywords=${encodeURIComponent(keyword)}&city=全国&datatype=all`;
      console.log('[LocationInput] 请求 URL:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[LocationInput] API 响应:', data);
      
      if (data.status === '1' && data.tips) {
        // 过滤掉无效的建议
        const validTips = data.tips.filter((tip: any) => 
          tip.name && tip.name !== keyword && tip.location
        );
        
        console.log('[LocationInput] 有效建议数量:', validTips.length);
        
        setSuggestions(validTips.map((tip: any) => ({
          id: tip.id,
          name: tip.name,
          district: tip.district || '',
          address: tip.address || tip.name,
          location: tip.location
        })));
        
        setShowSuggestions(true);
      } else {
        console.warn('[LocationInput] API 返回状态异常:', data);
      }
    } catch (error) {
      console.error('[LocationInput] Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理输入变化（带防抖）
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {
      searchAddressSuggestions(newValue);
    }, 300); // 300ms 防抖
  };

  // 选择建议
  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    const fullAddress = suggestion.district 
      ? `${suggestion.district} ${suggestion.name}`
      : suggestion.name;
    
    onChange(fullAddress);
    setShowSuggestions(false);
    setSuggestions([]);
    onSelect?.(fullAddress);
  };

  // 跳转到地图应用
  const handleOpenInMap = () => {
    if (!value) return;
    
    const encoded = encodeURIComponent(value);
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    
    // 国内默认使用高德地图
    if (isMobile) {
      // 移动端：尝试唤起高德地图 APP
      window.location.href = `iosamap://path?sourceApplication=ReMarkable&keyword=${encoded}`;
      
      // 如果 APP 未安装，3秒后跳转到网页版
      setTimeout(() => {
        window.open(`https://uri.amap.com/marker?address=${encoded}`, '_blank');
      }, 3000);
    } else {
      // 桌面端：直接打开网页版
      window.open(`https://uri.amap.com/marker?address=${encoded}`, '_blank');
    }
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="amap-location-input-container">
      <div className="amap-location-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="amap-location-input"
          value={value || ''}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
        />
        
        {/* Go 按钮 */}
        {value && (
          <button
            className="amap-location-go-btn"
            onClick={handleOpenInMap}
            title="在地图中打开"
            type="button"
          >
            🗺️
          </button>
        )}
        
        {/* 加载指示器 */}
        {isLoading && (
          <div className="amap-location-loading">
            <span className="amap-loading-spinner">⏳</span>
          </div>
        )}
      </div>

      {/* 地址建议下拉框 */}
      {showSuggestions && suggestions.length > 0 && (
        <div ref={dropdownRef} className="amap-location-suggestions">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="amap-location-suggestion-item"
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <div className="amap-suggestion-icon">📍</div>
              <div className="amap-suggestion-content">
                <div className="amap-suggestion-name">{suggestion.name}</div>
                {suggestion.district && (
                  <div className="amap-suggestion-district">{suggestion.district}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
