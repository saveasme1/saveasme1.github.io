import fs from "fs";
const path = "landing.html";
let t = fs.readFileSync(path, "utf8");
t = t.replace(/20260722-mp\d+/g, "20260722-mp20");
fs.writeFileSync(path, t, "utf8");
console.log([...new Set(t.match(/20260722-mp\d+/g) || [])]);
