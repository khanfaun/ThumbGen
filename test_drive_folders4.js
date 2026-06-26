import fs from 'fs';
const text = fs.readFileSync('output_drive.html', 'utf8');
const hexRegex = /\\x22([a-zA-Z0-9_-]{25,})\\x22,\\x5b\\x22([a-zA-Z0-9_-]{25,})\\x22\\x5d,\\x22([^\\]+?)\\x22.*?application\/vnd\.google-apps\.folder/gi;
const standardRegex = /\["([a-zA-Z0-9_-]{25,})","([^"]+)","application\/vnd\.google-apps\.folder"/gi;
console.log("Hex:");
let match;
while ((match = hexRegex.exec(text)) !== null) { console.log(match[1], match[2], match[3]); }
console.log("Standard:");
while ((match = standardRegex.exec(text)) !== null) { console.log(match[1], match[2]); }
