# 아키텍처 (한국어) — StyleAR 동형

**헌장:** `LONGTERM_STYLEAR_KO.md` (장기 프로젝트 우선순위 원본)

웹 조사 기준 StyleAR/Deepixel 축: 단일 RGB · 부위 특화 비전(Face·Ears / Hand·Fingers·Wrist) · 웹 SaaS 셀카+앨범 피팅 · 광택 렌더.  
Heritage는 **사진/합성(Compose-first)** 을 StyleAR SaaS와 같은 본진으로 둔다. 라이브는 가이드 전용.

## 본진 파이프라인

```
촬영|업로드 → (합성 직전) 부위 재추정 → 정렬 → 오클루전·재질 합성 → 고해상도 스틸
```

진입: `runStyleArCompose` (`StyleArComposePipeline.js` v1.3 Phase1–3 + Phase4 live polish) ← `studio.js` `runMergeTryOn`  
흐름: 스틸 우선 재검출 → 부위 특화 → (2.5D) 카탈로그 재질 → 고해상도 합성 → 오클루전 → 하모나이즈

## 네 모드 (StyleAR 부위 매핑)

| 모드 | StyleAR 축 | 추적 | 앵커 | 피팅 | 렌더/합성 |
|------|------------|------|------|------|-----------|
| bracelet | Hand·Wrist | Hand (+ Pose) | `WristAnchorEstimator` | `fitBracelet` | GLB 또는 2.5D |
| ring | Hand·Fingers | Hand | `FingerAnchorEstimator` | `fitRing` | 동일 |
| necklace | Neck (+ Face) | Pose + Face | `NeckAnchorEstimator` | `fitNecklaceWithChain` | 동일 + 체인 |
| earring | Face·Ears | Face | `EarAnchorEstimator` | `fitEarring` + physics | 동일 |

가이드 루프(보조): `alignTick` → `evaluateAlignment` → `GuideOverlay` → (선택) 라이브 Three 미리보기

## 자산 분기

`AssetResolver` — `production_glb` / `validation_glb` / `fallback_2_5d` / `unavailable`  
검증·대표 자산은 디버그 플래그 없이 생산 SKU에 진입 불가.

## 라이프사이클

- 카메라: 목걸이·귀걸이 = 전면(`user` exact 우선), 반지·팔찌 = 후면
- `closeCameraSheet` / `dispose` / `webglcontextlost` 유지

## 단계

Phase 0 전환 고정 → Phase 1 스틸 재추정·마스크·하모나이즈 → Phase 2 부위 특화 → Phase 3 카탈로그·광택 → Phase 4 선택 라이브 → Phase 5 조건부 상용 POC
