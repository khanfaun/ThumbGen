import fs from 'fs';

const text = fs.readFileSync('output_drive.html', 'utf8');

// The folder we are querying is 1SYJivXYC1ADYzx-jddhOVRQ9ARCTE5EY
// Let's search for its occurrences and see what it links to.
const folderId = '1SYJivXYC1ADYzx-jddhOVRQ9ARCTE5EY';
const re = new RegExp(`.{0,50}${folderId}.{0,50}`, 'g');
let match;
let i = 0;
while ((match = re.exec(text)) !== null && i < 10) {
    console.log(match[0]);
    i++;
}

