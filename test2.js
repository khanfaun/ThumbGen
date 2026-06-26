import fs from 'fs';
const text = fs.readFileSync('output.html', 'utf8');
const regex = /\["([a-zA-Z0-9_-]{25,})","([^"]+)"/g;
let fileMatch;
let count = 0;
while ((fileMatch = regex.exec(text)) !== null) {
    console.log("File:", fileMatch[1], fileMatch[2]);
    count++;
    if (count > 20) break;
}
