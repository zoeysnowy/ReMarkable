/**
 * EventEditModal 日历分组功能测试脚本
 * 验证多选日历、优雅UI和时间解析修复
 */

(function() {
  'use strict';
  
  console.log('🧪 EventEditModal 日历分组测试脚本加载');

  const testEventEditModalCalendars = {
    
    /**
     * 测试CalendarPicker组件渲染
     */
    testCalendarPickerRendering() {
      console.log('🔍 测试 1: CalendarPicker组件渲染');
      
      const calendarPickers = document.querySelectorAll('.calendar-picker');
      console.log(`找到 ${calendarPickers.length} 个日历选择器组件`);
      
      if (calendarPickers.length === 0) {
        console.warn('⚠️ 未找到CalendarPicker组件（可能EventEditModal未打开）');
        return false;
      }
      
      calendarPickers.forEach((picker, index) => {
        const container = picker.querySelector('.calendar-picker-container');
        const searchInput = picker.querySelector('.calendar-search-input');
        
        if (container && searchInput) {
          console.log(`✅ CalendarPicker ${index + 1}: 基本结构正常`);
        } else {
          console.error(`❌ CalendarPicker ${index + 1}: 结构缺失`);
        }
      });
      
      return true;
    },
    
    /**
     * 测试多选日历功能
     */
    testMultiSelection() {
      console.log('🔍 测试 2: 多选日历功能');
      
      const selectedCalendars = document.querySelectorAll('.calendar-chip');
      console.log(`当前已选择 ${selectedCalendars.length} 个日历`);
      
      selectedCalendars.forEach((chip, index) => {
        const name = chip.querySelector('.calendar-chip-name')?.textContent;
        const removeBtn = chip.querySelector('.calendar-chip-remove');
        
        console.log(`  日历 ${index + 1}: ${name}`);
        
        if (removeBtn) {
          console.log(`    ✅ 有移除按钮`);
        } else {
          console.warn(`    ⚠️ 缺少移除按钮`);
        }
      });
      
      return true;
    },
    
    /**
     * 测试UI优雅性
     */
    testUIElegance() {
      console.log('🔍 测试 3: UI优雅性检查');
      
      const calendarPickers = document.querySelectorAll('.calendar-picker');
      let hasElegantDesign = true;
      
      calendarPickers.forEach((picker, index) => {
        // 检查CSS类
        const hasCorrectClasses = picker.classList.contains('calendar-picker');
        
        // 检查占位符
        const placeholder = picker.querySelector('.calendar-picker-placeholder');
        
        // 检查搜索框
        const searchInput = picker.querySelector('.calendar-search-input');
        
        // 检查下拉箭头
        const arrow = picker.querySelector('.calendar-picker-arrow');
        
        console.log(`CalendarPicker ${index + 1}:`);
        console.log(`  CSS类: ${hasCorrectClasses ? '✅' : '❌'}`);
        console.log(`  占位符: ${placeholder ? '✅' : '❌'}`);
        console.log(`  搜索框: ${searchInput ? '✅' : '❌'}`);
        console.log(`  下拉箭头: ${arrow ? '✅' : '❌'}`);
        
        if (!hasCorrectClasses || !searchInput || !arrow) {
          hasElegantDesign = false;
        }
      });
      
      // 检查是否使用了旧的破损UI
      const oldCalendarSelector = document.querySelectorAll('.calendar-selector');
      if (oldCalendarSelector.length > 0) {
        console.error('❌ 发现旧的日历选择器，应该已被移除');
        hasElegantDesign = false;
      } else {
        console.log('✅ 旧的日历选择器已正确移除');
      }
      
      return hasElegantDesign;
    },
    
    /**
     * 测试时间解析功能
     */
    testTimeHandling() {
      console.log('🔍 测试 4: 时间解析功能');
      
      // 检查是否有EventEditModal的时间输入框
      const startTimeInput = document.querySelector('input[type="datetime-local"]');
      if (!startTimeInput) {
        console.log('ℹ️ EventEditModal未打开，跳过时间解析测试');
        return true;
      }
      
      console.log('✅ 找到时间输入框');
      
      // 检查时间格式
      const startTime = (startTimeInput as HTMLInputElement).value;
      if (startTime) {
        console.log(`当前开始时间值: ${startTime}`);
        
        // 验证格式是否正确（YYYY-MM-DDTHH:mm）
        const timePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
        if (timePattern.test(startTime)) {
          console.log('✅ 时间格式正确');
          return true;
        } else {
          console.error('❌ 时间格式不正确');
          return false;
        }
      }
      
      console.log('ℹ️ 时间输入框为空');
      return true;
    },
    
    /**
     * 测试自动映射功能
     */
    testAutoMapping() {
      console.log('🔍 测试 5: 标签到日历的自动映射');
      
      // 检查是否有选中的标签
      const selectedTags = document.querySelectorAll('.tag-chip');
      const selectedCalendars = document.querySelectorAll('.calendar-chip');
      
      console.log(`选中的标签数量: ${selectedTags.length}`);
      console.log(`选中的日历数量: ${selectedCalendars.length}`);
      
      if (selectedTags.length > 0 && selectedCalendars.length > 0) {
        console.log('✅ 标签和日历都有选择，可能存在自动映射');
        return true;
      } else if (selectedTags.length > 0 && selectedCalendars.length === 0) {
        console.log('⚠️ 有选中标签但无选中日历，自动映射可能未生效');
        return false;
      } else {
        console.log('ℹ️ 标签或日历未选择，无法测试自动映射');
        return true;
      }
    },
    
    /**
     * 测试Electron端兼容性
     */
    testElectronCompatibility() {
      console.log('🔍 测试 6: Electron端兼容性');
      
      // 检查是否在Electron环境中
      const isElectron = typeof window !== 'undefined' && 
                         window.process && 
                         window.process.type;
      
      if (isElectron) {
        console.log('🖥️ 检测到Electron环境');
        
        // 检查是否有未知日历的错误显示
        const unknownCalendars = document.querySelectorAll('.calendar-chip-invalid');
        if (unknownCalendars.length > 0) {
          console.warn(`⚠️ 发现 ${unknownCalendars.length} 个未知日历显示`);
          unknownCalendars.forEach((chip, index) => {
            const text = chip.textContent;
            console.log(`  未知日历 ${index + 1}: ${text}`);
          });
          return false;
        } else {
          console.log('✅ 无未知日历显示错误');
        }
      } else {
        console.log('🌐 Web环境，跳过Electron特定检查');
      }
      
      return true;
    },
    
    /**
     * 运行所有测试
     */
    runAllTests() {
      console.log('🚀 开始运行EventEditModal日历分组测试套件');
      console.log('=' .repeat(60));
      
      const tests = [
        { name: 'CalendarPicker组件渲染', fn: this.testCalendarPickerRendering },
        { name: '多选日历功能', fn: this.testMultiSelection },
        { name: 'UI优雅性检查', fn: this.testUIElegance },
        { name: '时间解析功能', fn: this.testTimeHandling },
        { name: '自动映射功能', fn: this.testAutoMapping },
        { name: 'Electron端兼容性', fn: this.testElectronCompatibility }
      ];
      
      let passedTests = 0;
      const results: { name: string; passed: boolean; }[] = [];
      
      tests.forEach((test, index) => {
        console.log(`\n📋 测试 ${index + 1}: ${test.name}`);
        try {
          const result = test.fn.call(this);
          results.push({ name: test.name, passed: result });
          if (result) {
            passedTests++;
            console.log(`✅ ${test.name} 通过`);
          } else {
            console.log(`❌ ${test.name} 失败`);
          }
        } catch (error) {
          console.error(`💥 ${test.name} 执行错误:`, error);
          results.push({ name: test.name, passed: false });
        }
        console.log('-'.repeat(40));
      });
      
      console.log('\n🏁 测试完成');
      console.log(`✅ 通过: ${passedTests}/${tests.length}`);
      
      // 详细结果
      console.log('\n📊 详细结果:');
      results.forEach(result => {
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.name}`);
      });
      
      console.log('=' .repeat(60));
      
      if (passedTests === tests.length) {
        console.log('🎉 所有测试通过！EventEditModal日历分组功能正常');
      } else if (passedTests >= tests.length * 0.8) {
        console.log('⚡ 大部分测试通过，功能基本正常');
      } else {
        console.log('⚠️ 多个测试失败，需要检查功能实现');
      }
      
      return passedTests;
    },
    
    /**
     * 获取当前状态信息
     */
    getCurrentState() {
      console.log('📊 EventEditModal日历分组状态信息');
      
      const info = {
        calendarPickers: document.querySelectorAll('.calendar-picker').length,
        selectedCalendars: document.querySelectorAll('.calendar-chip').length,
        selectedTags: document.querySelectorAll('.tag-chip').length,
        eventEditModals: document.querySelectorAll('.event-edit-modal-overlay').length,
        unknownCalendars: document.querySelectorAll('.calendar-chip-invalid').length,
        oldCalendarSelectors: document.querySelectorAll('.calendar-selector').length
      };
      
      console.table(info);
      
      // 建议
      if (info.eventEditModals === 0) {
        console.log('💡 建议：打开事件编辑弹窗以进行完整测试');
      }
      
      if (info.oldCalendarSelectors > 0) {
        console.warn('⚠️ 发现旧的日历选择器，建议清理');
      }
      
      if (info.unknownCalendars > 0) {
        console.warn('⚠️ 有未知日历显示，可能需要检查日历加载');
      }
      
      return info;
    }
  };
  
  // 将测试对象暴露到全局作用域
  if (typeof window !== 'undefined') {
    (window as any).testEventEditModalCalendars = testEventEditModalCalendars;
  }
  
  console.log('✅ EventEditModal日历分组测试脚本已加载');
  console.log('💡 使用 testEventEditModalCalendars.runAllTests() 运行所有测试');
  console.log('💡 使用 testEventEditModalCalendars.getCurrentState() 查看当前状态');
  
})();