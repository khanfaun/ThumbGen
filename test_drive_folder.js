import fs from 'fs';

const text = fs.readFileSync('output_drive.html', 'utf8');
const folderId = '1SYJivXYC1ADYzx-jddhOVRQ9ARCTE5EY';

let idx = text.indexOf(folderId);
while (idx !== -1) {
  // console.log("Context:", text.substring(idx - 100, idx + 100));
  idx = text.indexOf(folderId, idx + 1);
}
