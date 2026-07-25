# 최종 상태 (tryon44)

작성일: 2026-07-26 · 캐시 버스트: `20260726-tryon44`

## 구현된 것 (코드·테스트로 확인)

- 4모드 추적·앵커·피팅·Three.js 라이브 루프 (`src/studio.js` `alignTick`)
- AssetResolver 생산 안전 분기 (`src/services/ar/AssetResolver.js`)
- JewelryARRenderer에 TorusGeometry 없음 (`npm test` 확인)
- 고해상도 저장 분기 (`composeHighResTryOn` / `HighResCompose.js`)
- 고객 가이드: 추적 타원/링/목선/귀 마커 + 메시지 1개
- 디버그 격리 `?arDebug=1`
- 내부 QA: `qa.html?arQa=1`
- 스모크 테스트 22개 PASS
- 자산 검증 ALL OK (fallback webp WARN만 · 생산 차단 아님)
- 합성 fixture로 `analyze_debug_report.py` 파서 동작 확인 (**실기기 성능 아님**)

## 자동 테스트

```
npm test
→ 22 pass / 0 fail
```

## 빌드

정적 ES 모듈 사이트. `package.json`에 번들 `build`/`lint`/`typecheck` 스크립트 없음.  
대체 검증: `npm run check:syntax` PASS.

## 배포

명령: `python _deploy44.py`  
결과: `LIVE OK` (2026-07-26)  
확인 URL:
- https://hand-made.kr/heritage-tryon/studio.html → `tryon44` 포함
- https://hand-made.kr/heritage-tryon/qa.html → `arQa` 게이트
- https://hand-made.kr/tryon-overlay.js → `TRYON_BUST = "20260726-tryon44"`

## 외부 입력이 있어야 검증 가능한 항목

실 SKU CAD와 실기기 디버그 JSON이 있을 때만: 상용 시각 품질, 실기기 FPS, 실측 투영 오차, production_glb 형태 보존 최종 합격.

## 유료 SDK 판단

- 당분간 MediaPipe + Three.js 경로 유지 (실 SKU·실기기 수치 확보 전 권장)
- 실측 품질 미달 시에만 Perfect Corp를 첫 상용 POC 후보
- Banuba/DeepAR는 얼굴·귀 오클루전 보조 후보
- ARKit/ARCore/Unity는 웹 깊이·기기 한계가 수치로 증명될 때만 검토

관련: `ARCHITECTURE_KO.md`, `ASSET_PIPELINE_KO.md`, `QA_GUIDE_KO.md`  
구문서: `AR-AUDIT.md`, `QUALITY_PHASE_KO.md` → 본 문서·아키텍처로 이관
