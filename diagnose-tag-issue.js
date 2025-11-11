/**
 * Tag 插入和同步问题诊断脚本
 * 
 * 使用方法：
 * 1. 打开浏览器控制台（F12）
 * 2. 复制粘贴本文件全部内容
 * 3. 按回车执行
 * 4. 使用以下命令进行诊断
 */

console.log('%c═══════════════════════════════════════════', 'color: #2196F3; font-weight: bold');
console.log('%c🔍 Tag 诊断工具已加载', 'color: #2196F3; font-size: 16px; font-weight: bold');
console.log('%c═══════════════════════════════════════════', 'color: #2196F3; font-weight: bold');
console.log('');
console.log('📋 可用命令:');
console.log('  window.debugSlate()        - 查看 Slate 编辑器完整结构');
console.log('  window.debugFocus()        - 查看当前聚焦行信息');
console.log('  window.debugPicker()       - 查看 Tag Picker 状态');
console.log('  window.compareTagStates()  - 对比 DOM/Slate/Picker 三者状态');
console.log('');

/**
 * 查看 Slate 编辑器的完整节点结构
 */
window.debugSlate = function() {
  console.log('%c═══════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');
  console.log('%c📊 Slate 编辑器节点结构', 'color: #4CAF50; font-size: 16px; font-weight: bold');
  console.log('%c═══════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');
  
  const editorContainer = document.querySelector('[contenteditable="true"]');
  if (!editorContainer) {
    console.error('❌ 未找到 Slate 编辑器');
    return null;
  }
  
  // 尝试获取 React Fiber 节点，找到 Slate 编辑器实例
  let slateEditor = null;
  
  // 方法1: 从 DOM 元素找到 React 实例
  const reactKey = Object.keys(editorContainer).find(key => key.startsWith('__react'));
  if (reactKey) {
    let fiber = editorContainer[reactKey];
    while (fiber) {
      if (fiber.return && fiber.return.memoizedState?.editor) {
        slateEditor = fiber.return.memoizedState.editor;
        break;
      }
      fiber = fiber.return;
    }
  }
  
  if (!slateEditor) {
    console.warn('⚠️ 无法直接访问 Slate 编辑器实例');
    console.log('💡 但我们可以从 DOM 推断结构...');
    
    // 从 DOM 推断节点结构
    const lines = editorContainer.querySelectorAll('[data-line-id]');
    console.log(`\n📝 共找到 ${lines.length} 个编辑行:\n`);
    
    const lineInfo = [];
    lines.forEach((line, index) => {
      const lineId = line.getAttribute('data-line-id');
      const isDesc = lineId.includes('-desc') || line.classList.contains('description-mode');
      const tags = line.querySelectorAll('[data-type="tag"]');
      
      const tagInfo = Array.from(tags).map(tag => ({
        id: tag.getAttribute('data-tag-id'),
        name: tag.getAttribute('data-tag-name'),
        emoji: tag.getAttribute('data-tag-emoji'),
        mentionOnly: tag.getAttribute('data-mention-only') === 'true'
      }));
      
      lineInfo.push({
        '序号': index + 1,
        'Line ID': lineId,
        '模式': isDesc ? 'Description' : 'Title',
        '标签数': tags.length,
        '标签': tagInfo.map(t => `${t.emoji || ''}${t.name}${t.mentionOnly ? '(M)' : ''}`).join(', ') || '-'
      });
    });
    
    console.table(lineInfo);
    return { method: 'DOM', lines: lineInfo };
  }
  
  // 如果成功获取 Slate 编辑器，显示其节点结构
  console.log('✅ 成功访问 Slate 编辑器实例\n');
  console.log('📋 编辑器节点结构:\n');
  
  const nodeInfo = slateEditor.children.map((node, index) => {
    // 收集这个节点下的所有 tag
    const tags = [];
    
    const collectTags = (n) => {
      if (!n) return;
      if (n.type === 'tag') {
        tags.push({
          id: n.tagId,
          name: n.tagName,
          emoji: n.tagEmoji,
          mentionOnly: n.mentionOnly || false
        });
      }
      if (n.children && Array.isArray(n.children)) {
        n.children.forEach(collectTags);
      }
    };
    
    collectTags(node);
    
    return {
      '序号': index + 1,
      'Event ID': node.eventId || '-',
      'Line ID': node.lineId || '-',
      '模式': node.mode || '-',
      'Level': node.level || 0,
      '标签数': tags.length,
      '标签详情': tags.map(t => `${t.emoji || ''}${t.name}${t.mentionOnly ? '(mention)' : ''}`).join(', ') || '-'
    };
  });
  
  console.table(nodeInfo);
  
  // 返回原始数据供进一步分析
  return {
    method: 'Slate',
    editor: slateEditor,
    nodes: slateEditor.children,
    summary: nodeInfo
  };
};

/**
 * 查看当前聚焦行的详细信息
 */
window.debugFocus = function() {
  console.log('%c═══════════════════════════════════════════', 'color: #FF9800; font-weight: bold');
  console.log('%c🎯 当前聚焦行信息', 'color: #FF9800; font-size: 16px; font-weight: bold');
  console.log('%c═══════════════════════════════════════════', 'color: #FF9800; font-weight: bold');
  
  const focusedLine = document.activeElement;
  
  if (!focusedLine || !focusedLine.hasAttribute('data-line-id')) {
    console.warn('⚠️ 当前没有聚焦任何编辑行');
    console.log('💡 请点击一个 Event 的 Title 或 Description');
    return null;
  }
  
  const lineId = focusedLine.getAttribute('data-line-id');
  const isDesc = lineId.includes('-desc') || focusedLine.classList.contains('description-mode');
  const actualItemId = lineId.replace('-desc', '');
  
  console.log('\n📌 基本信息:');
  console.log('  Line ID:', lineId);
  console.log('  Event ID (推测):', actualItemId);
  console.log('  模式:', isDesc ? 'Description' : 'Title');
  console.log('  CSS Class:', focusedLine.className);
  
  // 查找这一行的标签
  const tags = focusedLine.querySelectorAll('[data-type="tag"]');
  console.log('\n🏷️  当前行的标签 (DOM):');
  console.log('  总数:', tags.length);
  
  if (tags.length > 0) {
    const tagList = Array.from(tags).map((tag, i) => ({
      '序号': i + 1,
      'Tag ID': tag.getAttribute('data-tag-id'),
      '名称': tag.getAttribute('data-tag-name'),
      'Emoji': tag.getAttribute('data-tag-emoji') || '-',
      'Mention Only': tag.getAttribute('data-mention-only') === 'true' ? '✅' : '❌'
    }));
    console.table(tagList);
  } else {
    console.log('  (无标签)');
  }
  
  // 检查 Slate 选区
  const selection = window.getSelection();
  console.log('\n📍 光标/选区信息:');
  console.log('  isCollapsed:', selection.isCollapsed);
  console.log('  anchorNode:', selection.anchorNode?.nodeName);
  console.log('  anchorOffset:', selection.anchorOffset);
  
  return {
    lineId,
    eventId: actualItemId,
    mode: isDesc ? 'description' : 'title',
    tagCount: tags.length,
    tags: Array.from(tags).map(t => ({
      id: t.getAttribute('data-tag-id'),
      name: t.getAttribute('data-tag-name'),
      emoji: t.getAttribute('data-tag-emoji'),
      mentionOnly: t.getAttribute('data-mention-only') === 'true'
    }))
  };
};

/**
 * 查看 Tag Picker 状态
 */
window.debugPicker = function() {
  console.log('%c═══════════════════════════════════════════', 'color: #9C27B0; font-weight: bold');
  console.log('%c🎨 Tag Picker 状态', 'color: #9C27B0; font-size: 16px; font-weight: bold');
  console.log('%c═══════════════════════════════════════════', 'color: #9C27B0; font-weight: bold');
  
  const toolbar = document.querySelector('.headless-floating-toolbar');
  if (!toolbar) {
    console.warn('⚠️ 未找到 FloatingToolbar');
    console.log('💡 可能尚未打开任何 Picker');
    return null;
  }
  
  console.log('✅ FloatingToolbar 存在\n');
  
  // 查找 Tag Picker
  const tagPicker = toolbar.querySelector('[class*="tag"]') || 
                    document.querySelector('.tag-picker');
  
  if (!tagPicker) {
    console.warn('⚠️ Tag Picker 未打开');
    console.log('💡 点击编辑器工具栏的 # 按钮打开 Tag Picker');
    return { toolbarExists: true, pickerOpen: false };
  }
  
  console.log('✅ Tag Picker 已打开\n');
  
  // 查找所有标签项
  const tagItems = tagPicker.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
  console.log(`📋 Picker 中的标签项: ${tagItems.length}\n`);
  
  const pickerTags = [];
  tagItems.forEach((item, index) => {
    const checkbox = item.type === 'checkbox' ? item : item.querySelector('input[type="checkbox"]');
    const label = item.closest('label') || item.parentElement;
    const text = label ? label.textContent.trim() : '未知';
    const checked = checkbox ? checkbox.checked : false;
    
    // 尝试找到 tag ID
    const tagId = checkbox?.value || checkbox?.getAttribute('data-tag-id') || 
                  label?.getAttribute('data-tag-id') || '未知';
    
    pickerTags.push({
      '序号': index + 1,
      '标签': text,
      'Tag ID': tagId,
      '勾选状态': checked ? '✅' : '❌'
    });
  });
  
  console.table(pickerTags);
  
  return {
    toolbarExists: true,
    pickerOpen: true,
    totalTags: tagItems.length,
    checkedTags: pickerTags.filter(t => t['勾选状态'] === '✅').length,
    tags: pickerTags
  };
};

/**
 * 综合对比：DOM、Slate、Picker 三者的状态
 */
window.compareTagStates = function() {
  console.log('%c═══════════════════════════════════════════', 'color: #00BCD4; font-weight: bold');
  console.log('%c🔬 Tag 状态对比分析', 'color: #00BCD4; font-size: 18px; font-weight: bold');
  console.log('%c═══════════════════════════════════════════', 'color: #00BCD4; font-weight: bold');
  console.log('');
  
  // 1. 当前聚焦行
  const focusInfo = window.debugFocus();
  if (!focusInfo) {
    console.error('❌ 请先聚焦一个编辑行');
    return;
  }
  
  console.log('\n' + '─'.repeat(50) + '\n');
  
  // 2. Slate 节点结构
  const slateInfo = window.debugSlate();
  
  console.log('\n' + '─'.repeat(50) + '\n');
  
  // 3. Picker 状态
  const pickerInfo = window.debugPicker();
  
  console.log('\n' + '═'.repeat(50) + '\n');
  
  // 4. 对比分析
  console.log('%c📊 对比分析', 'color: #00BCD4; font-size: 16px; font-weight: bold');
  console.log('');
  
  const domTags = focusInfo.tags.map(t => t.id);
  const domTagsSet = new Set(domTags);
  
  console.log('🔍 当前聚焦行 (' + focusInfo.mode + ' 模式):');
  console.log('  Line ID:', focusInfo.lineId);
  console.log('  Event ID:', focusInfo.eventId);
  console.log('  DOM 中的标签:', domTags.join(', ') || '(无)');
  
  if (slateInfo && slateInfo.method === 'Slate') {
    // 找到对应的 Slate 节点
    const matchingNode = slateInfo.nodes.find(n => 
      n.lineId === focusInfo.lineId || 
      n.eventId === focusInfo.eventId
    );
    
    if (matchingNode) {
      console.log('  ✅ 在 Slate 中找到匹配节点');
      console.log('    Slate Node ID:', matchingNode.lineId);
      console.log('    Slate Event ID:', matchingNode.eventId);
      console.log('    Slate Mode:', matchingNode.mode);
    } else {
      console.warn('  ⚠️ 在 Slate 中未找到匹配节点！');
      console.log('  可用的 Slate 节点:');
      slateInfo.nodes.forEach((n, i) => {
        console.log(`    [${i}] eventId: ${n.eventId}, lineId: ${n.lineId}, mode: ${n.mode}`);
      });
    }
  }
  
  if (pickerInfo && pickerInfo.pickerOpen) {
    const checkedInPicker = pickerInfo.tags
      .filter(t => t['勾选状态'] === '✅')
      .map(t => t['Tag ID']);
    
    console.log('  Picker 中勾选的标签:', checkedInPicker.join(', ') || '(无)');
    
    // 对比
    const inDomNotInPicker = domTags.filter(id => !checkedInPicker.includes(id));
    const inPickerNotInDom = checkedInPicker.filter(id => !domTags.includes(id));
    
    if (inDomNotInPicker.length > 0) {
      console.warn('  ⚠️ DOM 中有但 Picker 未勾选:', inDomNotInPicker.join(', '));
    }
    
    if (inPickerNotInDom.length > 0) {
      console.warn('  ⚠️ Picker 勾选了但 DOM 中没有:', inPickerNotInDom.join(', '));
    }
    
    if (inDomNotInPicker.length === 0 && inPickerNotInDom.length === 0) {
      console.log('  ✅ DOM 和 Picker 状态一致');
    }
  } else {
    console.log('  ⚠️ Tag Picker 未打开，无法对比');
  }
  
  console.log('\n' + '═'.repeat(50) + '\n');
  
  return {
    focus: focusInfo,
    slate: slateInfo,
    picker: pickerInfo
  };
};

// 自动运行一次综合诊断
console.log('');
console.log('%c💡 快速开始:', 'color: #4CAF50; font-weight: bold');
console.log('  1. 点击一个 Event 的 Description 编辑器');
console.log('  2. 打开 Tag Picker（点击 # 按钮）');
console.log('  3. 运行: window.compareTagStates()');
console.log('');
