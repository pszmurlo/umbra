import {
  impactToSlider,
  moonScaleToSlider,
  sliderToImpact,
  sliderToMoonScale,
  type EclipseInfo,
} from "./eclipse";

export type PlateMode = "auto" | "down" | "up";

export type Sim = {
  progress: number;
  impact: number;
  moonScale: number;
  zoom: number;
  plate: number;
  plateMode: PlateMode;
  playing: boolean;
  time: number;
};

type Nodes = {
  title: HTMLElement;
  verse: HTMLElement;
  mag: HTMLElement;
  cov: HTMLElement;
  kind: HTMLElement;
  contact: HTMLElement;
  announce: HTMLElement;
  play: HTMLButtonElement;
  plate: HTMLButtonElement;
  progress: HTMLInputElement;
  distance: HTMLInputElement;
  impact: HTMLInputElement;
  contacts: NodeListOf<HTMLElement>;
};

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

export function queryUi(): Nodes {
  return {
    title: el("phase-title"),
    verse: el("phase-verse"),
    mag: el("read-mag"),
    cov: el("read-cov"),
    kind: el("read-kind"),
    contact: el("read-contact"),
    announce: el("announce"),
    play: el("btn-play"),
    plate: el("btn-plate"),
    progress: el("progress"),
    distance: el("distance"),
    impact: el("impact"),
    contacts: document.querySelectorAll(".contacts i"),
  };
}

const KIND_LABEL: Record<EclipseInfo["kind"], string> = {
  none: "None",
  partial: "Partial",
  annular: "Annular",
  total: "Total",
};

export function syncSliders(ui: Nodes, sim: Sim): void {
  ui.progress.value = String(Math.round(sim.progress * 1000));
  ui.distance.value = String(Math.round(moonScaleToSlider(sim.moonScale) * 1000));
  ui.impact.value = String(Math.round(impactToSlider(sim.impact) * 1000));
  ui.distance.setAttribute(
    "aria-valuetext",
    sim.moonScale >= 1 ? "Total eclipse" : "Annular eclipse",
  );
}

export function syncHud(ui: Nodes, sim: Sim, info: EclipseInfo, lastPhase: string): string {
  ui.title.textContent = info.title;
  ui.verse.textContent = info.verse;
  ui.mag.textContent = info.magnitude.toFixed(3);
  ui.cov.textContent = `${Math.round(info.coverage * 100)}%`;
  ui.kind.textContent = KIND_LABEL[info.kind];
  ui.contact.textContent = info.contact;
  document.body.classList.toggle("is-total", info.photosphereCovered);

  for (const mark of ui.contacts) {
    const key = mark.dataset.c;
    const pos =
      key === "c1"
        ? info.c1
        : key === "c2"
          ? info.c2
          : key === "c3"
            ? info.c3
            : info.c4;
    mark.style.left = `${pos * 100}%`;
    mark.hidden = info.kind === "none" && (key === "c2" || key === "c3");
    if (info.kind === "partial" && (key === "c2" || key === "c3")) {
      mark.hidden = true;
    }
  }

  ui.play.setAttribute("aria-pressed", sim.playing ? "true" : "false");
  ui.play.innerHTML = sim.playing
    ? `<span class="visually-hidden">Pause</span><span aria-hidden="true" class="icon-pause">∥</span>`
    : `<span class="visually-hidden">Play</span><span aria-hidden="true">▶</span>`;

  const plateDown = sim.plate > 0.5;
  ui.plate.setAttribute("aria-pressed", plateDown ? "true" : "false");
  ui.plate.textContent = plateDown ? "Plate" : "Naked";

  if (info.phase !== lastPhase) {
    ui.announce.textContent = `${info.title}. ${info.verse}`;
  }
  return info.phase;
}

export function bindControls(
  ui: Nodes,
  sim: Sim,
  onManual: () => void,
): void {
  ui.progress.addEventListener("input", () => {
    sim.progress = Number(ui.progress.value) / 1000;
    sim.playing = false;
    onManual();
  });
  ui.distance.addEventListener("input", () => {
    const t = Number(ui.distance.value) / 1000;
    sim.moonScale = sliderToMoonScale(t);
    onManual();
  });
  ui.impact.addEventListener("input", () => {
    sim.impact = sliderToImpact(Number(ui.impact.value) / 1000);
    onManual();
  });
  ui.play.addEventListener("click", () => {
    sim.playing = !sim.playing;
    onManual();
  });
  ui.plate.addEventListener("click", () => {
    if (sim.plateMode === "auto" || sim.plateMode === "down") {
      sim.plateMode = "up";
    } else {
      sim.plateMode = "down";
    }
    onManual();
  });
}
