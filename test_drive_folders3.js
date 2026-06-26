import fs from 'fs';

const text = fs.readFileSync('output_drive.html', 'utf8');

const re = /vnd\.google-apps\.folder/g;
let match;
while ((match = re.exec(text)) !== null) {
    console.log(text.substring(match.index - 100, match.index + 100));
}
