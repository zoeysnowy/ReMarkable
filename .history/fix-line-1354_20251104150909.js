const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'PlanManager.tsx');

console.log('Reading file:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Replace editorRegistryRef.current.get(targetId) with unifiedEditorRef.current
console.log('Applying fix 1: editorRegistryRef -> unifiedEditorRef');
content = content.replace(
  /const editor = editorRegistryRef\.current\.get\(targetId\);/g,
  'const editor = unifiedEditorRef.current;'
);

// Fix 2: Replace Tiptap insertContent with insertEmoji
console.log('Applying fix 2: Tiptap chain -> insertEmoji');
content = content.replace(
  /const html = `<span class="time-mention">📅 \$\{rawText\}<\/span>&nbsp;`;[\r\n\s]*editor\.chain\(\)\.focus\(\)\.insertContent\(html\)\.run\(\);/g,
  'insertEmoji(editor, `📅 ${rawText}`);'
);

// Fix 3: Replace editor.getHTML() with getEditorHTML(editor) 
console.log('Applying fix 3: editor.getHTML() -> getEditorHTML(editor)');
content = content.replace(
  /const updatedHTML = editor\.getHTML\(\);/g,
  'const updatedHTML = getEditorHTML(editor);'
);

console.log('Writing updated content...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ All fixes applied successfully!');
