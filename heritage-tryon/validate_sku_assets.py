"""
Validate jewelry SKU asset folders.
Usage: python validate_sku_assets.py [skuId...]
Writes Korean report to public/assets/jewelry/_reports/
"""
from __future__ import annotations

import json
import struct
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "public" / "assets" / "jewelry"
REPORTS = ROOT / "_reports"

REQUIRED_META = [
    "productId",
    "type",
    "model",
    "unit",
    "defaultScale",
    "allowedScaleRange",
    "deformationPolicy",
    "materialPreset",
    "occlusionMode",
]

SUPPORTED_TYPES = {
    "rigid_bangle",
    "open_bangle",
    "cuff",
    "chain_bracelet",
    "watch",
    "rigid_ring",
    "stone_ring",
    "open_ring",
    "chain_necklace",
    "pendant_necklace",
    "choker",
    "short_necklace",
    "long_necklace",
    "layered_necklace",
    "rigid_collar",
    "station_necklace",
    "stud",
    "hoop",
    "huggie",
    "drop",
    "dangle",
    "chandelier",
    "ear_cuff",
    "climber",
}


def check_glb(path: Path):
    issues = []
    if not path.exists():
        return False, ["model.glb 없음"], 0
    data = path.read_bytes()
    if data[:4] != b"glTF":
        issues.append("GLB 헤더가 glTF가 아님")
        return False, issues, len(data)
    if len(data) < 20:
        issues.append("GLB 파일이 너무 작음")
    # rough triangle estimate unavailable without full parse — report size only
    return len(issues) == 0, issues, len(data)


def validate_sku(sku_id: str) -> dict:
    folder = ROOT / sku_id
    report = {
        "skuId": sku_id,
        "ok": True,
        "errors": [],
        "warnings": [],
        "checkedAt": datetime.now().isoformat(timespec="seconds"),
    }
    if not folder.is_dir():
        report["ok"] = False
        report["errors"].append("폴더 없음")
        return report

    meta_path = folder / "metadata.json"
    if not meta_path.exists():
        report["ok"] = False
        report["errors"].append("metadata.json 없음")
        return report

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        report["ok"] = False
        report["errors"].append(f"metadata.json 파싱 실패: {e}")
        return report

    for key in REQUIRED_META:
        if key not in meta:
            report["errors"].append(f"metadata 필수 키 누락: {key}")

    if meta.get("unit") not in (None, "mm"):
        report["warnings"].append(f"unit이 mm가 아님: {meta.get('unit')}")

    if meta.get("type") not in SUPPORTED_TYPES:
        report["warnings"].append(f"미지원/미등록 type: {meta.get('type')}")

    rng = meta.get("allowedScaleRange")
    if not (isinstance(rng, list) and len(rng) == 2 and rng[0] <= 1 <= rng[1] or (isinstance(rng, list) and len(rng) == 2)):
        report["warnings"].append("allowedScaleRange 형식 확인 필요")

    if meta.get("validationAsset") and not sku_id.startswith("validation-"):
        report["warnings"].append("validationAsset=true 이지만 id가 validation- 가 아님")

    if meta.get("deformationPolicy") not in (
        "none",
        "chain-path-only",
        "links",
        None,
    ):
        report["warnings"].append(f"deformationPolicy 확인: {meta.get('deformationPolicy')}")

    model_name = meta.get("model") or "model.glb"
    glb_ok, glb_issues, size = check_glb(folder / model_name)
    report["glbBytes"] = size
    if not glb_ok:
        report["errors"].extend(glb_issues)

    for name in ("fallback-front.webp", "fallback-back.webp", "fallback-mask.webp", "thumbnail.webp"):
        if not (folder / name).exists():
            report["warnings"].append(f"권장 파일 없음: {name}")

    # pivot / offset sanity
    for key in ("rotationOffset", "positionOffset", "pivotOffset"):
        v = meta.get(key)
        if v is not None and not (isinstance(v, list) and len(v) == 3):
            report["errors"].append(f"{key}는 [x,y,z] 배열이어야 함")

    report["ok"] = len(report["errors"]) == 0
    report["meta"] = {
        "type": meta.get("type"),
        "validationAsset": meta.get("validationAsset"),
        "isRepresentative": meta.get("isRepresentative"),
        "materialPreset": meta.get("materialPreset"),
    }
    return report


def korean_report(reports: list[dict]) -> str:
    lines = ["# 주얼리 SKU 자산 검증 보고", "", f"생성: {datetime.now().isoformat(timespec='seconds')}", ""]
    for r in reports:
        status = "통과" if r["ok"] else "실패"
        lines.append(f"## {r['skuId']} - {status}")
        if r.get("meta"):
            lines.append(f"- type: `{r['meta'].get('type')}`")
            lines.append(f"- material: `{r['meta'].get('materialPreset')}`")
            lines.append(f"- validationAsset: {r['meta'].get('validationAsset')}")
            lines.append(f"- isRepresentative: {r['meta'].get('isRepresentative')}")
        if r.get("glbBytes"):
            lines.append(f"- GLB 크기: {r['glbBytes']} bytes")
        for e in r.get("errors") or []:
            lines.append(f"- ERROR: {e}")
        for w in r.get("warnings") or []:
            lines.append(f"- WARN: {w}")
        lines.append("")
    return "\n".join(lines)


def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    ids = sys.argv[1:]
    if not ids:
        ids = [p.name for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith("_")]
    reports = [validate_sku(i) for i in ids]
    (REPORTS / "latest.json").write_text(json.dumps(reports, indent=2, ensure_ascii=False), encoding="utf-8")
    md = korean_report(reports)
    (REPORTS / "latest.ko.md").write_text(md, encoding="utf-8")
    print(md)
    failed = [r["skuId"] for r in reports if not r["ok"]]
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)
    print("ALL OK")


if __name__ == "__main__":
    main()
