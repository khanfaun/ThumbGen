import fs from 'fs';
const text = fs.readFileSync('output.html', 'utf8');
const index = text.indexOf('<title>Image</title>');
if (index !== -1) {
    console.log(text.substring(index - 200, index + 200));
}
