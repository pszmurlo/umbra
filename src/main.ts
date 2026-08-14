import { analyze, playbackRate } from "./eclipse";
import {
  bindUniforms,
  compileProgram,
  createGl,
  fullscreenTriangle,
  type Uniforms,
} from "./gl";
import { FRAG, VERT } from "./shaders";
import {
  bindControls,
  queryUi,
  syncHud,
  syncSliders,
  type Sim,
} from "./ui";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sim: Sim = {
  progress: 0.26,
  impact: 0.02,
  moonScale: 1.052,
  zoom: 1.12,
  plate: 1,
  plateMode: "auto",
  playing: !reducedMotion,
  time: 0,
};

function targetPlate(photosphereCovered: boolean): number {
  switch (sim.plateMode) {
    case "down":
      return 1;
    case "up":
      return 0;
    case "auto":
      return photosphereCovered ? 0 : 1;
    default: {
      const _exhaustive: never = sim.plateMode;
      return _exhaustive;
    }
  }
}

function resize(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
}

function draw(
  gl: WebGL2RenderingContext,
  uniforms: Uniforms,
  canvas: HTMLCanvasElement,
): void {
  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.time, sim.time);
  gl.uniform1f(uniforms.progress, sim.progress);
  gl.uniform1f(uniforms.impact, sim.impact);
  gl.uniform1f(uniforms.moonScale, sim.moonScale);
  gl.uniform1f(uniforms.zoom, sim.zoom);
  gl.uniform1f(uniforms.plate, sim.plate);
  gl.uniform1f(uniforms.reduced, reducedMotion ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function main(): void {
  const canvas = document.getElementById("stage");
  const fail = document.getElementById("fail");
  if (!(canvas instanceof HTMLCanvasElement) || !fail) {
    return;
  }

  let gl: WebGL2RenderingContext;
  let program: WebGLProgram;
  let vao: WebGLVertexArrayObject;
  let uniforms: Uniforms;
  try {
    gl = createGl(canvas);
    program = compileProgram(gl, VERT, FRAG);
    vao = fullscreenTriangle(gl);
    uniforms = bindUniforms(gl, program);
  } catch (error) {
    fail.hidden = false;
    fail.removeAttribute("aria-hidden");
    fail.textContent =
      error instanceof Error ? error.message : "This viewing plate needs WebGL2.";
    return;
  }
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  const ui = queryUi();
  let lastPhase = "";
  let hudClock = 0;

  const refreshHud = (): void => {
    const info = analyze(sim.progress, sim.impact, sim.moonScale);
    lastPhase = syncHud(ui, sim, info, lastPhase);
    syncSliders(ui, sim);
  };

  bindControls(ui, sim, refreshHud);
  refreshHud();

  let dragging = false;
  let lastPtr = { x: 0, y: 0 };

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    sim.playing = false;
    lastPtr = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }
    const dx = event.clientX - lastPtr.x;
    const dy = event.clientY - lastPtr.y;
    lastPtr = { x: event.clientX, y: event.clientY };
    sim.progress = Math.min(1, Math.max(0, sim.progress + dx / window.innerWidth));
    sim.impact = Math.min(0.85, Math.max(-0.85, sim.impact - dy / window.innerHeight));
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
    refreshHud();
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const next = sim.zoom * (event.deltaY > 0 ? 0.94 : 1.06);
      sim.zoom = Math.min(2.4, Math.max(0.72, next));
    },
    { passive: false },
  );

  window.addEventListener("keydown", (event) => {
    const focused = event.target;
    const inControl =
      focused instanceof HTMLInputElement || focused instanceof HTMLButtonElement;
    if (event.code === "Space") {
      if (inControl) {
        return;
      }
      event.preventDefault();
      sim.playing = !sim.playing;
      refreshHud();
      return;
    }
    if (focused instanceof HTMLInputElement) {
      return;
    }
    if (event.key === "ArrowRight") {
      sim.progress = Math.min(1, sim.progress + 0.008);
      sim.playing = false;
      refreshHud();
    } else if (event.key === "ArrowLeft") {
      sim.progress = Math.max(0, sim.progress - 0.008);
      sim.playing = false;
      refreshHud();
    } else if (event.key === "ArrowUp") {
      sim.moonScale = Math.min(1.07, sim.moonScale + 0.003);
      refreshHud();
    } else if (event.key === "ArrowDown") {
      sim.moonScale = Math.max(0.93, sim.moonScale - 0.003);
      refreshHud();
    } else if (event.key === "p" || event.key === "P") {
      ui.plate.click();
    } else if (event.key === "Home") {
      sim.progress = 0;
      sim.playing = false;
      refreshHud();
    } else if (event.key === "End") {
      sim.progress = 1;
      sim.playing = false;
      refreshHud();
    }
  });

  const curtain = document.getElementById("curtain");
  curtain?.addEventListener("animationend", () => {
    curtain.remove();
  });
  window.setTimeout(() => curtain?.remove(), 2600);
  if (reducedMotion) {
    curtain?.remove();
  }

  let last = performance.now();
  const frame = (now: number): void => {
    const rawDt = Math.min(0.25, (now - last) / 1000);
    const dt = Math.min(0.05, rawDt);
    last = now;
    sim.time += dt;
    resize(canvas, gl);

    const info = analyze(sim.progress, sim.impact, sim.moonScale);
    const plateGoal = targetPlate(info.photosphereCovered);
    sim.plate += (plateGoal - sim.plate) * (1 - Math.exp(-rawDt * 5.5));

    if (sim.playing) {
      sim.progress += dt * 0.038 * playbackRate(info);
      if (sim.progress > 1) {
        sim.progress = 0;
      }
    }

    hudClock += dt;
    if (hudClock > 0.08) {
      hudClock = 0;
      lastPhase = syncHud(ui, sim, info, lastPhase);
      ui.progress.value = String(Math.round(sim.progress * 1000));
    }

    draw(gl, uniforms, canvas);
  };

  let lastBeat = performance.now();
  const pump = (now: number): void => {
    lastBeat = now;
    frame(now);
    requestAnimationFrame(pump);
  };
  requestAnimationFrame(pump);
  window.setInterval(() => {
    const now = performance.now();
    if (now - lastBeat > 280) {
      pump(now);
    }
  }, 120);
}

main();
