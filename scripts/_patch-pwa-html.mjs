import fs from "fs";

const PWA_HEAD = [
  '  <meta name="theme-color" content="#161513">',
  '  <meta name="apple-mobile-web-app-capable" content="yes">',
  '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '  <meta name="apple-mobile-web-app-title" content="헤리티지">',
  '  <meta name="mobile-web-app-capable" content="yes">',
  '  <link rel="manifest" href="manifest.webmanifest">',
  '  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
  '  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">',
  '  <link rel="icon" type="image/png" sizes="512x512" href="icons/icon-512.png">',
].join("\n");

const UNREGISTER_RE =
  /\s*<script>\s*\(function \(\) \{[\s\S]*?navigator\.serviceWorker\.getRegistrations[\s\S]*?<\/script>\s*/;

function patchHtml(file, { title } = {}) {
  let t = fs.readFileSync(file, "utf8");
  t = t.replace(UNREGISTER_RE, "\n");
  if (title) t = t.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  if (!t.includes("manifest.webmanifest")) {
    t = t.replace(/<title>[^<]*<\/title>/, (m) => `${m}\n${PWA_HEAD}`);
  }
  if (!t.includes("pwa-register.js")) {
    if (t.includes("</body>")) {
      t = t.replace("</body>", '  <script src="pwa-register.js"></script>\n</body>');
    } else {
      t += '\n<script src="pwa-register.js"></script>\n';
    }
  }
  fs.writeFileSync(file, t);
  console.log("patched", file);
}

patchHtml("landing.html", { title: "헤리티지" });
patchHtml("mypage.html", { title: "헤리티지 · 마이페이지" });
patchHtml("portfolio.html", { title: "헤리티지 · 포트폴리오" });

let index = fs.readFileSync("index.html", "utf8");
index = index.replace(/<title>[^<]*<\/title>/, `<title>헤리티지</title>\n${PWA_HEAD}`);
index = index.replace('var path = "/main-content.html";', 'var path = "./landing.html";');
index = index.replace('location.href = "/main-content.html";', 'location.href = "./landing.html";');
if (!index.includes("pwa-register.js")) {
  index = index.replace("</body>", '  <script src="pwa-register.js"></script>\n</body>');
}
fs.writeFileSync("index.html", index);
console.log("patched index.html");

let main = fs.readFileSync("main-content.html", "utf8");
main = main.replace(UNREGISTER_RE, "\n");
// also remove later unregister block if present
main = main.replace(
  /const regs = await navigator\.serviceWorker\.getRegistrations\(\);[\s\S]*?await Promise\.all\(regs\.map\(reg => reg\.unregister\(\)\)\);/g,
  "/* pwa: keep service worker */"
);
fs.writeFileSync("main-content.html", main);
console.log("patched main-content.html");
