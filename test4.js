import fs from 'fs';
const text = fs.readFileSync('output.html', 'utf8');
const match = text.match(/[A-Za-z0-9_ -]+\.(png|jpg|jpeg|webp)/gi);
console.log([...new Set(match)]);
