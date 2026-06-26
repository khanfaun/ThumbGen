import fs from 'fs';

async function fetchDrive(folderId) {
  const url = `https://drive.google.com/drive/folders/${folderId}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    }
  });
  const text = await res.text();
  fs.writeFileSync('output_drive.html', text);
  console.log("Status:", res.status);
  
  const hexEncodedRegex = /\\x22([a-zA-Z0-9_-]{25,})\\x22,\\x5b\\x22([a-zA-Z0-9_-]{25,})\\x22\\x5d,\\x22([^\\]+?)\\x22/gi;
  let match;
  let count = 0;
  while ((match = hexEncodedRegex.exec(text)) !== null) {
      console.log("Hex Match:", match[1], match[2], match[3]);
      count++;
      if (count > 20) break;
  }
}
fetchDrive('1SYJivXYC1ADYzx-jddhOVRQ9ARCTE5EY');
