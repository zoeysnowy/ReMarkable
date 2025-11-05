/**
 * ⚠️ 在浏览器控制台运行
 * 直接导出事件的原始 JSON，不做任何处理
 */

const targetId = 'local-1761808870380';
const rawData = localStorage.getItem('remarkable-events');

if (!rawData) {
  console.error('❌ 没有数据');
} else {
  const events = JSON.parse(rawData);
  const event = events.find(e => e.id === targetId);
  
  if (!event) {
    console.error('❌ 事件不存在');
  } else {
    console.log('='.repeat(80));
    console.log('📄 事件原始 JSON（未处理）：');
    console.log('='.repeat(80));
    console.log(JSON.stringify(event, null, 2));
    console.log('');
    console.log('='.repeat(80));
    console.log('🔍 Description 字段详细信息：');
    console.log('='.repeat(80));
    console.log('类型:', typeof event.description);
    console.log('值:', event.description);
    console.log('长度:', event.description ? event.description.length : 'N/A');
    console.log('是否为空字符串:', event.description === '');
    console.log('是否为 null:', event.description === null);
    console.log('是否为 undefined:', event.description === undefined);
    console.log('是否有内容 (!!value):', !!event.description);
    
    // 如果是字符串，显示前 200 个字符
    if (typeof event.description === 'string' && event.description.length > 0) {
      console.log('');
      console.log('内容预览（前 200 字符）:');
      console.log(event.description.substring(0, 200));
    }
  }
}

// 同时检查：打开 EditModal 时，传入的 event prop 是什么
console.log('');
console.log('='.repeat(80));
console.log('💡 如何确认 EditModal 看到的数据：');
console.log('='.repeat(80));
console.log('1. 在 EditModal 打开时，在控制台执行：');
console.log('   $r.props.event.description');
console.log('2. 或者在 EventEditModal.tsx 的 useEffect 里添加 console.log');
console.log('3. 查看 React DevTools → Components → EventEditModal → props');
