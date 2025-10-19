import React, { useState, useMemo } from 'react';
import { HexColorPicker } from 'react-colorful';
import tinycolor from 'tinycolor2';
import './ColorPalettePicker.css';

interface ColorColumnProps {
  baseColor: string;
  onColorChange: (color: string) => void;
}

const ColorColumn: React.FC<ColorColumnProps> = ({ baseColor, onColorChange }) => {
  const [showPicker, setShowPicker] = useState(false);
  
  const colorPalette = useMemo(() => {
    const base = tinycolor(baseColor);
    const shades = Array.from({ length: 10 }).map((_, i) => {
        const lightnessFactor = (i - 4.5) * 8; 
        if (lightnessFactor < 0) {
            return base.clone().lighten(Math.abs(lightnessFactor)).toHexString();
        }
        return base.clone().darken(lightnessFactor).toHexString();
    });
    return shades.sort((a, b) => tinycolor(a).getLuminance() - tinycolor(b).getLuminance());
  }, [baseColor]);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(err => console.error('Failed to copy:', err));
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value;
      if (tinycolor(newColor).isValid()) {
          onColorChange(tinycolor(newColor).toHexString());
      } else {
          onColorChange(newColor); // Allow intermediate invalid states while typing
      }
  };

  return (
    <div className="color-column">
      <div className="color-picker-container">
        <button 
          className="base-color-button" 
          style={{ 
            backgroundColor: baseColor, 
            color: tinycolor(baseColor).isLight() ? '#000' : '#FFF',
          }}
          onClick={() => setShowPicker(!showPicker)}
        >
          {baseColor}
        </button>
        
        {showPicker && (
          <div className="color-picker-popover">
            <div className="color-picker-content">
              <HexColorPicker color={baseColor} onChange={onColorChange} />
              <div className="color-input-container">
                <label htmlFor="color-input">HEX / RGB</label>
                <input
                  id="color-input"
                  value={baseColor}
                  onChange={handleInputChange}
                  className="color-input"
                  spellCheck="false"
                />
              </div>
              <button 
                className="close-button"
                onClick={() => setShowPicker(false)}
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </div>
      
      {colorPalette.map((color, index) => (
        <div 
          key={index}
          className="palette-color"
          style={{ backgroundColor: color }}
          onClick={() => copyToClipboard(color)}
          title={`点击复制 ${color}`}
        >
          <span 
            className="color-text"
            style={{ color: tinycolor(color).isLight() ? '#000' : '#FFF' }}
          >
            {color}
          </span>
          <svg 
            className="copy-icon" 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ color: tinycolor(color).isLight() ? '#000' : '#FFF' }}
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </div>
      ))}
    </div>
  );
};

interface ColorPalettePickerProps {
  onColorSelect?: (color: string) => void;
}

const ColorPalettePicker: React.FC<ColorPalettePickerProps> = ({ onColorSelect }) => {
  const initialColors = [
    "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e",
    "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef"
  ];
  const [colors, setColors] = useState(initialColors);

  const handleColorChange = (newColor: string, index: number) => {
    const parsedColor = tinycolor(newColor);
    if (parsedColor.isValid()) {
        const newColors = [...colors];
        newColors[index] = parsedColor.toHexString();
        setColors(newColors);
        
        // 通知父组件颜色选择
        if (onColorSelect) {
          onColorSelect(parsedColor.toHexString());
        }
    }
  };

  return (
    <div className="color-palette-picker">
      <div className="palette-card">
        <div className="palette-header">
          <h3>多列同色系生成器</h3>
        </div>
        <div className="palette-content">
          <div className="palette-grid">
            {colors.map((color, index) => (
              <ColorColumn
                key={index}
                baseColor={color}
                onColorChange={(newColor) => handleColorChange(newColor, index)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorPalettePicker;