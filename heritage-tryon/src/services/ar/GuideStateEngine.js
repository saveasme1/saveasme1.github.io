/**
 * Single-message guide state machine with hysteresis for all jewelry modes.
 */

const PRIORITY = [
  "idle",
  "no_hand",
  "no_face",
  "no_shoulders",
  "detecting",
  "wrong_hand",
  "wrong_orientation",
  "show_back_of_hand",
  "target_ear_hidden",
  "hair_covering_ear",
  "shoulders_outside_frame",
  "move_closer",
  "move_farther",
  "move_left",
  "move_right",
  "rotate_left",
  "rotate_right",
  "body_rotated_left",
  "body_rotated_right",
  "align_wrist",
  "straighten_finger",
  "separate_fingers",
  "head_too_high",
  "head_too_low",
  "excessive_yaw",
  "excessive_pitch",
  "excessive_motion",
  "low_confidence",
  "low_light",
  "overexposed",
  "stable",
  "capturing",
  "capture_failed",
  "failed",
];

const COPY = {
  idle: "손을 화면에 보여주세요",
  no_hand: "손을 화면에 보여주세요",
  no_face: "얼굴을 화면에 보여주세요",
  no_shoulders: "얼굴과 어깨를 화면에 보여주세요",
  detecting: "인식하는 중…",
  wrong_hand: "왼손을 보여주세요",
  wrong_orientation: "손등을 카메라로 향해주세요",
  show_back_of_hand: "손등을 카메라로 향해주세요",
  target_ear_hidden: "귀가 보이도록 고개를 돌려주세요",
  hair_covering_ear: "머리카락을 귀 뒤로 넘겨주세요",
  shoulders_outside_frame: "어깨가 화면 안에 들어오게 해주세요",
  move_closer: "조금 더 가까이 와주세요",
  move_farther: "조금만 멀리해주세요",
  move_left: "화면 왼쪽으로 조금 옮겨주세요",
  move_right: "화면 오른쪽으로 조금 옮겨주세요",
  rotate_left: "손을 왼쪽으로 돌려주세요",
  rotate_right: "손을 오른쪽으로 돌려주세요",
  body_rotated_left: "몸을 오른쪽으로 돌려주세요",
  body_rotated_right: "몸을 왼쪽으로 돌려주세요",
  align_wrist: "손목을 화면 중앙에 맞춰주세요",
  straighten_finger: "선택한 손가락을 곧게 펴주세요",
  separate_fingers: "손가락을 조금 벌려주세요",
  head_too_high: "고개를 조금 내려주세요",
  head_too_low: "고개를 조금 들어주세요",
  excessive_yaw: "정면을 바라봐주세요",
  excessive_pitch: "정면을 바라봐주세요",
  excessive_motion: "움직임을 잠시 멈춰주세요",
  low_confidence: "조금 더 또렷하게 맞춰주세요",
  low_light: "밝은 곳에서 맞춰주세요",
  overexposed: "빛이 강한 곳을 피해 주세요",
  stable: "좋습니다. 그대로 유지해주세요",
  capturing: "촬영 중입니다",
  capture_failed: "다시 맞춰 촬영해 주세요",
  failed: "다시 맞춰주세요",
};

export class GuideStateEngine {
  constructor() {
    this.state = "idle";
    this._since = 0;
    this._minHoldMs = 280;
  }

  message(state = this.state) {
    return COPY[state] || COPY.idle;
  }

  evaluate(type, anchor, extras = {}) {
    const now = performance.now();
    let next = "detecting";

    if (!anchor) {
      if (type === "necklace" || type === "earring") {
        next = extras.sawSomething ? "detecting" : "no_face";
      } else {
        next = extras.sawSomething ? "detecting" : "no_hand";
      }
    } else {
      const c = anchor.confidence ?? 0;
      const cx = (anchor.center2D || anchor.center || anchor.attachment2D)?.x ?? 0.5;
      const cy = (anchor.center2D || anchor.center || anchor.attachment2D)?.y ?? 0.5;
      const inSafe = cx > 0.14 && cx < 0.86 && cy > 0.14 && cy < 0.86;
      const motion = extras.motion || 0;

      if (extras.lowLight) next = "low_light";
      else if (extras.overexposed) next = "overexposed";
      else if (motion > 0.045) next = "excessive_motion";
      else if (type === "earring") {
        const vis = anchor.visibility ?? 1;
        if (vis < 0.28) next = "target_ear_hidden";
        else if (!inSafe) next = cy < 0.2 ? "head_too_high" : cy > 0.85 ? "head_too_low" : "excessive_yaw";
        else if ((anchor.earScale || anchor.scale || 0) < 0.025) next = "move_closer";
        else if ((anchor.earScale || anchor.scale || 0) > 0.14) next = "move_farther";
        else if (c >= 0.7 && inSafe && vis >= 0.4) next = "stable";
        else next = "detecting";
      } else if (type === "necklace") {
        if (!inSafe) next = "shoulders_outside_frame";
        else if ((anchor.shoulderWidth || anchor.scale || 0) < 0.16) next = "move_closer";
        else if ((anchor.shoulderWidth || anchor.scale || 0) > 0.75) next = "move_farther";
        else if (Math.abs((anchor.shoulderAxis?.y || 0)) > 0.35) next = "body_rotated_left";
        else if (c >= 0.7 && inSafe) next = "stable";
        else next = "detecting";
      } else {
        const scale =
          type === "bracelet" ? anchor.radiusX || anchor.scale : anchor.radiusEstimate || anchor.scale;
        if (!inSafe) next = "align_wrist";
        else if (scale < 0.03) next = "move_closer";
        else if (scale > 0.16) next = "move_farther";
        else if (type === "ring" && (anchor.jointBend || 0) > 1.1) next = "straighten_finger";
        else if (type === "bracelet" && extras.palmFacing) next = "show_back_of_hand";
        else if (c >= 0.72 && inSafe) next = "stable";
        else next = type === "ring" ? "straighten_finger" : "align_wrist";
      }
    }

    if (next !== this.state) {
      const curPri = PRIORITY.indexOf(this.state);
      const nextPri = PRIORITY.indexOf(next);
      const elapsed = now - this._since;
      if (elapsed < this._minHoldMs && next !== "stable" && nextPri <= curPri) {
        return this.state;
      }
      this.state = next;
      this._since = now;
    }
    return this.state;
  }
}
