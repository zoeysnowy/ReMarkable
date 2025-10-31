const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

// Check lines around 1399
for (let i = 1397; i <= 1402; i++) {
  const line = lines[i - 1];
  console.log(`Line ${i} (${line.length} chars):`, JSON.stringify(line));
  
  // Count quotes
  const doubleQuotes = (line.match(/"/g) || []).length;
  console.log(`  Double quotes: ${doubleQuotes}`);
  
  // Check for problematic characters
  const badChars = [...line].filter(c => {
    const code = c.charCodeAt(0);
    return code === 0xFFFD || (code >= 0xDC80 && code <= 0xDCFF) || code === 8220 || code === 8221;
  });
  
  if (badChars.length > 0) {
    console.log(`  ⚠️ Problematic chars:`, badChars.map(c => `'${c}' (U+${c.charCodeAt(0).toString(16)})`));
  }
  console.log('');
}
