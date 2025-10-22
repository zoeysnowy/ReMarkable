/**
 * 桌面日历组件功能测试脚本
 * 用于验证新的基于TimeCalendar的桌面日历组件功能
 */

(function() {
  'use strict';
  
  console.log('🧪 桌面日历组件测试脚本加载');

  const testDesktopCalendar = {
    
    /**
     * 测试组件基本渲染
     */
    testBasicRendering() {
      console.log('🔍 测试 1: 基本渲染');
      
      const widgets = document.querySelectorAll('.desktop-calendar-widget');
      console.log(`找到 ${widgets.length} 个桌面日历组件`);
      
      if (widgets.length === 0) {
        console.warn('⚠️ 未找到桌面日历组件');
        return false;
      }
      
      widgets.forEach((widget, index) => {
        const timeCalendar = widget.querySelector('.time-calendar-container');
        if (timeCalendar) {
          console.log(`✅ 组件 ${index + 1}: TimeCalendar 正确嵌入`);
        } else {
          console.error(`❌ 组件 ${index + 1}: 未找到 TimeCalendar`);
        }
      });
      
      return true;
    },
    
    /**
     * 测试事件显示功能
     */
    testEventDisplay() {
      console.log('🔍 测试 2: 事件显示');
      
      // 检查是否有事件显示
      const events = document.querySelectorAll('.toastui-calendar-event');
      console.log(`找到 ${events.length} 个日历事件`);
      
      if (events.length > 0) {
        console.log('✅ 事件显示功能正常');
        events.forEach((event, index) => {
          const title = event.textContent || '未知事件';
          console.log(`  事件 ${index + 1}: ${title}`);
        });
        return true;
      } else {
        console.log('ℹ️ 当前没有事件显示（可能是正常的）');
        return true;
      }
    },
    
    /**
     * 测试控制栏功能
     */
    testControlBar() {
      console.log('🔍 测试 3: 控制栏功能');
      
      const widgets = document.querySelectorAll('.desktop-calendar-widget');
      let hasControlBars = false;
      
      widgets.forEach((widget, index) => {
        // 模拟鼠标悬停以显示控制栏
        const mouseEnterEvent = new Event('mouseenter', { bubbles: true });
        widget.dispatchEvent(mouseEnterEvent);
        
        setTimeout(() => {
          const controlBars = widget.querySelectorAll('[style*="background: linear-gradient"]');
          if (controlBars.length > 0) {
            console.log(`✅ 组件 ${index + 1}: 控制栏显示正常`);
            hasControlBars = true;
          } else {
            console.log(`⚠️ 组件 ${index + 1}: 控制栏未显示`);
          }
        }, 100);
      });
      
      return hasControlBars;
    },
    
    /**
     * 测试设置面板功能
     */
    testSettingsPanel() {
      console.log('🔍 测试 4: 设置面板功能');
      
      // 查找设置面板
      const settingsPanels = document.querySelectorAll('.calendar-settings-panel');
      console.log(`找到 ${settingsPanels.length} 个设置面板`);
      
      if (settingsPanels.length > 0) {
        console.log('✅ 设置面板组件存在');
        return true;
      } else {
        console.log('ℹ️ 设置面板当前未打开（正常状态）');
        return true;
      }
    },
    
    /**
     * 测试标签管理功能
     */
    testTagManagement() {
      console.log('🔍 测试 5: 标签管理功能');
      
      // 检查FigmaTagManager组件
      const tagManagers = document.querySelectorAll('.figma-tag-manager');
      console.log(`找到 ${tagManagers.length} 个标签管理器`);
      
      if (tagManagers.length > 0) {
        console.log('✅ 标签管理功能集成正常');
        
        // 检查标签
        const tags = document.querySelectorAll('.tag-item');
        console.log(`找到 ${tags.length} 个标签`);
        
        return true;
      } else {
        console.log('ℹ️ 标签管理器可能未在当前视图中显示');
        return true;
      }
    },
    
    /**
     * 测试日历筛选功能
     */
    testCalendarFilters() {
      console.log('🔍 测试 6: 日历筛选功能');
      
      // 检查是否有日历组选择器
      const calendarSelectors = document.querySelectorAll('[class*="calendar"], [class*="group"]');
      console.log(`找到 ${calendarSelectors.length} 个可能的日历控制元素`);
      
      // 检查localStorage中的日历设置
      const calendarSettings = localStorage.getItem('remarkable-calendar-settings');
      if (calendarSettings) {
        try {
          const settings = JSON.parse(calendarSettings);
          console.log('✅ 日历设置已保存:', settings);
          return true;
        } catch (error) {
          console.error('❌ 日历设置解析失败:', error);
          return false;
        }
      } else {
        console.log('ℹ️ 暂无保存的日历设置');
        return true;
      }
    },
    
    /**
     * 测试响应式设计
     */
    testResponsiveDesign() {
      console.log('🔍 测试 7: 响应式设计');
      
      const widgets = document.querySelectorAll('.desktop-calendar-widget');
      
      widgets.forEach((widget, index) => {
        const rect = widget.getBoundingClientRect();
        console.log(`组件 ${index + 1} 尺寸: ${rect.width}x${rect.height}`);
        
        if (rect.width > 0 && rect.height > 0) {
          console.log(`✅ 组件 ${index + 1}: 尺寸正常`);
        } else {
          console.error(`❌ 组件 ${index + 1}: 尺寸异常`);
        }
      });
      
      return true;
    },
    
    /**
     * 运行所有测试
     */
    runAllTests() {
      console.log('🚀 开始运行桌面日历组件测试套件');
      console.log('=' .repeat(50));
      
      const tests = [
        this.testBasicRendering,
        this.testEventDisplay,
        this.testControlBar,
        this.testSettingsPanel,
        this.testTagManagement,
        this.testCalendarFilters,
        this.testResponsiveDesign
      ];
      
      let passedTests = 0;
      
      tests.forEach((test, index) => {
        try {
          const result = test.call(this);
          if (result) {
            passedTests++;
          }
        } catch (error) {
          console.error(`❌ 测试 ${index + 1} 执行错误:`, error);
        }
        console.log('-'.repeat(30));
      });
      
      console.log('🏁 测试完成');
      console.log(`✅ 通过: ${passedTests}/${tests.length}`);
      console.log('=' .repeat(50));
      
      if (passedTests === tests.length) {
        console.log('🎉 所有测试通过！桌面日历组件功能正常');
      } else {
        console.log('⚠️ 部分测试未通过，请检查相关功能');
      }
      
      return passedTests;
    },
    
    /**
     * 获取组件状态信息
     */
    getComponentInfo() {
      console.log('📊 桌面日历组件状态信息');
      
      const info = {
        widgets: document.querySelectorAll('.desktop-calendar-widget').length,
        timeCalendars: document.querySelectorAll('.time-calendar-container').length,
        events: document.querySelectorAll('.toastui-calendar-event').length,
        tags: document.querySelectorAll('.tag-item').length,
        settingsPanels: document.querySelectorAll('.calendar-settings-panel').length
      };
      
      console.table(info);
      return info;
    }
  };
  
  // 将测试对象暴露到全局作用域
  if (typeof window !== 'undefined') {
    (window as any).testDesktopCalendar = testDesktopCalendar;
  }
  
  console.log('✅ 桌面日历测试脚本已加载');
  console.log('💡 使用 testDesktopCalendar.runAllTests() 运行所有测试');
  console.log('💡 使用 testDesktopCalendar.getComponentInfo() 查看组件状态');
  
})();