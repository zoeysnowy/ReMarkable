# Assets Directory

## 文件夹结构

### `/icons`
- 存放从Figma导出的SVG图标文件
- 建议命名规范：`icon-name.svg`
- 例如：`search.svg`, `plus.svg`, `edit.svg`, `delete.svg`

### `/images`  
- 存放从Figma导出的图片资源
- 支持格式：PNG, JPG, SVG
- 建议命名规范：`component-name.png`
- 例如：`logo.png`, `avatar-placeholder.png`

## 从Figma导出建议

### 图标导出设置
- 格式：SVG
- 尺寸：按设计稿原始尺寸
- 颜色：保持原色或导出单色版本供CSS控制

### Logo导出设置  
- 格式：PNG (透明背景) 或 SVG
- 尺寸：2x 或 3x (高清屏适配)
- 建议导出多个尺寸：32x32, 64x64, 128x128

## 使用方式

```tsx
// 导入图标
import searchIcon from '../assets/icons/search.svg';
import logo from '../assets/images/logo.png';

// 在组件中使用
<img src={logo} alt="ReMarkable Logo" className="logo" />
<img src={searchIcon} alt="Search" className="search-icon" />
```