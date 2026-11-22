const fs = require('fs'), zlib = require('zlib');
const buf = fs.readFileSync(process.env.TEMP + '/invoice-test.pdf');
const raw = buf.toString('latin1');
console.log('has_UTF8_rupee_bytes:', buf.includes(Buffer.from('\u20B9', 'utf8')));
console.log('font_names:', [...new Set(raw.match(/\/BaseFont\s*\/[A-Za-z-]+/g) || [])].join(' '));
console.log('encodings:', [...new Set(raw.match(/\/Encoding\s*\/[A-Za-z0-9-]+/g) || [])].join(' '));
let texts = [];
const re = /stream\r?\n/g; let m;
while ((m = re.exec(raw))) {
  const start = m.index + m[0].length; const end = raw.indexOf('endstream', start);
  try { const s = zlib.inflateSync(buf.subarray(start, end)).toString('latin1');
    for (const t of s.match(/\((?:\\.|[^\\)])*\)\s*Tj/g) || []) texts.push(t);
    for (const t of s.match(/\[(?:[^\]])*\]\s*TJ/g) || []) texts.push(t);
  } catch (e) {}
}
console.log('drawn_text_ops:', texts.length);
console.log(texts.slice(0, 40).join('\n'));
