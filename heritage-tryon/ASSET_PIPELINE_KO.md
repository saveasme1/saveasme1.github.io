# 주얼리 SKU 디지털 트윈 파이프라인

## 폴더 규격

```
public/assets/jewelry/{skuId}/
  model.glb
  metadata.json
  fallback-front.webp   (권장)
  fallback-back.webp    (권장)
  fallback-mask.webp    (권장)
  thumbnail.webp        (권장)
  model-medium.glb      (선택)
  model-low.glb         (선택)
```

## 자산 상태 (AssetResolver)

| 상태 | 의미 |
|------|------|
| `production_glb` | 실제/대표 SKU GLB 렌더 |
| `validation_glb` | `?arDebug=1&arValidation=1` 에서만 |
| `fallback_2_5d` | GLB 없음 → 제품 PNG 2.5D |
| `unavailable` | WebGL 등 불가 |

**프로덕션 SKU에 validation-* GLB를 자동 대입하지 않습니다.**

분기 코드: `src/services/ar/AssetResolver.js` → `resolveAssetCandidate` / `resolveJewelryAsset`  
로드: `JewelryARRenderer.loadProductForSku`

## 실제 SKU 제작에 필요한 원본 (우선순위)

1. 원본 CAD (STEP/OBJ/GLTF)
2. 제조사 3D 파일
3. 제어된 3D 스캔
4. 치수+다각도 사진 기반 수동 모델링
5. 반사면 통제된 포토그래메트리

**정면 PNG 한 장만으로는 상용 3D AR 품질을 주장할 수 없습니다.**

## 검증

```bash
python validate_sku_assets.py
```

보고: `public/assets/jewelry/_reports/latest.ko.md`
