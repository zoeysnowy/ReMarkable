import React from 'react';
import DesktopCalendarWidgetV3 from '../components/DesktopCalendarWidgetV3';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';

const DesktopCalendarTest: React.FC = () => {
  // 初始化Microsoft服务（如果需要）
  const microsoftService = new MicrosoftCalendarService();

  return (
    <div style={{ 
      position: 'relative', 
      height: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <h1 style={{ 
        color: 'white', 
        fontSize: '24px', 
        marginBottom: '20px',
        textAlign: 'center',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        📅 桌面日历组件测试 V3
      </h1>
      
      <div style={{
        color: 'white',
        fontSize: '14px',
        marginBottom: '20px',
        padding: '16px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)'
      }}>
        <h3 style={{ margin: '0 0 12px 0' }}>✨ 新功能说明:</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>🔍 <strong>完整的TimeCalendar功能</strong> - 事件显示、创建、编辑</li>
          <li>🏷️ <strong>标签筛选</strong> - 可以按标签筛选显示事件</li>
          <li>📊 <strong>日历分组筛选</strong> - 可以按日历组筛选</li>
          <li>🎨 <strong>透明度调节</strong> - 可调节整体和背景透明度</li>
          <li>🖱️ <strong>拖拽和调整大小</strong> - 支持位置和尺寸调整</li>
          <li>🔒 <strong>锁定功能</strong> - 可锁定位置防止误操作</li>
          <li>💾 <strong>设置持久化</strong> - 自动保存位置和外观设置</li>
        </ul>
        
        <div style={{ marginTop: '12px', fontSize: '13px', opacity: 0.8 }}>
          💡 <strong>使用提示:</strong> 鼠标悬浮在日历上可显示控制栏，点击设置按钮可调节外观
        </div>
      </div>

      {/* 桌面日历组件V3 - 基于TimeCalendar */}
      <DesktopCalendarWidgetV3 
        microsoftService={microsoftService}
        className="demo-calendar"
      />
      
      {/* 额外的演示信息 */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        right: '20px',
        color: 'white',
        fontSize: '12px',
        textAlign: 'center',
        opacity: 0.7
      }}>
        🚀 基于TimeCalendar的完整桌面日历组件 | 解决了所有原有问题：事件显示✅ 日历筛选✅ 标签筛选✅ 透明度调节✅
      </div>
    </div>
  );
};
  ]);

  const [tags] = useState([
    {
      id: 'tag1',
      name: '工作',
      color: '#e74c3c',
      emoji: '💼'
    },
    {
      id: 'tag2',
      name: '个人',
      color: '#3498db',
      emoji: '🏠'
    }
  ]);

  const handleEventClick = (event: Event) => {
    console.log('点击事件:', event);
    alert(`点击事件: ${event.title}`);
  };

  const handleEventUpdate = (event: Event) => {
    console.log('更新事件:', event);
    alert(`更新事件: ${event.title}`);
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: 'white',
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <h2>桌面日历组件测试</h2>
        <p>事件数量: {events.length}</p>
        <p>标签数量: {tags.length}</p>
        <p>⭐ 测试透明度效果和拖拽功能</p>
      </div>
      
      <DesktopCalendarWidget
        events={events}
        tags={tags}
        onEventClick={handleEventClick}
        onEventUpdate={handleEventUpdate}
      />
    </div>
  );
};

export default DesktopCalendarTest;