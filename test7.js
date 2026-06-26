import fs from 'fs';
const text = fs.readFileSync('output.html', 'utf8');

// Regex to match the encoded format: \x22FILE_ID\x22,\x5b\x22FOLDER_ID\x22\x5d,\x22FILE_NAME\x22
const regex = /\\x22([a-zA-Z0-9_-]{25,})\\x22,\\x5b\\x22([a-zA-Z0-9_-]{25,})\\x22\\x5d,\\x22([^\\]+\.(?:png|PNG|jpg|jpeg|webp))\\x22/g;

let match;
const files = [];
while ((match = regex.exec(text)) !== null) {
    const fileId = match[1];
    const folderId = match[2];
    const fileName = match[3];
    files.push({ id: fileId, name: fileName });
}

// Also try to find DOM nodes if that's more robust
const domRegex = /data-id="([a-zA-Z0-9_-]{25,})"[^>]*data-tooltip="([^"]+\.(?:png|PNG|jpg|jpeg|webp)) Image"/g;
while ((match = domRegex.exec(text)) !== null) {
   // files.push({ id: match[1], name: match[2], source: 'DOM' });
}

console.log(files);
