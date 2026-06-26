import fs from 'fs';
const text = fs.readFileSync('output_drive.html', 'utf8');

const regex = /\\x22([a-zA-Z0-9_-]{25,})\\x22,\\x5b\\x22(?:[a-zA-Z0-9_-]{25,})?\\x22\\x5d,\\x22([^\\]+?)\\x22/gi;
let match;
let count = 0;
while ((match = regex.exec(text)) !== null) {
  console.log(match[1], match[2]);
  count++;
  if (count > 30) break;
}
