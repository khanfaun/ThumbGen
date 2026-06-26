import fs from 'fs';

const text = fs.readFileSync('output_drive.html', 'utf8');

const regex = /\\x22([a-zA-Z0-9_-]{25,})\\x22,\\x5b\\x22([a-zA-Z0-9_-]{25,})\\x22\\x5d,\\x22([^\\]+?)\\x22/gi;
let match;
let count = 0;
while ((match = regex.exec(text)) !== null) {
  const id = match[1];
  const parentId = match[2];
  const name = match[3];
  
  if (!name.match(/\.(png|jpg|jpeg|webp|tif|tiff)$/i)) {
      console.log("Possibly folder or other file:", id, parentId, name);
      count++;
      if (count > 20) break;
  }
}
