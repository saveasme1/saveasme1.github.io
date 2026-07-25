# 아키텍처 (한국어)

## 네 모드 런타임

| 모드 | 추적 | 앵커 | 피팅 | 렌더 |
|------|------|------|------|------|
| bracelet | Hand (+ Pose wrist fallback) | `WristAnchorEstimator.estimateWristAnchor3D` | `fitBracelet` | `JewelryARRenderer` |
| ring | Hand | `FingerAnchorEstimator.estimateFingerAnchor3D` | `fitRing` | 동일 |
| necklace | Pose (+ Face 보조, `align.js`) | `NeckAnchorEstimator.estimateNeckAnchor3D` | `fitNecklaceWithChain` (`NecklaceFitter3D` 기반) | 동일 + 체인 Tube |
| earring | Face | `EarAnchorEstimator.estimateEarAnchor3D` | `fitEarring` + `EarringPhysics` | 동일 |

진입점: `src/studio.js` → `alignTick` → `evaluateAlignment` (`align.js`) → smoother → `GuideOverlay` → `JewelryARRenderer.updateFromAnchor` / `render`

## 자산 분기

`AssetResolver.resolveJewelryAsset` / `resolveAssetCandidate`

- `production_glb` / `validation_glb` / `fallback_2_5d` / `unavailable`
- 검증 자산: `?arDebug=1&arValidation=1` 만
- 대표 자산: `?arDebug=1&repAssets=1` 만

## 저장 경로

`runMergeTryOn` → `composeHighResTryOn` (`HighResCompose.js`)

- GLB 있음 → `JewelryARRenderer.composeHighRes` (고해상도 재렌더)
- 없음 → `composeTryOn` 2.5D / 목걸이 기존 절차적 경로

## 라이프사이클

- `startAlignLoop` / `stopAlignLoop` (중복 RAF 방지)
- `closeCameraSheet`: 카메라 트랙 stop, guide clear, AR clearFrame
- `closeStudio`: `JewelryARRenderer.dispose`
- `visibilitychange`: 백그라운드 시 align 중지
- `webglcontextlost`: 크래시 방지 플래그 리셋
