#!/usr/bin/env python3
"""
Analyze a real-device AR debug JSON export from PerfHarness.

Usage:
  python analyze_debug_report.py path/to/report.json
  python analyze_debug_report.py path/to/report.json --prev path/to/previous.json

Writes:
  _reports/debug/{timestamp}.ko.md
  _reports/debug/{timestamp}.json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "_reports" / "debug"

# Thresholds (section 94) — adjust only with Korean justification in report
THRESH = {
    "fps_pass": 24.0,
    "fps_conditional": 18.0,
    "proj_pass": 8.0,
    "proj_conditional": 15.0,
    "save_pass": 0.015,  # fraction of output width
    "save_conditional": 0.03,
}


def _n(v, default=None):
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def classify_fps(avg):
    if avg is None:
        return "FAIL", "avg FPS 없음"
    if avg >= THRESH["fps_pass"]:
        return "PASS", f"avg FPS {avg:.1f} ≥ {THRESH['fps_pass']}"
    if avg >= THRESH["fps_conditional"]:
        return "CONDITIONAL PASS", f"avg FPS {avg:.1f} ({THRESH['fps_conditional']}–{THRESH['fps_pass']})"
    return "FAIL", f"avg FPS {avg:.1f} < {THRESH['fps_conditional']}"


def classify_proj(err):
    if err is None:
        return "FAIL", "투영 오차 없음"
    if err <= THRESH["proj_pass"]:
        return "PASS", f"평균 오차 {err:.1f}px ≤ {THRESH['proj_pass']}px"
    if err <= THRESH["proj_conditional"]:
        return "CONDITIONAL PASS", f"평균 오차 {err:.1f}px ({THRESH['proj_pass']}–{THRESH['proj_conditional']}px)"
    return "FAIL", f"평균 오차 {err:.1f}px > {THRESH['proj_conditional']}px"


def classify_save(delta_norm):
    if delta_norm is None:
        return "CONDITIONAL PASS", "save delta 미포함 (저장 직측 후 재분석 권장)"
    if delta_norm <= THRESH["save_pass"]:
        return "PASS", f"정규화 이동 {delta_norm*100:.2f}% ≤ {THRESH['save_pass']*100:.1f}%"
    if delta_norm <= THRESH["save_conditional"]:
        return "CONDITIONAL PASS", f"정규화 이동 {delta_norm*100:.2f}%"
    return "FAIL", f"정규화 이동 {delta_norm*100:.2f}% > {THRESH['save_conditional']*100:.1f}%"


def worst_rank(a, b):
    order = {"PASS": 0, "CONDITIONAL PASS": 1, "FAIL": 2}
    return a if order.get(a, 9) >= order.get(b, 9) else b


def extract_metrics(data: dict) -> dict:
    """Support PerfHarness.exportJson shape and nested summarize fields."""
    save = data.get("saveConsistency") or {}
    last = data.get("last") or {}
    gl = data.get("glInfo") or {}
    return {
        "avgFps": _n(data.get("avgFps")),
        "minFps": _n(data.get("minFps")),
        "p95FrameMs": _n(data.get("p95FrameMs")),
        "avgHandMs": _n(data.get("avgHandMs")),
        "avgFaceMs": _n(data.get("avgFaceMs")),
        "avgPoseMs": _n(data.get("avgPoseMs")),
        "avgAnchorMs": _n(data.get("avgAnchorMs")),
        "avgSmoothMs": _n(data.get("avgSmoothMs")),
        "avgRenderMs": _n(data.get("avgRenderMs")),
        "avgSegMs": _n(data.get("avgSegMs")),
        "avgProjectionErrorPx": _n(data.get("avgProjectionErrorPx")),
        "maxProjectionErrorPx": _n(data.get("maxProjectionErrorPx")),
        "trackingLossCount": data.get("trackingLossCount") or 0,
        "quatFlipRejectCount": data.get("quatFlipRejectCount") or 0,
        "sampleCount": data.get("sampleCount"),
        "windowMs": data.get("windowMs"),
        "mode": (last.get("mode") or data.get("wearType") or data.get("mode")),
        "assetState": last.get("assetState") or data.get("assetState"),
        "tier": last.get("tier"),
        "cameraW": last.get("cameraW"),
        "cameraH": last.get("cameraH"),
        "browser": (data.get("meta") or {}).get("browser") or data.get("browser"),
        "dpr": (data.get("meta") or {}).get("dpr") or data.get("devicePixelRatio"),
        "glVendor": gl.get("vendor"),
        "glRenderer": gl.get("renderer"),
        "maxTextureSize": gl.get("maxTextureSize"),
        "webgl2": gl.get("webgl2"),
        "itemId": data.get("itemId"),
        "glbLoadMs": _n((data.get("last") or {}).get("glbLoadMs")) or _n(data.get("glbLoadMs")),
        "saveDeltaNorm": _n(save.get("positionDeltaNorm")),
        "exportedAt": data.get("exportedAt"),
        "hairDecision": data.get("hairDecision"),
    }


def bottleneck_rank(m: dict) -> list[tuple[str, float | None, str]]:
    rows = [
        ("Hand 추론", m["avgHandMs"], "MediaPipe Hand"),
        ("Face 추론", m["avgFaceMs"], "MediaPipe Face"),
        ("Pose 추론", m["avgPoseMs"], "MediaPipe Pose"),
        ("Three.js 렌더", m["avgRenderMs"], "JewelryARRenderer.render"),
        ("앵커 계산", m["avgAnchorMs"], "Anchor estimators"),
        ("스무딩", m["avgSmoothMs"], "TrackingSmoother"),
        ("세그멘테이션", m["avgSegMs"], "segmentation (현재 비활성 예상)"),
    ]
    rows = [(n, v, w) for n, v, w in rows if v is not None]
    rows.sort(key=lambda x: x[1], reverse=True)
    return rows


def root_causes(m: dict, fps_c: str, proj_c: str, save_c: str) -> list[str]:
    causes = []
    if fps_c != "PASS":
        bottlenecks = bottleneck_rank(m)
        if bottlenecks:
            top = bottlenecks[0]
            causes.append(f"성능: 가장 큰 비용은 {top[0]} ({top[1]:.1f}ms) — {top[2]}")
        if (m["avgRenderMs"] or 0) > 12:
            causes.append("렌더 ms가 높음 → LOD/픽셀비/오클루전 복잡도 점검")
        if (m["avgHandMs"] or 0) + (m["avgFaceMs"] or 0) + (m["avgPoseMs"] or 0) > 25:
            causes.append("랜드마크 추론 합이 큼 → 모드별 불필요 모델 중지 확인")
    if proj_c != "PASS":
        causes.append("투영 오차 → coord/object-fit/미러/Perspective FOV/앵커 중심 순서대로 점검 (기기별 하드코드 금지)")
    if save_c == "FAIL":
        causes.append("저장 점프 → composeHighRes 해상도·앵커 freeze·미러 재적용 확인")
    if (m["trackingLossCount"] or 0) > 20:
        causes.append(f"추적 손실 {m['trackingLossCount']}회 → 조명/손 가림/confidence hysteresis")
    if (m["quatFlipRejectCount"] or 0) > 10:
        causes.append(f"쿼터니언 플립 거부 {m['quatFlipRejectCount']}회 → slerp/점프 임계값")
    if not causes:
        causes.append("임계값 기준 뚜렷한 병목 없음")
    return causes


def recommendations(m: dict, fps_c: str, proj_c: str) -> list[str]:
    rec = []
    if fps_c == "FAIL":
        rec.append("품질 tier를 LOW/FALLBACK으로 강제 하향 후 FPS 재측정")
        rec.append("necklace면 체인 세그먼트 축소, earring면 물리 비활성 테스트")
    elif fps_c == "CONDITIONAL PASS":
        rec.append("MEDIUM 유지하되 pixelRatio 상한 1.25, antialias off 옵션 시험")
    if proj_c != "PASS":
        rec.append("일반 좌표 수학 → 카메라 투영 → 미러 → object-fit 순으로 수정 (폰 모델 하드코드 최후)")
    if m.get("assetState") == "fallback_2_5d":
        rec.append("실 SKU GLB가 없음 — 성능/투영 판정은 2.5D 경로 기준으로만 해석")
    if m.get("assetState") == "validation_glb":
        rec.append("validation 자산으로 측정됨 — 상용 판정에 사용하지 말 것")
    rec.append("실 SKU production_glb 재측정 후에만 외부 SDK 구매 검토")
    return rec


def compare_prev(curr: dict, prev: dict | None) -> list[str]:
    if not prev:
        return ["이전 리포트 없음"]
    lines = []
    pairs = [
        ("avgFps", "avg FPS"),
        ("avgProjectionErrorPx", "투영 오차 px"),
        ("avgRenderMs", "render ms"),
        ("trackingLossCount", "추적 손실"),
    ]
    for key, label in pairs:
        a, b = curr.get(key), prev.get(key)
        if a is None or b is None:
            continue
        try:
            da, db = float(a), float(b)
            delta = da - db
            lines.append(f"{label}: {db:.2f} → {da:.2f} (Δ {delta:+.2f})")
        except (TypeError, ValueError):
            continue
    return lines or ["비교 가능한 수치 없음"]


def overall(fps_c, proj_c, save_c, tracking_ok: bool) -> str:
    o = worst_rank(fps_c, proj_c)
    o = worst_rank(o, save_c)
    if not tracking_ok and o == "PASS":
        return "CONDITIONAL PASS"
    if not tracking_ok and o == "CONDITIONAL PASS":
        return "FAIL" if False else "CONDITIONAL PASS"
    return o


def write_report(m: dict, prev_m: dict | None, src: Path) -> tuple[Path, Path]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    fps_c, fps_why = classify_fps(m["avgFps"])
    proj_c, proj_why = classify_proj(m["avgProjectionErrorPx"])
    save_c, save_why = classify_save(m["saveDeltaNorm"])
    tracking_ok = (m["trackingLossCount"] or 0) < 30 and (m["quatFlipRejectCount"] or 0) < 25
    final = overall(fps_c, proj_c, save_c, tracking_ok)

    md = []
    md.append(f"# AR 디버그 리포트 분석 ({ts})")
    md.append("")
    md.append(f"- 원본: `{src}`")
    md.append(f"- 모드: `{m.get('mode')}`")
    md.append(f"- SKU: `{m.get('itemId')}`")
    md.append(f"- assetState: `{m.get('assetState')}`")
    md.append(f"- 최종 판정: **{final}**")
    md.append("")
    md.append("## 임계값")
    md.append(f"- FPS PASS ≥ {THRESH['fps_pass']}, CONDITIONAL ≥ {THRESH['fps_conditional']}")
    md.append(f"- 투영 PASS ≤ {THRESH['proj_pass']}px, CONDITIONAL ≤ {THRESH['proj_conditional']}px")
    md.append(f"- 저장 PASS ≤ {THRESH['save_pass']*100:.1f}% 폭, CONDITIONAL ≤ {THRESH['save_conditional']*100:.1f}%")
    md.append("")
    md.append("## 분류")
    md.append(f"- 성능: **{fps_c}** — {fps_why}")
    md.append(f"- 투영: **{proj_c}** — {proj_why}")
    md.append(f"- 저장 일치: **{save_c}** — {save_why}")
    md.append(f"- 추적 안정: {'양호' if tracking_ok else '주의'} (loss={m['trackingLossCount']}, quatReject={m['quatFlipRejectCount']})")
    md.append("")
    md.append("## 메트릭")
    for k in [
        "avgFps", "minFps", "p95FrameMs", "avgHandMs", "avgFaceMs", "avgPoseMs",
        "avgRenderMs", "avgProjectionErrorPx", "maxProjectionErrorPx", "saveDeltaNorm",
        "cameraW", "cameraH", "dpr", "tier", "glbLoadMs",
    ]:
        md.append(f"- {k}: {m.get(k)}")
    md.append(f"- browser: {m.get('browser')}")
    md.append(f"- GL: {m.get('glVendor')} / {m.get('glRenderer')} / maxTex={m.get('maxTextureSize')}")
    md.append("")
    md.append("## 병목 순위")
    for i, (name, ms, where) in enumerate(bottleneck_rank(m), 1):
        md.append(f"{i}. {name}: {ms:.2f}ms (`{where}`)")
    if not bottleneck_rank(m):
        md.append("- (추론/렌더 ms 필드 없음)")
    md.append("")
    md.append("## 추정 원인")
    for c in root_causes(m, fps_c, proj_c, save_c):
        md.append(f"- {c}")
    md.append("")
    md.append("## 권장 조치")
    for r in recommendations(m, fps_c, proj_c):
        md.append(f"- {r}")
    md.append("")
    md.append("## 이전 리포트 대비")
    for line in compare_prev(m, prev_m):
        md.append(f"- {line}")
    md.append("")
    md.append("## 결론")
    md.append(f"**{final}**. 상용 품질 최종 합격은 실 SKU `production_glb` + 전·후면·4모드 리포트가 모두 PASS/CONDITIONAL일 때 검토합니다.")
    md.append("")

    text = "\n".join(md)
    md_path = OUT_DIR / f"{ts}.ko.md"
    json_path = OUT_DIR / f"{ts}.json"
    payload = {
        "timestamp": ts,
        "source": str(src),
        "verdict": final,
        "classifications": {"fps": fps_c, "projection": proj_c, "save": save_c, "trackingOk": tracking_ok},
        "metrics": m,
        "thresholds": THRESH,
    }
    md_path.write_text(text, encoding="utf-8")
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return md_path, json_path


def main():
    ap = argparse.ArgumentParser(description="Analyze heritage-tryon AR debug JSON")
    ap.add_argument("report", type=Path, help="debug JSON path")
    ap.add_argument("--prev", type=Path, default=None, help="previous report for comparison")
    args = ap.parse_args()
    if not args.report.exists():
        print(f"파일 없음: {args.report}", file=sys.stderr)
        sys.exit(1)
    data = json.loads(args.report.read_text(encoding="utf-8"))
    metrics = extract_metrics(data)
    prev_m = None
    if args.prev and args.prev.exists():
        prev_m = extract_metrics(json.loads(args.prev.read_text(encoding="utf-8")))
    md_path, json_path = write_report(metrics, prev_m, args.report)
    print(md_path.read_text(encoding="utf-8"))
    print(f"\n작성됨: {md_path}")
    print(f"작성됨: {json_path}")


if __name__ == "__main__":
    main()
