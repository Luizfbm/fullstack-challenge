import * as THREE from "three";

const POINT_COUNT = 72;

export type GrowthTrail = {
  core: THREE.Line;
  glow: THREE.Line;
  group: THREE.Group;
};

export function createGrowthTrail(): GrowthTrail {
  const group = new THREE.Group();
  const core = createLine("#d6dee9", 2.4, 0.88);
  const glow = createLine("#7dd3fc", 7.5, 0.28);

  group.add(glow, core);
  updateGrowthTrail({ core, glow, group }, 0.02, false);

  return { core, glow, group };
}

export function updateGrowthTrail(
  trail: GrowthTrail,
  progress: number,
  crashed: boolean,
) {
  const visibleProgress = Math.max(0.02, Math.min(1, progress));
  const points = Array.from({ length: POINT_COUNT }, (_, index) => {
    const unit = index / (POINT_COUNT - 1);
    const t = unit * visibleProgress;
    const lift = Math.pow(t, 1.36);
    const wave = Math.sin(t * Math.PI * 3.2) * 0.05 * visibleProgress;

    return new THREE.Vector3(
      -2.36 + t * 4.58,
      -0.92 + lift * 2.52 + wave,
      -0.58 - t * 0.52,
    );
  });

  trail.core.geometry.setFromPoints(points);
  trail.glow.geometry.setFromPoints(points);
  setTrailColor(trail.core, crashed ? "#fb7185" : "#d6dee9");
  setTrailColor(trail.glow, crashed ? "#fb7185" : "#7dd3fc");
}

function createLine(color: string, width: number, opacity: number): THREE.Line {
  const material = new THREE.LineBasicMaterial({
    color,
    linewidth: width,
    opacity,
    transparent: true,
  });
  const line = new THREE.Line(new THREE.BufferGeometry(), material);

  line.renderOrder = width;

  return line;
}

function setTrailColor(line: THREE.Line, color: string) {
  const material = line.material;

  if (Array.isArray(material)) {
    return;
  }

  (material as THREE.LineBasicMaterial).color.set(color);
}
