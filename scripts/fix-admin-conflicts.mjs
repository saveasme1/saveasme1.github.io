import fs from "fs";

const files = {
  "admin/index.html": ["헤리티지 통합 관리자", "/admin/admin.css?v=20260722-eye1"],
  "admin/notices/index.html": ["헤리티지 공지사항 관리자", "/admin/admin.css?v=20260722-eye1"],
  "admin/portfolio/index.html": ["헤리티지 포트폴리오 관리자", "/admin/admin.css?v=20260722-eye1"],
  "admin/reviews/index.html": ["헤리티지 고객후기 관리자", "/admin/admin.css?v=20260722-eye1"],
  "admin/shipping/index.html": ["헤리티지 실시간 출고관리", "/admin/admin.css?v=20260722-eye1"],
};

for (const [file, [title, css]] of Object.entries(files)) {
  let text = fs.readFileSync(file, "utf8");
  text = text.replace(
    /<<<<<<< HEAD\r?\n[\s\S]*?>>>>>>>\s[^\n]+\r?\n/,
    `  <title>${title}</title>\n  <link rel="stylesheet" href="${css}">\n`
  );
  if (text.includes("<<<<<<<")) throw new Error("still conflict in " + file);
  fs.writeFileSync(file, text);
  console.log("fixed", file);
}
