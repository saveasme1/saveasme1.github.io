/**
 * Single-message guide state machine with hysteresis.
 */

const PRIORITY = [
  "idle",
  "detecting",
  "wrong_hand",
  "show_back_of_hand",
  "move_closer",
  "move_farther",
  "rotate_left",
  "rotate_right",
  "align_wrist",
  "straighten_finger",
  "stable",
  "capturing",
  "failed",
];

const COPY = {
  idle: "손을 화면에 보여주세요",
  detecting: "손을 인식하는 중…",
  wrong_hand: "왼손을 보여주세요",
  show_back_of_hand: "손등을 카메라로 향해주세요",
  move_closer: "조금 더 가까이 와주세요",
  move_farther: "조금만 멀리해주세요",
  rotate_left: "손을 왼쪽으로 돌려주세요",
  rotate_right: "손을 오른쪽으로 돌려주세요",
  align_wrist: "손목을 화면 중앙에 맞춰주세요",
  straighten_finger: "선택한 손가락을 곧게 펴주세요",
  stable: "좋습니다. 그대로 유지해주세요",
  capturing: "촬영 중입니다",
  failed: "다시 손을 맞춰주세요",
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

  /**
   * Evaluate bracelet or ring alignment into one status.
   * @param {'bracelet'|'ring'} type
   * @param {object|null} anchor
   * @param {object} extras — { lm, finger, motion }
   */
  evaluate(type, anchor, extras = {}) {
    const now = performance.now();
    let next = "detecting";

    if (!anchor) {
      next = extras.sawSomething ? "detecting" : "idle";
    } else {
      const c = anchor.confidence ?? 0;
      const cx = (anchor.center2D || anchor.center)?.x ?? 0.5;
      const cy = (anchor.center2D || anchor.center)?.y ?? 0.5;
      const inSafe = cx > 0.18 && cx < 0.82 && cy > 0.2 && cy < 0.82;
      const scale = type === "bracelet" ? anchor.radiusX || anchor.scale : anchor.radiusEstimate || anchor.scale;

      if (anchor.handedness === "Right" && type !== "earring") {
        // soft hint only — rear cam often flips; don't hard-fail
      }
      if (!inSafe) next = "align_wrist";
      else if (scale < 0.03) next = "move_closer";
      else if (scale > 0.16) next = "move_farther";
      else if (type === "ring" && (anchor.jointBend || 0) > 1.1) next = "straighten_finger";
      else if (type === "bracelet" && extras.palmFacing) next = "show_back_of_hand";
      else if (c >= 0.72 && inSafe) next = "stable";
      else next = type === "ring" ? "straighten_finger" : "align_wrist";
    }

    // hysteresis
    if (next !== this.state) {
      const curPri = PRIORITY.indexOf(this.state);
      const nextPri = PRIORITY.indexOf(next);
      const elapsed = now - this._since;
      // allow upgrade to stable faster; prevent flicker on peer statuses
      if (elapsed < this._minHoldMs && next !== "stable" && nextPri <= curPri) {
        return this.state;
      }
      this.state = next;
      this._since = now;
    }
    return this.state;
  }
}
