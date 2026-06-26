import fs from 'fs';
async function test() {
  const url = 'https://drive.google.com/drive/folders/1SYJivXYC1ADYzx-jddhOVRQ9ARCTE5EY';
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    }
  });
  const text = await res.text();
  fs.writeFileSync('output.html', text);
}
test();
