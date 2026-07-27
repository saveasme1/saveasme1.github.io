# 프로젝트 상태 — StyleAR Phase 1

작성일: 2026-07-27  
헌장: `LONGTERM_STYLEAR_KO.md`

## Phase 1 구현

- 스틸 우선 타깃: `StillRedetect.js` `resolveComposeTarget`
- 합성 진입: `runStyleArCompose` → high-res → 오클루전 → 하모나이즈
- 업로드/촬영 동일 경로: `bodySource` + 동일 `detectBody` → `runStyleArCompose`
- 파이프 버전: `1.1.0-phase1`

## 다음 Phase 2

귀·손가락·손목 특화(가림·측면·관절)

## 테스트

`npm test` — Phase 1 still-resolve 포함
