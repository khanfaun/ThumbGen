import fs from 'fs';
const text = fs.readFileSync('output.html', 'utf8');
let idx = text.indexOf('LS_JBL_Live_680_NC_Product_Image_Hero_sand.png');
while(idx !== -1) {
    console.log("----MATCH----");
    console.log(text.substring(idx - 100, idx + 100));
    idx = text.indexOf('LS_JBL_Live_680_NC_Product_Image_Hero_sand.png', idx + 1);
}
