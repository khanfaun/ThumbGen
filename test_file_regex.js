import fs from 'fs';
const text = fs.readFileSync('output_drive.html', 'utf8');
const fileRegex = /\["([a-zA-Z0-9_-]{25,})",(?:null|"[^"]+"),"([^"]+\.(?:[a-zA-Z0-9]+))",/gi;
let match;
while ((match = fileRegex.exec(text)) !== null) {
    console.log("File:", match[1], match[2]);
}
