# Deploy hand-made.kr offline pages. Usage: .\deploy-offline.ps1
# Edits content files then git push. Loaders always fetch with ?t=Date.now() so CDN cache is bypassed.
Set-Location $PSScriptRoot
git add index.html landing.html admin/index.html shutdown-content.html main-closed-content.html
git status --short
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "chore: update offline notice content"
git push origin main
Write-Host "pushed. Content updates show immediately via cache-bust fetch (no deploy wait needed for content)."