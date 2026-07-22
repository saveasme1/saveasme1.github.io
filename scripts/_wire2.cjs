const fs = require("fs");
const read = (f) => fs.readFileSync(f, "utf8");
const write = (f, t) => fs.writeFileSync(f, t);
function insertAfter(file, anchor, insert) {
  let s = read(file);
  if (s.includes("setupContentClamp")) {
    console.log(file, "already");
    return;
  }
  const i = s.indexOf(anchor);
  if (i < 0) {
    console.log(file, "missing", JSON.stringify(anchor));
    return;
  }
  write(file, s.slice(0, i + anchor.length) + insert + s.slice(i + anchor.length));
  console.log(file, "wired");
}
const nl = "\r\n";
insertAfter(
  "landing-boards.js",
  'dialog.content.textContent = item.content || "";' + nl + "    }",
  nl + "    window.GongbangBoardMeta?.setupContentClamp?.(dialog.content);"
);
insertAfter(
  "portfolio-board.js",
  "els.content.textContent = safeContent;" + nl + "    }",
  nl + "    window.GongbangBoardMeta?.setupContentClamp?.(els.content);"
);
insertAfter(
  "handmade-reviews.js",
  "els.viewText.textContent = review.body;" + nl + "      }",
  nl + "      window.GongbangBoardMeta?.setupContentClamp?.(els.viewText);"
);