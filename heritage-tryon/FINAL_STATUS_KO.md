# 프로젝트 상태 — StyleAR Phase 1–4 완료 (코드)

작성일: 2026-07-27  
헌장: `LONGTERM_STYLEAR_KO.md`  
파이프: `1.3.0-phase3` (+ Phase4 live polish)

## 완료 단계

| Phase | 내용 | 코드 |
|-------|------|------|
| 0 | Compose-first 전환 | `StyleArComposePipeline.js` |
| 1 | 스틸 재검출·오클루전·하모나이즈·업로드=셀카 | `StillRedetect` `PartOcclusionMask` `ComposeHarmonize` |
| 2 | 귀·손가락·손목·목 특화 | `PartSpecialists.js` + 앵커 연결 |
| 3 | SKU 메타·재질 2.5D 틴트 | `CatalogMaterial.js` |
| 4 | 라이브 가이드 스무딩·프리뷰 투명도 | `LivePreviewPolish.js` |
| 5 | 조건부 SDK POC만 (미구매) | 헌장 §5 — 실측 미달 시 |

## 테스트

`npm test` — Phase1~3 스모크 포함

## 유료 SDK

기본 경로 = 자체 StyleAR 동형 파이프.  
Phase1~3 실기기 리포트가 동급 미달일 때만 Perfect Corp 등 POC.
