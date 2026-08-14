export const SUN_R = 0.14;
export const TRAVEL = SUN_R * 2.9;
export const IMPACT_SCALE = SUN_R * 0.7;

export type Phase =
  | "clear"
  | "first-contact"
  | "partial"
  | "beads"
  | "diamond"
  | "totality"
  | "annular"
  | "third-contact"
  | "fourth-contact";

export type EclipseKind = "none" | "partial" | "annular" | "total";

export type EclipseInfo = {
  moonX: number;
  moonY: number;
  moonR: number;
  separation: number;
  coverage: number;
  magnitude: number;
  photosphereCovered: boolean;
  annularComplete: boolean;
  kind: EclipseKind;
  phase: Phase;
  contact: string;
  title: string;
  verse: string;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
};

const COPY: Record<Phase, { title: string; verse: string }> = {
  clear: {
    title: "The unobscured sun",
    verse: "A white coin in a bleached sky.",
  },
  "first-contact": {
    title: "First contact",
    verse: "Night takes a first, precise bite.",
  },
  partial: {
    title: "Partiality",
    verse: "The world goes pewter and strange.",
  },
  beads: {
    title: "Baily’s beads",
    verse: "Light threads the lunar valleys.",
  },
  diamond: {
    title: "Diamond ring",
    verse: "One last star — still the sun.",
  },
  totality: {
    title: "Totality",
    verse: "The sky remembers midnight.",
  },
  annular: {
    title: "Annularity",
    verse: "A ring of fire. Keep the plate down.",
  },
  "third-contact": {
    title: "Third contact",
    verse: "Day returns through a single wound.",
  },
  "fourth-contact": {
    title: "Fourth contact",
    verse: "The coin is whole. The spell lifts.",
  },
};

export function moonAt(
  progress: number,
  impact: number,
  moonScale: number,
): { x: number; y: number; r: number } {
  return {
    x: (progress * 2 - 1) * TRAVEL,
    y: impact * IMPACT_SCALE,
    r: SUN_R * moonScale,
  };
}

function overlapArea(d: number, r1: number, r2: number): number {
  if (d >= r1 + r2) {
    return 0;
  }
  if (d <= Math.abs(r1 - r2)) {
    const r = Math.min(r1, r2);
    return Math.PI * r * r;
  }
  const r1sq = r1 * r1;
  const r2sq = r2 * r2;
  const alpha = Math.acos(clamp((d * d + r1sq - r2sq) / (2 * d * r1), -1, 1));
  const beta = Math.acos(clamp((d * d + r2sq - r1sq) / (2 * d * r2), -1, 1));
  const k = (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2);
  return r1sq * alpha + r2sq * beta - 0.5 * Math.sqrt(Math.max(0, k));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function progressForX(x: number): number {
  return clamp((x / TRAVEL + 1) * 0.5, 0, 1);
}

function contactProgress(moonY: number, targetSep: number, after: boolean): number {
  const inner = targetSep * targetSep - moonY * moonY;
  if (inner <= 0) {
    return 0.5;
  }
  const dx = Math.sqrt(inner);
  return progressForX(after ? dx : -dx);
}

export function analyze(
  progress: number,
  impact: number,
  moonScale: number,
): EclipseInfo {
  const moon = moonAt(progress, impact, moonScale);
  const d = Math.hypot(moon.x, moon.y);
  const sunR = SUN_R;
  const moonR = moon.r;
  const sum = sunR + moonR;
  const diff = Math.abs(moonR - sunR);
  const sunArea = Math.PI * sunR * sunR;
  const coverage = clamp(overlapArea(d, sunR, moonR) / sunArea, 0, 1);
  const magnitude = moonR / sunR;
  const minDist = Math.abs(moon.y);
  const photosphereCovered = d + sunR < moonR - 0.0004;
  const annularComplete = d + moonR < sunR - 0.0004;

  let kind: EclipseKind = "none";
  if (minDist < sum) {
    if (moonR > sunR && minDist < moonR - sunR) {
      kind = "total";
    } else if (moonR < sunR && minDist < sunR - moonR) {
      kind = "annular";
    } else {
      kind = "partial";
    }
  }

  const c1 = contactProgress(moon.y, sum, false);
  const c4 = contactProgress(moon.y, sum, true);
  const c2 = kind === "none" ? 0.5 : contactProgress(moon.y, diff, false);
  const c3 = kind === "none" ? 0.5 : contactProgress(moon.y, diff, true);

  const approaching = progress <= 0.5;
  const nearOuter = Math.abs(d - sum) < 0.01;
  const nearInner = Math.abs(d - diff) < 0.01;
  const beadBand = d > diff && d < diff + 0.012 && kind === "total";
  const diamondBand = d > diff && d < diff + 0.0048 && kind === "total";

  let phase: Phase;
  if (coverage < 0.004 && approaching) {
    phase = nearOuter ? "first-contact" : "clear";
  } else if (coverage < 0.004) {
    phase = nearOuter ? "fourth-contact" : "clear";
  } else if (photosphereCovered) {
    phase = "totality";
  } else if (annularComplete) {
    phase = "annular";
  } else if (diamondBand) {
    phase = "diamond";
  } else if (beadBand) {
    phase = approaching ? "beads" : "third-contact";
  } else if (nearInner && kind === "total" && approaching) {
    phase = "beads";
  } else if (nearInner && kind === "total") {
    phase = "third-contact";
  } else if (nearOuter && approaching) {
    phase = "first-contact";
  } else if (nearOuter) {
    phase = "fourth-contact";
  } else {
    phase = "partial";
  }

  let contact = "—";
  if (progress < c1) {
    contact = "pre";
  } else if (kind === "total" && progress < c2) {
    contact = "C1";
  } else if (kind === "annular" && progress < c2) {
    contact = "C1";
  } else if (kind === "partial") {
    contact = progress < 0.5 ? "C1" : "C4";
  } else if (photosphereCovered || annularComplete) {
    contact = "C2";
  } else if (progress < c3) {
    contact = "C2";
  } else if (progress < c4) {
    contact = "C3";
  } else {
    contact = "C4";
  }

  const copy = COPY[phase];
  return {
    moonX: moon.x,
    moonY: moon.y,
    moonR,
    separation: d,
    coverage,
    magnitude,
    photosphereCovered,
    annularComplete,
    kind,
    phase,
    contact,
    title: copy.title,
    verse: copy.verse,
    c1,
    c2,
    c3,
    c4,
  };
}

export function playbackRate(info: EclipseInfo): number {
  switch (info.phase) {
    case "totality":
      return 0.16;
    case "annular":
      return 0.22;
    case "diamond":
      return 0.2;
    case "beads":
    case "third-contact":
      return 0.28;
    case "first-contact":
    case "fourth-contact":
      return 0.7;
    case "partial":
      return 0.85;
    case "clear":
      return 1.15;
    default: {
      const _exhaustive: never = info.phase;
      return _exhaustive;
    }
  }
}

export function sliderToMoonScale(t: number): number {
  return 0.93 + t * 0.14;
}

export function sliderToImpact(t: number): number {
  return (t - 0.5) * 1.7;
}

export function moonScaleToSlider(scale: number): number {
  return clamp((scale - 0.93) / 0.14, 0, 1);
}

export function impactToSlider(impact: number): number {
  return clamp(impact / 1.7 + 0.5, 0, 1);
}
