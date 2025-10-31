const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
const line1399 = lines[1398];

console.log('Full line:', JSON.stringify(line1399));

// Find all quote characters
const quotes = [];
[...line1399].forEach((c, i) => {
  const code = c.charCodeAt(0);
  if (code === 34 || code === 8220 || code === 8221 || code === 39 || code === 8216 || code === 8217) {
    quotes.push({ pos: i, char: c, code: code, hex: code.toString(16), type: getQuoteType(code) });
  }
});

function getQuoteType(code) {
  switch(code) {
    case 34: return 'ASCII double quote (")';
    case 8220: return 'Left double quote (")';
    case 8221: return 'Right double quote (")';
    case 39: return "ASCII single quote (')";
    case 8216: return "Left single quote (')";
    case 8217: return "Right single quote (')";
    default: return 'Unknown';
  }
}

console.log('\nQuotes found:', quotes.length);
quotes.forEach(q => {
  console.log(`Position ${q.pos}: '${q.char}' (U+${q.hex}) - ${q.type}`);
});
