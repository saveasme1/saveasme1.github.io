# 본 헤리티지 PWA 운영 메모

최종 갱신: 2026-08-10 · 배포 트랙 `gbcal53`

## 한 줄 요약

- **공개 사이트 코드**: `F:/공방171포폴프로젝트/_pwa_push` → GitHub Pages (`saveasme1/saveasme1.github.io`)
- **관리자 API / 이미지 저장**: MakerBridge Contabo (`https://app.0-1.co.kr`)
- **고객용 업데이트 알림**: `app-build.json`의 `build`가 바뀔 때만 (중간 디버그 커밋마다 띄우지 않음)

---

## hand-made.jp 는 뭐하는 사이트인가

`hand-made.jp`는 **본 헤리티지 공개 PWA의 브랜드 도메인**이다.  
기능상 `https://saveasme1.github.io` 와 같은 사이트(최종검수·후기·공지·설치 등)를 쓰려고 `_pwa_push/CNAME`에 `hand-made.jp`가 들어 있다.

| 주소 | 역할 |
|------|------|
| `https://saveasme1.github.io` | 실제 GitHub Pages 원본 (정상) |
| `https://hand-made.jp` | 같은 사이트의 브랜드 도메인 (DNS가 Pages를 가리켜야 함) |
| `https://app.0-1.co.kr` | MakerBridge API + 업로드 파일 서버 |

**현재(2026-08-10) 이슈**: `hand-made.jp` DNS가 GitHub Pages가 아니라 일본 nginx(`202.210.8.86`)로 잡혀 `/shipping.html` 등이 404다.  
DNS를 GitHub Pages로 고치기 전까지는 **`saveasme1.github.io`로 확인·운영**한다.

---

## 최종검수(shipping) 글 / 이미지

### 원칙

- **이미지 바이너리는 Git에 넣지 않는다.** (commit/push가 느리고 Pages/DNS 깨지면 “이미지 준비 중”만 보임)
- **이미지는 Contabo 디스크**에 저장한다.
  - 경로: `/var/www/makerbridge/public/uploads/handmade-shipping/{postId}/...`
  - URL: `https://app.0-1.co.kr/uploads/handmade-shipping/...`
- **목록 메타**는 Contabo `PUT /api/handmade/v1/admin/shipping/publish` → `GET /api/handmade/v1/shipping/live`
- 프론트: `_pwa_push/landing-boards.js` (작성), `_pwa_push/shipping-board.js` (목록)

### 배포 시 주의 (MakerBridge)

- `routes/handmade.js` / `middleware/handmadeSecurity.js` 변경은 Contabo에 SCP + `pm2 restart makerbridge`
- `remote_deploy.py`의 `git reset --hard`는 handmade 핫픽스를 덮어쓸 수 있으니, 운영 반영 후 develop에 커밋해 두는 것이 안전하다.

---

## PWA 버전 / 고객 업데이트 정책

### 숫자 버전이 왜 안 올라가나

고객에게 “새 버전”으로 잡히는 값은 **`_pwa_push/app-build.json`의 `build`** 이다.  
HTML/`pwa-register.js`의 `?v=gbcalNN`만 올리고 `app-build.json`을 안 고치면:

- 캐시 버스팅은 일부만 되고
- 고객 업데이트 다이얼로그의 최신 `build`와 안 맞음

`APP_VERSION`(예: `v1.12.39`)은 다이얼로그에 보이는 **표시용 버전**이다. 릴리스할 때 같이 올린다.

### 언제 고객이 업데이트를 받나

1. 개발/디버그 중 여러 번 push해도 **고객 알림은 `app-build.json`이 바뀐 배포에만** 뜬다.
2. 앱은 실행 시(및 포그라운드 복귀 시) `app-build.json`을 한 번 확인한다.
3. **같은 build에 대해 다이얼로그는 한 번**만 띄운다. “나중에”면 칩만 남기고, 5분마다 다시 강제하지 않는다.
4. 고객이 「업데이트」를 눌러야 캐시 정리 + reload (조용한 강제 리로드 없음).

### 릴리스 절차 (권장)

```bash
cd F:/공방171포폴프로젝트/_pwa_push
node scripts/bump-all-pwa-build.mjs 20260810-gbcal53 20260810-gbcal52
# (스크립트가 HTML / pwa-register / sw / app-build.json / manifest 동기화)
# pwa-register.js 의 APP_VERSION · RELEASE_NOTES 확인 후
git add -A
git commit -m "Release gbcal53: …"
git push origin main
```

디버그용으로 HTML `?v=`만 바꿔야 할 때는 **`app-build.json`을 건드리지 않는다.**  
고객 알림 없이 캐시만 깨고 싶을 때 이 규칙을 지킨다.

---

## 관련 경로 빠른 참조

| 항목 | 경로 |
|------|------|
| PWA 소스 | `F:/공방171포폴프로젝트/_pwa_push` |
| 빌드 메타 | `_pwa_push/app-build.json` |
| 범프 스크립트 | `_pwa_push/scripts/bump-all-pwa-build.mjs` |
| SW | `_pwa_push/sw.js` |
| 등록/업데이트 UI | `_pwa_push/pwa-register.js` |
| shipping API | `F:/#1_zeron_web_develop/makerbridge/routes/handmade.js` |
