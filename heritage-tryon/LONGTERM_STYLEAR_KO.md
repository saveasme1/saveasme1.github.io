# Heritage Try-On · StyleAR 동급 장기 프로젝트

작성일: 2026-07-27  
근거(웹): [stylear.ai](https://stylear.ai/ko) · [deepixel.xyz](https://www.deepixel.xyz/ko) · [에이빙 인터뷰](https://kr.aving.net/news/articleView.html?idxno=1715282) · [MWC 2026 StyleAR+](https://kr.aving.net/news/articleView.html?idxno=1809349) · [패션비즈](https://fashionbiz.co.kr/article/206540)

이 문서는 **프로젝트 헌장**이다. 이후 기능·리팩터·배포 우선순위는 본 문서를 따른다.

---

## 1. 목표 선언

**목표:** Deepixel StyleAR과 **같은 방식(방식 = 기술 축)** 으로 주얼리 가상 착용을 완성한다.  
**제외:** StyleAR SDK 구매·라이선스 연동은 기본 경로가 아니다.  
**결과 목표:** 고객이 보는 **최종 합성 한 장**의 품질을 StyleAR SaaS(셀카/앨범 피팅) 동급으로 끌어올린다.  
**의도적 차이:** StyleAR의 **라이브 저지연 오버레이**는 1차 목표가 아니다. 우리는 가이드 촬영 → **합성 시간 예산**을 쓰는 쪽이 본진이다.

---

## 2. StyleAR이 공개적으로 쓰는 방식 (조사 요약)

| StyleAR / Deepixel 축 | 공개 근거 | Heritage 대응 |
|----------------------|-----------|---------------|
| 단일 RGB, ARKit/ARCore 비의존 | TechInnovation·회사 소개 | 유지 (웹 MediaPipe 등) |
| 신체 부위 특화 비전: Face·Ears / Hand·Fingers·Wrist | deepixel.xyz 기술 페이지 | 모드별 앵커·합성 재추정으로 동급화 |
| 멀티태스크 포즈 추정 (다부위 일관) | MWC 2026 StyleAR+ | 장기: 부위 엔진 통합 인터페이스 |
| 웹 SaaS: **셀카 + 앨범 사진** 피팅 | stylear.ai SaaS 문구 | **본진 UX**로 승격 |
| 질감·광택 재현 렌더 | StyleAR+ 보도 | 합성 단계 재질/하모나이즈 |
| 플러그인·임베드 배포 | SaaS / Seamless / SDK | `tryon-overlay.js` + studio |

StyleAR SaaS는 라이브만이 아니라 **사진 기반 착용**을 공식 지원한다.  
→ 우리 “합성 시간이 따로 있다”는 약점이 아니라 **StyleAR SaaS와 같은 제품 형태**다.

---

## 3. 제품 원칙 (전환 후)

1. **Compose-first** — 최종 품질은 `runMergeTryOn` / StyleAR 합성 파이프에서 결정한다.  
2. **가이드 카메라는 정렬 도구** — 라이브 GLB 프리뷰는 보조. 품질 판정은 합성 결과로만.  
3. **부위 특화** — 귀걸이=Face·Ear, 반지=Hand·Finger, 팔찌=Wrist, 목걸이=Neck(+Face). StyleAR 부위 분류와 정렬.  
4. **단일 RGB** — 심도 카메라·네이티브 AR 필수 금지(측정으로 한계가 증명되기 전).  
5. **SKU 자산** — 컷아웃/마스크/메타(실측 mm)를 StyleAR 카탈로그처럼 운영. GLB는 가속 옵션.  
6. **유료 SDK** — 합성 품질이 실측으로 StyleAR 동급에 미달할 때만 POC. 기본 경로는 자체 파이프.

---

## 4. 목표 파이프라인 (StyleAR 동형)

```
[입력] 셀카 촬영 | 앨범 업로드
   ↓
[인식] 부위 랜드마크 / 포즈 / 스케일 기준 (합성 직전 고품질 재추정)
   ↓
[정렬] 부착점 · 균일 스케일 · 좌우 대칭 · fitWarning
   ↓
[합성] 제품 레이어 + 오클루전 마스크 + 접촉 그림자 + 조명 맞춤
   ↓
[출력] 공유·저장용 고해상도 스틸
```

라이브 루프(`alignTick`)는 **정렬 가이드 전용**. 최종 픽셀은 위 파이프만 책임진다.

코드 진입점: `src/services/ar/StyleArComposePipeline.js` → 기존 `composeHighResTryOn` / `composeTryOn` 연결.

---

## 5. 단계 로드맵

### Phase 0 — 전환 고정 (완료 기준: 본 문서 + 합성 진입점)
- 프로젝트 헌장·아키텍처·README를 StyleAR 동형으로 고정
- 합성 파이프 공식 진입점 도입
- 라이브를 “품질 본진”에서 제외하는 정책 명시

### Phase 1 — StyleAR SaaS 동형 (사진/합성 본진) · 진행 중/완료 코드

- [x] 합성 직전 **스틸 우선 재검출** (`StillRedetect.resolveComposeTarget`)
- [x] 부위 소프트 오클루전 (`PartOcclusionMask.applyPartOcclusion`)
- [x] 가장자리·조명 하모나이즈 (`ComposeHarmonize.harmonizeCompose`)
- [x] 앨범 업로드 = 셀카와 동일 `runStyleArCompose` (`bodySource: upload|camera`)
- [ ] 모드별 실기기 합성 샘플 + 디버그 JSON (실측)

코드: `StyleArComposePipeline.js` v1.3.0-phase3

### Phase 2 — 부위 특화 (Deepixel Face·Ear / Hand·Wrist 축) · 코드 완료

- [x] 귀: 측면·가림(헤어) 휴리스틱 / 좌우 identity (`refineEarSpecialist`)
- [x] 반지: 관절 bend → fitWarning, MCP 쪽 보정 (`refineFingerSpecialist`)
- [x] 팔찌: 손목 타원 클램프 (`refineWristSpecialist`)
- [x] 목걸이: 쇄골 드레이프 (`refineNecklaceSpecialist`) + 전면캠(기존)
- [ ] 가림·측면 포즈 **실기기** 고정 테스트셋

### Phase 3 — 카탈로그·재질 (StyleAR+ 광택 축) · 코드 완료

- [x] SKU 메타 normalize (`normalizeSkuMeta`)
- [x] 2.5D 합성 metal 틴트 (`applyCatalogMaterial2D`)
- [x] GLB는 기존 `applyMaterialPreset` live/save
- [ ] SKU 10종 이상 **실측** A/B

### Phase 4 — 라이브 프리뷰 폴리시 · 코드 완료

- [x] 모드별 smoother (`liveSmootherOptions`)
- [x] 라이브 GLB 가이드 투명도 (`setLivePreviewOpacity`)
- 최종 픽셀은 계속 `runStyleArCompose`

### Phase 5 — (조건부) 상용 엔진 POC

- Phase 1~3 **실기기** 리포트가 StyleAR 동급 미달일 때만
- 후보: Perfect Corp → Banuba/DeepAR(얼굴·귀) → 최후 네이티브
- StyleAR SDK 구매는 별도 사업·계약 결정 · **현재 미실행**

---

## 6. 현재 코드베이스 매핑

| StyleAR 개념 | 현재 위치 | 다음 작업 |
|--------------|-----------|-----------|
| Face·Ears | `EarAnchorEstimator`, Face MediaPipe | 합성 재추정·헤어 가림 |
| Hand·Fingers | `FingerAnchorEstimator`, Hand | 스틸 재추정·마스크 |
| Wrist | `WristAnchorEstimator` | 2.5D 전후 + 그림자 |
| Neck | `NeckAnchorEstimator` | 전면캠 + 드레이프 |
| SaaS 사진 피팅 | `runMergeTryOn`, 업로드 | Phase 1 본진 |
| 렌더/광택 | `MaterialPresets`, Three/2.5D | Phase 3 |
| 임베드 | `tryon-overlay.js` | 유지 |

---

## 7. 하지 않을 것

- StyleAR/유료 SDK를 “기본 답”으로 도입
- 라이브 FPS 최적화로 합성 품질 작업을 대체
- TorusGeometry 등 가짜 제품 메시를 생산 경로에 복귀
- validation GLB를 일반 SKU에 몰래 매핑
- 근거 없는 “완전 동일 엔진” 선언 (목표는 **동급 합성 결과**)

---

## 8. 성공 정의

StyleAR SaaS처럼 고객이 **셀카 또는 앨범**으로 착용 결과를 보고,  
귀걸이·반지·팔찌·목걸이에서 **위치·비율·가림·광택**이 판매 가능한 수준이면 Phase 1~3 성공.  
라이브가 StyleAR 앱과 같아질 필요는 없다.

관련: `ARCHITECTURE_KO.md` · `ASSET_PIPELINE_KO.md` · `QA_GUIDE_KO.md` · `FINAL_STATUS_KO.md`
