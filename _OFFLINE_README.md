# hand-made.kr 임시 전체 폐쇄 (삭제 아님 · 복구 가능)

원본은 삭제하지 않았고 `_offline_backup/` 에만 보관합니다.
라이브 HTML은 빈 페이지로 교체해 아무것도 안 보이게 했습니다.

## 현재 빈 페이지인 주소
- https://hand-made.kr/
- https://hand-made.kr/landing.html
- https://hand-made.kr/notices.html
- https://hand-made.kr/shipping.html
- https://hand-made.kr/admin/
- https://hand-made.kr/gb171-admin.html

## 복구 방법
```powershell
Copy-Item _offline_backup\index.html .\index.html -Force
Copy-Item _offline_backup\landing.html .\landing.html -Force
Copy-Item _offline_backup\notices.html .\notices.html -Force
Copy-Item _offline_backup\shipping.html .\shipping.html -Force
Copy-Item _offline_backup\gb171-admin.html .\gb171-admin.html -Force
Remove-Item .\admin -Recurse -Force
Copy-Item _offline_backup\admin .\admin -Recurse -Force
git add -A
git add -f admin/reviews
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "restore: reopen hand-made.kr pages after temporary blank offline"
git push origin main
```
## 캐시 무력화
- index.html / landing.html / dmin/index.html 는 로더만 둠
- 실제 내용은 main-closed-content.html / shutdown-content.html
- 방문마다 ?t=Date.now() + cache:no-store 로 내용을 다시 받음 → CDN 10분 캐시 우회
- 문구/로고 수정은 content 파일만 고치고 push 하면 됨