import fs from 'fs';
const text = fs.readFileSync('output.html', 'utf8');
const index = text.indexOf('LS_JBL_Live_680_NC_Product_Image_Hero_sand.png');
console.log(text.substring(index - 50, index + 50));
