# -*- coding: utf-8 -*-

# 读取文件
with open(r'c:\Users\Zoey\ReMarkable\src\features\Calendar\TimeCalendar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 定义新代码
new_code = '''  const loadEvents = useCallback(() => {
    // ✅ 防止组件卸载后继续执行
    if (!eventListenersAttachedRef.current) {
      console.log('⏭️ [TimeCalendar] Skipping loadEvents - component unmounted');
      return;
    }
    
    console.log(`🔄 [TimeCalendar] loadEvents START at ${performance.now().toFixed(2)}ms`);
    const startTime = performance.now();
    try {
      // 🎯 [PERFORMANCE FIX] 根据当前视图计算需要加载的日期范围
      // 月视图：加载当月 + 前后各 7 天（覆盖跨月显示）
      // 周视图：加载当周 + 前后各 7 天
      // 日视图：加载当天 + 前后各 1 天
      const viewStart = new Date(currentDate);
      const viewEnd = new Date(currentDate);
      
      if (currentView === 'month') {
        // 月视图：加载当月 + 前后各 7 天缓冲
        viewStart.setDate(1); // 月初
        viewStart.setDate(viewStart.getDate() - 7); // 往前 7 天
        viewEnd.setMonth(viewEnd.getMonth() + 1, 0); // 月末
        viewEnd.setDate(viewEnd.getDate() + 7); // 往后 7 天
      } else if (currentView === 'week') {
        // 周视图：加载当周 + 前后各 7 天缓冲
        const dayOfWeek = viewStart.getDay();
        viewStart.setDate(viewStart.getDate() - dayOfWeek - 7);
        viewEnd.setDate(viewEnd.getDate() + (6 - dayOfWeek) + 7);
      } else {
        // 日视图：加载当天 + 前后各 1 天缓冲
        viewStart.setDate(viewStart.getDate() - 1);
        viewEnd.setDate(viewEnd.getDate() + 1);
      }
      
      console.log(`📅 [TimeCalendar] Loading events for ${currentView} view: ${viewStart.toLocaleDateString()} ~ ${viewEnd.toLocaleDateString()}`);
      
      // 🚀 使用范围查询替代全量加载
      const queryStart = performance.now();
      const parsedEvents = EventService.getEventsByRange(viewStart, viewEnd);
      const queryDuration = performance.now() - queryStart;
      console.log(`🔍 [TimeCalendar] EventService.getEventsByRange took ${queryDuration.toFixed(2)}ms for ${parsedEvents.length} events`);
      
      console.log(`🎯 [TimeCalendar] About to call setEvents()...`);
      const setEventsStart = performance.now();
      setEvents(parsedEvents);
      const setEventsDuration = performance.now() - setEventsStart;
      console.log(`✅ [TimeCalendar] setEvents() took ${setEventsDuration.toFixed(2)}ms`);
    } catch (error) {
      console.error('❌ [LOAD] Failed to load events:', error);
    }
    const totalDuration = performance.now() - startTime;
    console.log(`🏁 [TimeCalendar] loadEvents COMPLETE in ${totalDuration.toFixed(2)}ms`);
  }, [currentDate, currentView]); // ✅ 依赖 currentDate 和 currentView，确保视图变化时重新加载'''

# 找到起始和结束位置
start_marker = '  const loadEvents = useCallback(() => {'
end_marker = '  }, []);'

idx1 = content.find(start_marker)
if idx1 == -1:
    print("Error: Cannot find start marker")
    exit(1)

idx2 = content.find(end_marker, idx1)
if idx2 == -1:
    print("Error: Cannot find end marker")
    exit(1)

idx2 += len(end_marker)

print(f"Found loadEvents function: {idx1} ~ {idx2}")

# 替换
new_content = content[:idx1] + new_code + content[idx2:]

# 添加 EventService 导入（如果还没有）
if 'EventService' not in content.split('const loadEvents')[0]:
    import_marker = "import { TagService } from '../../services/TagService';"
    import_pos = new_content.find(import_marker)
    if import_pos != -1:
        import_end = new_content.find('\n', import_pos) + 1
        new_import = "import { EventService } from '../../services/EventService'; // 🚀 按需加载优化\n"
        new_content = new_content[:import_end] + new_import + new_content[import_end:]
        print("Added EventService import")

# 写回文件
with open(r'c:\Users\Zoey\ReMarkable\src\features\Calendar\TimeCalendar.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done!")

