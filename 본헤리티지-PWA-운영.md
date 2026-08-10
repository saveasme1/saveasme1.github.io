# 본 헤리티지 PWA 운영 메모

최종 갱신: 2026-08-10 · 배포 트랙 `gbcal59`

## 한 줄 요약

- **공개 사이트 코드**: `F:/공방171포폴프로젝트/_pwa_push` → GitHub Pages (`saveasme1/saveasme1.github.io`) · `main` push
- **관리자 API / 이미지 저장**: MakerBridge Contabo (`https://app.0-1.co.kr`)
- **MakerBridge 배포 정본**: `develop` 작업일지 커밋 → `main` fast-forward → `python scripts/remote_deploy.py` (`git reset --hard origin/main`)
- **고객용 업데이트 알림**: `app-build.json`의 `build`가 바뀔 때만 (중간 디버그 커밋마다 띄우지 않음)

---

## Git / Cloud 꼬임 방지 (검수 2026-08-10)

| 저장소 | remote | 정본 브랜치 | 비고 |
|--------|--------|-------------|------|
| MakerBridge | `saveasme1/makerbridge` | `develop`→`main` FF | Contabo는 `origin/main`만 reset |
| PWA | `saveasme1/saveasme1.github.io` | `main` | `공방171포폴프로젝트` 루트는 git 아님 · `_pwa_push`만 |
| Cursor Cloud 브랜치 | `origin/cursor/cloud-agent-*` | **머지 금지(자동)** | develop과 조상 관계 아님 · 필요할 때만 cherry-pick |
| Cursor phone | Contabo pm2 `cursorphone-*` | 별도 앱 | MakerBridge/PWA git과 공유 커밋 없음 |

### Cloud 동기화 정책 (권장)

1. **주기적 동기화 하지 말 것** (cron / 자동 merge / cloud 브랜치 → develop 자동 반영 금지).
2. **클라우드를 쓸 때만** 사용자가 “가져와”라고 할 때 cherry-pick 또는 파일 단위 복구.
3. Contabo workspace의 `makerbridge` symlink는 **라이브 트리**다. 클라우드에서만 만든 커밋을 develop에 안 올린 채 `remote_deploy`하면 라우트가 사라진다.
4. 집 PC dirty 트리(Cafe24 편집기 등)와 handmade 배포를 **한 커밋에 섞지 말 것**.

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

## 게시판 글 / 이미지 (shipping · portfolio · notices · groupbuy)

### 원칙

- **이미지 바이너리는 Git에 넣지 않는다.** (commit/push가 느리고 Pages/DNS 깨지면 “이미지 준비 중”만 보임)
- **이미지는 Contabo 디스크**에 저장한다.
  - shipping: `/var/www/makerbridge/public/uploads/handmade-shipping/{postId}/...`
  - 그 외: `/var/www/makerbridge/public/uploads/handmade-boards/{board}/{postId}/...`
  - URL: `https://app.0-1.co.kr/uploads/...`
- **목록 메타(live)** 는 Contabo API
  - `GET /api/handmade/v1/boards/:board/live`
  - `PUT /api/handmade/v1/admin/boards/:board/publish`
  - `DELETE /api/handmade/v1/admin/boards/:board/:id`
  - shipping 호환 alias: `/shipping/live`, `/admin/shipping/publish`, `/admin/shipping/:id`
- 프론트: `_pwa_push/landing-boards.js`, `portfolio-board.js`, `groupbuy-calendar.js`, `shipping-board.js`

### 배포 (MakerBridge — 필수 순서)

1. `docs/AGENT-2-MAKERBRIDGE.md`에 **작업일지** 기록
2. `develop`에 관련 파일만 커밋 · `git push origin develop`
3. `git checkout main && git merge --ff-only develop && git push origin main`
4. `python scripts/remote_deploy.py` → 서버 `git fetch` + **`git reset --hard origin/main`** + `pm2 restart`
5. **금지:** SCP만 하고 develop 미반영 · discover/like 없는 트리로 reset · `remote_deploy` 전에 main 미푸시

discover/like 라우트는 develop에 반드시 포함되어야 한다. Contabo에 board 핫픽스만 올리면 discover가 404로 회귀한다.

---

## PWA 버전 / 고객 업데이트 정책

### 숫자 버전이 왜 안 올라가나

고객에게 “새 버전”으로 잡히는 값은 **`_pwa_push/app-build.json`의 `build`** 이다.  
HTML/`pwa-register.js`의 `?v=gbcalNN`만 올리고 `app-build.json`을 안 고치면:

- 캐시 버스팅은 일부만 되고
- 고객 업데이트 다이얼로그와 최신 `build`와 안 맞음

`APP_VERSION`(예: `v1.12.43`)은 다이얼로그에 보이는 **표시용 버전**이다. 릴리스할 때 같이 올린다.

### 언제 고객이 업데이트를 받나

1. 개발/디버그 중 여러 번 push해도 **고객 알림은 `app-build.json`이 바뀐 배포에만** 뜬다.
2. 앱은 실행 시(및 포그라운드 복귀 시) `app-build.json`을 한 번 확인한다.
3. **같은 build에 대해 다이얼로그는 한 번**만 띄운다. “나중에”면 칩만 남기고, 5분마다 다시 강제하지 않는다.
4. 고객이 「업데이트」를 눌러야 캐시 정리 + reload (조용한 강제 리로드 없음).


### 고객 업데이트 문구 (`app-build.json` → `notes`)

- **`notes`는 고객이 보는 문구만.** 예: `버그 수정 및 안정성 개선`
- 운영/개발 상세(최종검수 Contabo, Git, 배포 정책 등)는 **`note`(단수, 내부용)** 또는 이 문서에만 적는다.
- 고객에게 내부 작업 로그를 그대로 노출하지 않는다.

### 릴리스 절차 (권장)

```bash
cd F:/공방171포폴프로젝트/_pwa_push
node scripts/bump-all-pwa-build.mjs 20260810-gbcal58 20260810-gbcal57
# (스크립트가 HTML / pwa-register / sw / app-build.json / manifest 동기화)
# pwa-register.js 의 APP_VERSION · RELEASE_NOTES 확인 후
git add -A   # 릴리스 관련만
git commit -m "Release gbcal58: …"
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
| Contabo 배포 | `makerbridge/scripts/remote_deploy.py` |
