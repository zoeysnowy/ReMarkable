const fs = require('fs');
const path = require('path');

const encodingFixes = [
  // "与" 的乱码变体
  { pattern: /�\?/g, replacement: '与' },
  // "和" 的乱码变体  
  { pattern: /�\u009D/g, replacement: '和' },
  // "时" 的乱码变体
  { pattern: /�\?/g, replacement: '时' },
  // "器" 的乱码变体
  { pattern: /�\?/g, replacement: '器' },
  // "在" 的乱码变体
  { pattern: /�\?/g, replacement: '在' },
  // "接" 的乱码变体
  { pattern: /�\?/g, replacement: '接' },
  // "新" 的乱码变体
  { pattern: /�\?/g, replacement: '新' },
  // "次" 的乱码变体
  { pattern: /�\?/g, replacement: '次' },
  // "用" 的乱码变体
  { pattern: /�\?/g, replacement: '用' },
  
  // 常见短语修复
  { pattern: /锟斤拷/g, replacement: '' },
  { pattern: /锟?/g, replacement: '和' },
  { pattern: /存锟?/g, replacement: '存在' },
  { pattern: /鎵惧埌锟?/g, replacement: '找到了' },
  { pattern: /妫€鏌ヤ竴锟?/g, replacement: '检查一次' },
  { pattern: /缁ф鏌?/g, replacement: '继续检查' },
  { pattern: /鎸佺画妫€鏌?/g, replacement: '持续检查' },
  { pattern: /绌轰緷璧栨暟缁?/g, replacement: '空依赖数组' },
  { pattern: /鎵ц涓€锟?/g, replacement: '执行一次' },
  { pattern: /瀹氭椂鍣ㄥ紩锟?/g, replacement: '定时器引用' },
  { pattern: /鑺傛祦鐢ㄧ殑鏃堕棿锟?/g, replacement: '节流用的时间戳' },
  { pattern: /鎷栧姩鐘讹拷/g, replacement: '拖动状态' },
  { pattern: /鎭㈠鑷畾涔夋嫋鍔ㄥ疄锟?/g, replacement: '恢复自定义拖动实现' },
  { pattern: /浣跨敤鍘熷/g, replacement: '使用原始' },
  { pattern: /绉婚櫎杩囧害浼樺寲/g, replacement: '移除过度优化' },
  { pattern: /鐢熸垚鎴栬鍙栧敮涓€锟?/g, replacement: '生成或读取唯一的' },
  { pattern: /灏濊瘯锟?/g, replacement: '尝试从' },
  { pattern: /骞朵繚锟?/g, replacement: '并保存' },
  { pattern: /鐢熸垚鍞竴鐨勫瓨锟?/g, replacement: '生成唯一的存储' },
  { pattern: /鍒濆鍖栧畬锟?/g, replacement: '初始化完成' },
  { pattern: /杩借釜鍚屾鏇存柊鐨勪簨浠舵暟锟?/g, replacement: '追踪同步更新的事件数量' },
  { pattern: /杩借釜璁よ瘉鐘讹€?/g, replacement: '追踪认证状态' },
  { pattern: /纭繚鍦ㄩ娆℃覆鏌撳墠灏卞姞杞借锟?/g, replacement: '确保在首次渲染前就加载设置' },
  { pattern: /璋冩暣澶у皬鐘讹€?/g, replacement: '调整大小状态' },
  
  // 特殊字符修复
  { pattern: /鍙傛暟璇诲彇/g, replacement: '参数读取' },
  { pattern: /璇诲彇/g, replacement: '读取' },
  { pattern: /鍏ㄥ眬/g, replacement: '全局' },
  { pattern: /绛夊緟/g, replacement: '等待' },
  { pattern: /绔嬪嵆/g, replacement: '立即' },
  { pattern: /濡傛灉/g, replacement: '如果' },
  { pattern: /涓嶉渶瑕?/g, replacement: '不需要' },
  { pattern: /鍚庣画/g, replacement: '后续' },
  { pattern: /妫€鏌?/g, replacement: '检查' },
  { pattern: /鍙/g, replacement: '只' },
  { pattern: /鎸傝浇/g, replacement: '挂载' },
  { pattern: /鏃?/g, replacement: '时' },
  { pattern: /鎵ц/g, replacement: '执行' },
  { pattern: /涓€娆?/g, replacement: '一次' },
  { pattern: /瀹氭椂鍣?/g, replacement: '定时器' },
  { pattern: /寮曠敤/g, replacement: '引用' },
  { pattern: /浣跨敤/g, replacement: '使用' },
  { pattern: /鎳掑姞杞?/g, replacement: '懒加载' },
  { pattern: /纭繚/g, replacement: '确保' },
  { pattern: /鍦?/g, replacement: '在' },
  { pattern: /棣栨/g, replacement: '首次' },
  { pattern: /娓叉煋/g, replacement: '渲染' },
  { pattern: /鍓?/g, replacement: '前' },
  { pattern: /灏?/g, replacement: '就' },
  { pattern: /鍔犺浇/g, replacement: '加载' },
  { pattern: /璁剧疆/g, replacement: '设置' },
];

const filesToFix = [
  'src/pages/DesktopCalendarWidget.tsx',
];

console.log('修复所有已知编码乱码模式...\n');

let totalFixes = 0;

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  
  if (fs.existsSync(fullPath)) {
    try {
      let content = fs.readFileSync(fullPath, 'utf-8');
      let changeCount = 0;
      
      encodingFixes.forEach(fix => {
        const matches = content.match(fix.pattern);
        if (matches) {
          changeCount += matches.length;
          content = content.replace(fix.pattern, fix.replacement);
        }
      });
      
      if (changeCount > 0) {
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log(`✅ ${file}: 修复了 ${changeCount} 处乱码`);
        totalFixes += changeCount;
      } else {
        console.log(`✓  ${file}: 没有发现乱码`);
      }
    } catch (error) {
      console.error(`❌ 处理 ${file} 时出错:`, error.message);
    }
  } else {
    console.log(`⚠️  文件不存在: ${file}`);
  }
});

console.log(`\n总计修复 ${totalFixes} 处乱码`);
