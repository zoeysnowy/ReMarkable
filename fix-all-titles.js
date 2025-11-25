// ========== Title 数据修复脚本 v2 ==========
window.fixAllTitleIssues = function() {
  console.log('%c开始修复 Title 数据...', 'color: blue; font-weight: bold');
  
  const rawData = localStorage.getItem('EVENTS');
  if (!rawData) {
    console.error(' 没有找到 EVENTS 数据');
    return;
  }
  
  const events = JSON.parse(rawData);
  console.log(' 总事件数:', events.length);
  
  let fixCount = 0;
  let stringToObject = 0;
  let emptyObject = 0;
  let missingSimpleTitle = 0;
  
  events.forEach(event => {
    let needsFix = false;
    let fixType = '';
    
    // 情况 1: title 是字符串
    if (typeof event.title === 'string') {
      event.title = {
        simpleTitle: event.title,
        colorTitle: event.title,
        fullTitle: JSON.stringify([{ type: 'paragraph', children: [{ text: event.title }] }])
      };
      needsFix = true;
      fixType = 'stringobject';
      stringToObject++;
    }
    // 情况 2: title 是空对象或所有字段都是 undefined
    else if (event.title && typeof event.title === 'object') {
      const { simpleTitle, colorTitle, fullTitle } = event.title;
      
      // 如果所有字段都是 undefined 或空字符串
      if (!simpleTitle && !colorTitle && !fullTitle) {
        event.title = {
          simpleTitle: '',
          colorTitle: '',
          fullTitle: JSON.stringify([{ type: 'paragraph', children: [{ text: '' }] }])
        };
        needsFix = true;
        fixType = 'emptyfilled';
        emptyObject++;
      }
      // 如果缺少 simpleTitle 但有其他字段
      else if (!simpleTitle && (colorTitle || fullTitle)) {
        event.title.simpleTitle = colorTitle || '';
        if (!event.title.colorTitle) event.title.colorTitle = event.title.simpleTitle;
        if (!event.title.fullTitle) {
          event.title.fullTitle = JSON.stringify([{ 
            type: 'paragraph', 
            children: [{ text: event.title.simpleTitle }] 
          }]);
        }
        needsFix = true;
        fixType = 'missing-simpleTitle';
        missingSimpleTitle++;
      }
    }
    // 情况 3: title 是 undefined
    else if (!event.title) {
      event.title = {
        simpleTitle: '',
        colorTitle: '',
        fullTitle: JSON.stringify([{ type: 'paragraph', children: [{ text: '' }] }])
      };
      needsFix = true;
      fixType = 'undefinedobject';
      emptyObject++;
    }
    
    if (needsFix) {
      fixCount++;
      if (fixCount <= 10) {
        console.log(\ [] : \, event.title);
      }
    }
  });
  
  localStorage.setItem('EVENTS', JSON.stringify(events));
  
  console.log('%c========== 修复完成 ==========', 'color: green; font-weight: bold');
  console.log(\ 总共修复:  个事件\);
  console.log(\  - String  Object: \);
  console.log(\  - 空对象填充: \);
  console.log(\  - 缺失 simpleTitle: \);
  console.log('');
  console.log(' 请刷新页面查看效果');
  
  return { fixCount, stringToObject, emptyObject, missingSimpleTitle };
};

console.log(' 修复函数已加载');
console.log(' 运行: window.fixAllTitleIssues()');
