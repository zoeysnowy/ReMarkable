const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
const line1399 = lines[1398]; // 0-indexed

console.log('Line 1399:', line1399);
console.log('\nCharacter analysis around "同步":');
const chars = [...line1399];
chars.forEach((c, i) => {
  if (i >= 30 && i <= 50) {
    console.log(`Position ${i}: '${c}' (code: ${c.charCodeAt(0)}, hex: ${c.charCodeAt(0).toString(16)})`);
  }
});

// Check for bad characters
const badChars = chars.filter((c, i) => {
  const code = c.charCodeAt(0);
  return code === 0xFFFD || (code >= 0xDC80 && code <= 0xDCFF);
});

console.log('\nBad characters found:', badChars.length);
if (badChars.length > 0) {
  console.log('Bad chars:', badChars.map(c => `U+${c.charCodeAt(0).toString(16)}`));
}
