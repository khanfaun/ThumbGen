import fs from 'fs';
const text = fs.readFileSync('output_drive.html', 'utf8');

// The pattern: ID, [PARENT_ID], NAME, MIME_TYPE
const hexRegex = /\\x22([a-zA-Z0-9_-]{25,})\\x22,\\x5b(?:\\x22([a-zA-Z0-9_-]{25,})\\x22)?\\x5d,\\x22([^\\]+?)\\x22,\\x22([^\\]+?)\\x22/g;

let count = 0;
let match;
while ((match = hexRegex.exec(text)) !== null) {
    if (!match[4].includes('image/')) {
        console.log("ID:", match[1], "Name:", match[3], "Mime:", match[4]);
    }
    count++;
    if (count > 10) break;
}

const standardRegex = /\["([a-zA-Z0-9_-]{25,})","([^"]+)","([^"]+)"/g;
count = 0;
while ((match = standardRegex.exec(text)) !== null) {
    if (!match[3].includes('image/')) {
        console.log("ID:", match[1], "Name:", match[2], "Mime:", match[3]);
    }
    count++;
    if (count > 10) break;
}
