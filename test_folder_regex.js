const str = '["1SYJivXYC1ADYzx-jddhOVRQ9ARCTE5EY",null,"Beige","application/vnd.google-apps.folder"';
const folderRegex1 = /\["([a-zA-Z0-9_-]{25,})","([^"]+)","application\/vnd\.google-apps\.folder"/gi;
const folderRegex1_alt = /\["([a-zA-Z0-9_-]{25,})",(?:null|"[^"]+"),"([^"]+)","application\/vnd\.google-apps\.folder"/gi;

console.log("Original:", folderRegex1.exec(str));
console.log("Alt:", folderRegex1_alt.exec(str));
