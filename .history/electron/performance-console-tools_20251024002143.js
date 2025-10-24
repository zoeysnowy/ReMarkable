/**
 * Electron 性能监控工具
 * 在浏览器控制台中使用这些命令来诊断性能问题
 * 
 * 使用方法：
 * 1. 打开应用
 * 2. 按 Ctrl+Shift+I 打开开发者工具
 * 3. 在 Console 中复制粘贴这个文件的内容
 * 4. 使用 window.perfTools 命令
 */

window.perfTools = {
  /**
   * 获取性能报告
   */
  async getReport() {
    if (!window.electronAPI) {
      console.error('❌ 不在 Electron 环境中');
      return;
    }
    
    const report = await window.electronAPI.performance.getReport();
    console.log('📊 性能报告:', report);
    return report;
  },
  
  /**
   * 打印格式化的性能报告
   */
  async printReport() {
    if (!window.electronAPI) {
      console.error('❌ 不在 Electron 环境中');
      return;
    }
    
    await window.electronAPI.performance.printReport();
    console.log('✅ 已在主进程打印性能报告（查看终端输出）');
  },
  
  /**
   * 重置性能统计
   */
  async resetStats() {
    if (!window.electronAPI) {
      console.error('❌ 不在 Electron 环境中');
      return;
    }
    
    await window.electronAPI.performance.resetStats();
    console.log('✅ 性能统计已重置');
  },
  
  /**
   * 显示格式化的性能摘要
   */
  async showSummary() {
    const report = await this.getReport();
    if (!report) return;
    
    console.log('\n========================================');
    console.log('📊 Electron 性能摘要');
    console.log('========================================');
    console.log('⏱️  运行时间:', report.uptime);
    console.log('\n💾 内存使用:');
    console.table({
      'RSS (常驻内存)': report.memory.rss,
      'Heap 已用': report.memory.heapUsed,
      'Heap 总量': report.memory.heapTotal,
      '外部内存': report.memory.external
    });
    console.log('\n⚡ CPU 使用:');
    console.table({
      '用户态时间': report.cpu.user,
      '内核态时间': report.cpu.system
    });
    
    // IPC 统计
    const ipcEntries = Object.entries(report.ipc);
    if (ipcEntries.length > 0) {
      console.log('\n📡 IPC 调用统计 (按调用次数排序):');
      const sorted = ipcEntries
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15)
        .map(([channel, stats]) => ({
          '通道': channel,
          '调用次数': stats.count,
          '平均耗时': `${stats.avgTime.toFixed(2)}ms`,
          '最大耗时': `${stats.maxTime}ms`,
          '最小耗时': stats.minTime === Infinity ? '0ms' : `${stats.minTime}ms`,
          '总耗时': `${stats.totalTime}ms`
        }));
      console.table(sorted);
      
      // 找出慢速调用
      const slowCalls = ipcEntries
        .filter(([_, stats]) => stats.avgTime > 50)
        .sort((a, b) => b[1].avgTime - a[1].avgTime);
      
      if (slowCalls.length > 0) {
        console.warn('\n⚠️  慢速 IPC 调用 (平均 > 50ms):');
        slowCalls.forEach(([channel, stats]) => {
          console.warn(`   ${channel}: 平均 ${stats.avgTime.toFixed(2)}ms (${stats.count} 次调用)`);
        });
      }
    } else {
      console.log('\n📡 暂无 IPC 调用记录');
    }
    
    console.log('========================================\n');
  },
  
  /**
   * 监控 IPC 调用（实时）
   */
  async monitorIPC(duration = 10000) {
    console.log(`🔍 开始监控 IPC 调用 (${duration / 1000}秒)...`);
    
    const before = await this.getReport();
    
    setTimeout(async () => {
      const after = await this.getReport();
      
      console.log('\n========================================');
      console.log(`📊 IPC 监控结果 (${duration / 1000}秒内)`);
      console.log('========================================');
      
      const changes = [];
      Object.keys(after.ipc).forEach(channel => {
        const afterStats = after.ipc[channel];
        const beforeStats = before.ipc[channel];
        
        if (!beforeStats) {
          changes.push({
            '通道': channel,
            '调用次数': afterStats.count,
            '平均耗时': `${afterStats.avgTime.toFixed(2)}ms`,
            '总耗时': `${afterStats.totalTime}ms`
          });
        } else {
          const countDiff = afterStats.count - beforeStats.count;
          if (countDiff > 0) {
            const timeDiff = afterStats.totalTime - beforeStats.totalTime;
            const avgTime = timeDiff / countDiff;
            changes.push({
              '通道': channel,
              '调用次数': countDiff,
              '平均耗时': `${avgTime.toFixed(2)}ms`,
              '总耗时': `${timeDiff}ms`
            });
          }
        }
      });
      
      if (changes.length > 0) {
        changes.sort((a, b) => b['调用次数'] - a['调用次数']);
        console.table(changes);
        
        // 高频调用警告
        const highFreq = changes.filter(c => c['调用次数'] > 50);
        if (highFreq.length > 0) {
          console.warn(`\n⚠️  高频调用检测到 (> 50 次/${duration / 1000}秒):`);
          highFreq.forEach(c => {
            console.warn(`   ${c['通道']}: ${c['调用次数']} 次`);
          });
        }
      } else {
        console.log('📭 期间没有 IPC 调用');
      }
      
      console.log('========================================\n');
    }, duration);
  },
  
  /**
   * 检查内存泄漏
   */
  async checkMemoryLeak(interval = 5000, samples = 6) {
    console.log(`🔍 开始内存泄漏检测 (${samples} 个样本，间隔 ${interval / 1000}秒)...`);
    
    const snapshots = [];
    let count = 0;
    
    const takeSnapshot = async () => {
      const report = await this.getReport();
      const heap = parseFloat(report.memory.heapUsed);
      snapshots.push({
        time: new Date().toLocaleTimeString(),
        heapMB: heap
      });
      count++;
      
      console.log(`📸 快照 ${count}/${samples}: ${heap} MB`);
      
      if (count >= samples) {
        // 分析趋势
        console.log('\n========================================');
        console.log('📊 内存趋势分析');
        console.log('========================================');
        console.table(snapshots);
        
        // 计算增长率
        const first = snapshots[0].heapMB;
        const last = snapshots[snapshots.length - 1].heapMB;
        const growth = last - first;
        const growthPercent = ((growth / first) * 100).toFixed(2);
        
        console.log(`\n📈 内存变化: ${first} MB -> ${last} MB`);
        console.log(`📊 增长量: ${growth.toFixed(2)} MB (${growthPercent}%)`);
        
        if (growth > 10) {
          console.warn('⚠️  内存增长超过 10 MB，可能存在内存泄漏！');
        } else if (growth > 5) {
          console.warn('⚠️  内存增长较多，建议继续观察');
        } else {
          console.log('✅ 内存使用正常');
        }
        
        console.log('========================================\n');
      } else {
        setTimeout(takeSnapshot, interval);
      }
    };
    
    takeSnapshot();
  },
  
  /**
   * 性能建议
   */
  async getSuggestions() {
    const report = await this.getReport();
    if (!report) return;
    
    console.log('\n========================================');
    console.log('💡 性能优化建议');
    console.log('========================================');
    
    const suggestions = [];
    
    // 检查内存
    const heapUsed = parseFloat(report.memory.heapUsed);
    if (heapUsed > 200) {
      suggestions.push('🔴 内存使用过高 (> 200 MB)，建议检查是否有内存泄漏');
    } else if (heapUsed > 100) {
      suggestions.push('🟡 内存使用较高 (> 100 MB)，可以考虑优化');
    }
    
    // 检查慢速 IPC
    const slowIPCs = Object.entries(report.ipc)
      .filter(([_, stats]) => stats.avgTime > 100);
    
    if (slowIPCs.length > 0) {
      suggestions.push(`🔴 发现 ${slowIPCs.length} 个慢速 IPC 调用 (平均 > 100ms):`);
      slowIPCs.forEach(([channel, stats]) => {
        suggestions.push(`   - ${channel}: ${stats.avgTime.toFixed(2)}ms`);
      });
    }
    
    // 检查高频 IPC
    const highFreqIPCs = Object.entries(report.ipc)
      .filter(([_, stats]) => stats.count > 1000);
    
    if (highFreqIPCs.length > 0) {
      suggestions.push(`🟡 发现 ${highFreqIPCs.length} 个高频 IPC 调用 (> 1000 次):`);
      highFreqIPCs.forEach(([channel, stats]) => {
        suggestions.push(`   - ${channel}: ${stats.count} 次`);
        suggestions.push(`     建议：考虑批量处理或添加防抖/节流`);
      });
    }
    
    if (suggestions.length === 0) {
      console.log('✅ 没有发现明显的性能问题');
    } else {
      suggestions.forEach(s => console.log(s));
    }
    
    console.log('========================================\n');
  },
  
  /**
   * 帮助信息
   */
  help() {
    console.log('\n========================================');
    console.log('📖 性能工具帮助');
    console.log('========================================');
    console.log('可用命令:');
    console.log('');
    console.log('  perfTools.showSummary()');
    console.log('    显示完整的性能摘要');
    console.log('');
    console.log('  perfTools.monitorIPC(duration)');
    console.log('    监控指定时间内的 IPC 调用');
    console.log('    duration: 监控时长(毫秒)，默认 10000');
    console.log('');
    console.log('  perfTools.checkMemoryLeak(interval, samples)');
    console.log('    检测内存泄漏');
    console.log('    interval: 采样间隔(毫秒)，默认 5000');
    console.log('    samples: 采样次数，默认 6');
    console.log('');
    console.log('  perfTools.getSuggestions()');
    console.log('    获取性能优化建议');
    console.log('');
    console.log('  perfTools.getReport()');
    console.log('    获取原始性能报告');
    console.log('');
    console.log('  perfTools.printReport()');
    console.log('    在主进程终端打印报告');
    console.log('');
    console.log('  perfTools.resetStats()');
    console.log('    重置性能统计');
    console.log('');
    console.log('示例:');
    console.log('  // 快速诊断');
    console.log('  await perfTools.showSummary()');
    console.log('  await perfTools.getSuggestions()');
    console.log('');
    console.log('  // 监控 30 秒内的 IPC 调用');
    console.log('  await perfTools.monitorIPC(30000)');
    console.log('');
    console.log('  // 检测内存泄漏（10 个样本，每 3 秒采样）');
    console.log('  await perfTools.checkMemoryLeak(3000, 10)');
    console.log('========================================\n');
  }
};

// 自动显示帮助
console.log('✅ 性能工具已加载！输入 perfTools.help() 查看帮助');
