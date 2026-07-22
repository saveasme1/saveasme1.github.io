import fs from "fs";

const path = "landing-boards.js";
let t = fs.readFileSync(path, "utf8");

t = t.replace(
  `function renderList(type) {
    const board = boards[type];
    const query = board.search.value.trim().toLowerCase();`,
  `function renderList(type) {
    const board = boards[type];
    if (!board?.list || !board.search || !board.status) return;
    const query = board.search.value.trim().toLowerCase();`
);

t = t.replace(
  `async function loadBoard(type) {
    const board = boards[type];
    board.status.textContent = "불러오는 중…";`,
  `async function loadBoard(type) {
    const board = boards[type];
    if (!board?.list || !board.status) return;
    board.status.textContent = "불러오는 중…";`
);

t = t.replace(
  `if (boards[type]) renderList(type);
  }`,
  `if (boards[type]?.list) renderList(type);
  }`
);

// published payload should keep categories for shipping
t = t.replace(
  `const published = {
        version: 1,
        publishedAt: now,
        items: [item, ...baseItems.filter((entry) => entry.id !== id)],
      };`,
  `const published = {
        version: 1,
        publishedAt: now,
        categories: type === "shipping"
          ? (publishedFile?.value?.categories || ["C","B","VCA","BO","CM","C&H","CL","G","H","P","F","ETC"])
          : undefined,
        items: [item, ...baseItems.filter((entry) => entry.id !== id)],
      };`
);

fs.writeFileSync(path, t, "utf8");
try {
  new Function(t);
  console.log("landing-boards.js OK");
} catch (e) {
  console.error("FAIL", e.message);
  process.exit(1);
}
