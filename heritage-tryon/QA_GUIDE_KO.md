# QA 가이드 (한국어)

## URL

- 스튜디오 디버그: `/heritage-tryon/studio.html?arDebug=1`
- 검증 GLB: `&arValidation=1`
- 대표 자산: `&repAssets=1`
- 내부 QA 페이지: `/heritage-tryon/qa.html?arQa=1` (고객 내비 비노출)
- 재질 프리뷰: `/heritage-tryon/materials-preview.html`

## QA 페이지에서 확인

- 모드: 팔찌/반지/목걸이/귀걸이
- arDebug / arValidation / repAssets 토글
- 스튜디오 iframe 내: 가이드, 오클루전 토글, 디버그 리포트 내보내기

## 카메라·모드 매트릭스

| 모드 | 카메라 | 확인 |
|------|--------|------|
| bracelet | rear | 손목 타원, GLB/2.5D |
| ring | rear | 손가락 링 |
| necklace | front | 쇄골 곡선, 미러 |
| earring | front | 좌/우 귀, 미러 |

## 디버그 export

카메라 화면 하단 「디버그 리포트 내보내기」 → JSON  
분석: `python analyze_debug_report.py path/to/report.json`

## 검사 항목

- 투영: HUD `errPx`
- 오클루전: dbg toggles
- 저장: 합성 후 미리보기, save Δ
- validation 누출: 일반 `id`로 validation GLB가 안 뜨는지
