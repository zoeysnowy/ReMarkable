/**
 * 诊断 Tag 元素光标定位问题
 * 
 * 使用方法：
 * 1. 在浏览器控制台粘贴此脚本
 * 2. 在 PlanManager 中插入一个 Tag
 * 3. 尝试将光标定位在 Tag 后面
 * 4. 运行 window.diagnoseCursorAfterTag() 查看诊断结果
 */

(function() {
  console.log('%c[Tag Cursor 诊断] 脚本已加载', 'background: #4CAF50; color: white; padding: 4px 8px; font-weight: bold;');

  window.diagnoseCursorAfterTag = function() {
    console.group('%c Tag 光标定位诊断', 'background: #2196F3; color: white; padding: 4px 8px; font-weight: bold;');

    // 1. 查找所有 Tag 元素
    const tagElements = document.querySelectorAll('.inline-tag');
    console.log(`%c 找到 ${tagElements.length} 个 Tag 元素`, 'color: #FF9800; font-weight: bold;');

    if (tagElements.length === 0) {
      console.warn('未找到任何 Tag 元素。请先在编辑器中插入一个标签。');
      console.groupEnd();
      return;
    }

    tagElements.forEach((tag, index) => {
      console.group(`Tag #${index + 1}: ${tag.getAttribute('data-tag-name')}`);

      // 2. 检查 Tag DOM 结构
      console.log('DOM 结构:', {
        tagName: tag.tagName,
        className: tag.className,
        contentEditable: tag.getAttribute('contenteditable'),
        'data-type': tag.getAttribute('data-type'),
        innerHTML: tag.innerHTML,
      });

      // 3. 检查 Tag 的父节点
      const parent = tag.parentElement;
      console.log('父节点:', {
        tagName: parent?.tagName,
        className: parent?.className,
        contentEditable: parent?.getAttribute('contenteditable'),
      });

      // 4. 检查 Tag 后面的节点
      const nextSibling = tag.nextSibling;
      console.log('下一个兄弟节点:', {
        nodeType: nextSibling?.nodeType,
        nodeName: nextSibling?.nodeName,
        nodeValue: nextSibling?.nodeValue,
        textContent: nextSibling?.textContent,
        isText: nextSibling?.nodeType === Node.TEXT_NODE,
        startsWithSpace: nextSibling?.textContent?.startsWith(' '),
      });

      // 5. 检查 Slate 节点结构（通过 data 属性）
      let currentNode = tag;
      while (currentNode && !currentNode.hasAttribute('data-slate-node')) {
        currentNode = currentNode.parentElement;
      }

      if (currentNode) {
        console.log('Slate 节点:', {
          'data-slate-node': currentNode.getAttribute('data-slate-node'),
          'data-slate-inline': currentNode.getAttribute('data-slate-inline'),
          'data-slate-void': currentNode.getAttribute('data-slate-void'),
        });
      } else {
        console.warn('未找到对应的 Slate 节点');
      }

      console.groupEnd();
    });

    // 6. 检查当前光标位置
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      console.group('当前光标位置');
      console.log('Selection:', {
        type: selection.type,
        rangeCount: selection.rangeCount,
        isCollapsed: selection.isCollapsed,
      });
      console.log('Range:', {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
        commonAncestorContainer: range.commonAncestorContainer,
      });
      console.groupEnd();
    } else {
      console.log('当前无光标选区');
    }

    console.groupEnd();
  };

  window.testCursorAfterTag = function() {
    console.group('%c 测试：将光标定位到 Tag 后面', 'background: #9C27B0; color: white; padding: 4px 8px; font-weight: bold;');

    const tagElements = document.querySelectorAll('.inline-tag');
    if (tagElements.length === 0) {
      console.error('未找到任何 Tag 元素');
      console.groupEnd();
      return;
    }

    const firstTag = tagElements[0];
    console.log('目标 Tag:', firstTag.getAttribute('data-tag-name'));

    // 尝试定位光标
    const nextSibling = firstTag.nextSibling;
    
    if (!nextSibling) {
      console.error('Tag 后面没有节点！这可能是问题所在。');
      console.log('建议：检查 normalizeNode 是否正确插入了空格节点');
    } else if (nextSibling.nodeType === Node.TEXT_NODE) {
      console.log('Tag 后面是文本节点:', {
        textContent: nextSibling.textContent,
        length: nextSibling.textContent.length,
      });

      // 尝试将光标定位到文本节点的开始位置
      try {
        const range = document.createRange();
        range.setStart(nextSibling, 0);
        range.setEnd(nextSibling, 0);
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        console.log('✅ 光标已定位到 Tag 后面');
        window.diagnoseCursorAfterTag();
      } catch (error) {
        console.error('❌ 定位光标失败:', error);
      }
    } else {
      console.warn('Tag 后面不是文本节点，类型:', nextSibling.nodeType);
      console.log('节点详情:', nextSibling);
    }

    console.groupEnd();
  };

  window.checkNormalizeNode = function() {
    console.group('%c 检查 normalizeNode 配置', 'background: #FF5722; color: white; padding: 4px 8px; font-weight: bold;');

    // 尝试获取 Slate 编辑器实例
    const editorElement = document.querySelector('[data-slate-editor="true"]');
    if (!editorElement) {
      console.error('未找到 Slate 编辑器');
      console.groupEnd();
      return;
    }

    console.log('找到 Slate 编辑器:', editorElement);

    // 检查编辑器实例（通过 React DevTools 或全局变量）
    // 注意：这需要在开发环境中，且编辑器实例被暴露到全局
    if (window.__SLATE_EDITOR__) {
      const editor = window.__SLATE_EDITOR__;
      console.log('编辑器实例:', editor);
      console.log('isInline:', editor.isInline);
      console.log('isVoid:', editor.isVoid);
      console.log('normalizeNode:', editor.normalizeNode);
    } else {
      console.warn('编辑器实例未暴露到 window.__SLATE_EDITOR__');
      console.log('提示：在 PlanSlate.tsx 中添加 window.__SLATE_EDITOR__ = editor');
    }

    console.groupEnd();
  };

  // 自动检查
  setTimeout(() => {
    console.log('%c[自动检查] 3秒后运行诊断...', 'color: #2196F3;');
    setTimeout(() => {
      if (document.querySelectorAll('.inline-tag').length > 0) {
        window.diagnoseCursorAfterTag();
      } else {
        console.log('%c[自动检查] 未找到 Tag 元素，跳过诊断', 'color: #FF9800;');
      }
    }, 3000);
  }, 100);

  console.log('%c可用命令:', 'color: #4CAF50; font-weight: bold;');
  console.log('  window.diagnoseCursorAfterTag()  - 诊断 Tag 光标问题');
  console.log('  window.testCursorAfterTag()      - 测试光标定位');
  console.log('  window.checkNormalizeNode()      - 检查 normalizeNode 配置');
})();
