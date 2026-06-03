import * as THREE from "three";

export type TimeCarTrailFrame = {
  axisRevealProgress: number;
  carPosition: [number, number, number];
  displayMultiplier?: number;
  elapsedSeconds: number;
  height: number;
  intensity: number;
  multiplier: number;
  progress: number;
  tone: "boost" | "crash";
  visible: boolean;
  width: number;
};

export type TimeCarTrail = {
  axisLabels: THREE.Group;
  axisReveal: THREE.Group;
  axisTicks: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  curve: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  currentMultiplierGuide: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  currentMultiplierLabel: THREE.Sprite;
  group: THREE.Group;
  multiplierPillar: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  ribbon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  timeAxis: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
};

type TimeCarTrailUpdateInput = {
  camera: THREE.PerspectiveCamera;
  reducedMotion: boolean;
  time: number;
  trail: TimeCarTrailFrame;
};

export type TimeCarTrailUpdateResult = {
  carAnchor: [number, number, number];
  edgeHoldProgress: number;
  tangentAngle: number;
};

type AxisFrame = {
  multiplierMax: number;
  multiplierProgress: number;
  multiplierTicks: Array<{ label: string; value: number }>;
  timeMax: number;
  timeProgress: number;
  timeTicks: Array<{ label: string; value: number }>;
};

const CURVE_SEGMENTS = 24;
const PARTICLE_COUNT = 28;
const BOOST_COLOR = new THREE.Color("#22d3ee");
const BOOST_FILL_COLOR = new THREE.Color("#14b8a6");
const BOOST_PARTICLE_COLOR = new THREE.Color("#34d399");
const CRASH_COLOR = new THREE.Color("#fb7185");
const CRASH_FILL_COLOR = new THREE.Color("#f43f5e");
const CRASH_PARTICLE_COLOR = new THREE.Color("#f472b6");
const HUD_DISTANCE = 3.45;
const BASE_TIME_AXIS_SECONDS = 10;
const EDGE_HOLD_GROWTH_SECONDS = 16;
const INITIAL_MULTIPLIER_AXIS_MAX = 2.5;
const AXIS_CURRENT_MAX_PROGRESS = 0.9;
const CURVE_GROWTH_EXPONENT = 3.1;
const Y_AXIS_TICKS = [
  { label: "1×", value: 0 },
  { label: "1.50×", value: 1 / 3 },
  { label: "2×", value: 2 / 3 },
  { label: "2.50×", value: 1 },
] as const;
const X_AXIS_TICKS = [
  { label: "0s", value: 0 },
  { label: "5s", value: 0.5 },
  { label: "10s", value: 1 },
] as const;
const AXIS_SEGMENTS = 2 + Y_AXIS_TICKS.length + X_AXIS_TICKS.length;

export function createTimeCarTrail(): TimeCarTrail {
  const group = new THREE.Group();
  const axisReveal = new THREE.Group();
  const ribbon = createGrowthArea();
  const curve = createGrowthCurve();
  const timeAxis = createTimeAxis();
  const axisTicks = createAxisTicks();
  const axisLabels = createAxisLabels();
  const currentMultiplierGuide = createCurrentMultiplierGuide();
  const currentMultiplierLabel = createCurrentMultiplierLabel();
  const multiplierPillar = createMultiplierPillar();
  const particles = createGrowthParticles();

  group.name = "time-car-growth-guide";
  axisReveal.name = "time-car-growth-guide-axis-reveal";
  group.visible = false;
  axisReveal.add(
    ribbon,
    curve,
    timeAxis,
    axisTicks,
    multiplierPillar,
    currentMultiplierGuide,
    particles,
    axisLabels,
    currentMultiplierLabel,
  );
  group.add(axisReveal);

  return {
    axisLabels,
    axisReveal,
    axisTicks,
    curve,
    currentMultiplierGuide,
    currentMultiplierLabel,
    group,
    multiplierPillar,
    particles,
    ribbon,
    timeAxis,
  };
}

export function updateTimeCarTrail(
  trail: TimeCarTrail,
  input: TimeCarTrailUpdateInput,
): TimeCarTrailUpdateResult | null {
  const frame = normalizeFrame(input.trail);

  trail.group.visible = frame.visible && frame.intensity > 0;

  if (!trail.group.visible) {
    return null;
  }

  const hud = getHudFrame(input.camera, frame);
  const displayFrame = {
    ...frame,
    height: hud.height,
    width: hud.width,
  };
  const displayInput = {
    ...input,
    trail: displayFrame,
  };
  const axis = getAxisFrame(displayFrame);

  trail.group.position.set(hud.x, hud.y, hud.z);
  trail.group.rotation.set(0, 0, 0);
  updateAxisReveal(trail.axisReveal, displayFrame);
  updateTimeAxis(trail.timeAxis, displayFrame, axis);
  updateAxisTicks(trail.axisTicks, displayFrame, axis);
  updateAxisLabels(trail.axisLabels, displayFrame, axis);
  updateMultiplierPillar(trail.multiplierPillar, displayFrame, axis);
  updateCurveGeometry(trail.curve.geometry, axis, displayInput);
  updateAreaGeometry(trail.ribbon.geometry, axis, displayInput);
  updateParticleGeometry(trail.particles.geometry, axis, displayInput);
  updateTrailMaterials(trail, displayFrame);
  updateCurrentMultiplierIndicator(trail, displayFrame, axis, displayInput);

  return getTrailCarAnchor(trail, axis, displayInput);
}

function createGrowthArea() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((CURVE_SEGMENTS + 1) * 2 * 3);
  const indices = Array.from({ length: CURVE_SEGMENTS }, (_, index) => {
    const base = index * 2;

    return [base, base + 1, base + 2, base + 1, base + 3, base + 2];
  }).flat();
  const material = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_FILL_COLOR,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const ribbon = new THREE.Mesh(geometry, material);

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  ribbon.name = "time-car-growth-guide-area";
  ribbon.renderOrder = 3;

  return ribbon;
}

function createGrowthCurve() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((CURVE_SEGMENTS + 1) * 3);
  const material = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_COLOR,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const curve = new THREE.Line(geometry, material);

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  curve.name = "time-car-growth-guide-curve";
  curve.renderOrder = 5;

  return curve;
}

function createTimeAxis() {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: "#bae6fd",
    depthTest: false,
    depthWrite: false,
    opacity: 0.26,
    transparent: true,
  });
  const axis = new THREE.Line(geometry, material);

  geometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)]);
  axis.name = "time-car-growth-guide-time-axis";
  axis.position.x = 0;
  axis.renderOrder = 4;

  return axis;
}

function createAxisTicks() {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: "#93c5fd",
    depthTest: false,
    depthWrite: false,
    opacity: 0.34,
    transparent: true,
  });
  const ticks = new THREE.LineSegments(geometry, material);

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(AXIS_SEGMENTS * 2 * 3), 3),
  );
  ticks.name = "time-car-growth-guide-axis-ticks";
  ticks.renderOrder = 6;

  return ticks;
}

function createAxisLabels() {
  const labels = new THREE.Group();

  labels.name = "time-car-growth-guide-axis-labels";

  for (const tick of Y_AXIS_TICKS) {
    labels.add(createAxisLabelSprite(tick.label));
  }

  for (const tick of X_AXIS_TICKS) {
    labels.add(createAxisLabelSprite(tick.label));
  }

  return labels;
}

function createCurrentMultiplierGuide() {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: "#bae6fd",
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const guide = new THREE.Line(geometry, material);

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(2 * 3), 3),
  );
  guide.name = "time-car-growth-guide-current-multiplier-guide";
  guide.renderOrder = 7;

  return guide;
}

function createCurrentMultiplierLabel() {
  const label = createAxisLabelSprite("1×");

  label.name = "time-car-growth-guide-current-multiplier-label";
  label.renderOrder = 9;

  return label;
}

function createAxisLabelSprite(label: string) {
  const material = new THREE.SpriteMaterial({
    color: "#e0f2fe",
    depthTest: false,
    depthWrite: false,
    opacity: 0.78,
    transparent: true,
  });
  const texture = createLabelTexture(label);

  if (texture) {
    material.map = texture;
    material.color.set("#ffffff");
  }

  const sprite = new THREE.Sprite(material);

  sprite.name = `time-car-growth-guide-label-${label}`;
  sprite.userData.labelText = label;
  sprite.renderOrder = 8;

  return sprite;
}

function updateAxisLabelSprite(sprite: THREE.Sprite, label: string) {
  if (sprite.userData.labelText === label) {
    return;
  }

  const material = sprite.material as THREE.SpriteMaterial;
  const previousTexture = material.map;

  sprite.name = `time-car-growth-guide-label-${label}`;
  sprite.userData.labelText = label;
  material.map = createLabelTexture(label);

  if (material.map) {
    material.color.set("#ffffff");
  }

  previousTexture?.dispose();
  material.needsUpdate = true;
}

function createLabelTexture(label: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  const context = getCanvasContext(canvas);

  if (!context) {
    return null;
  }

  const scale = 2;
  const width = 96;
  const height = 36;

  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);
  context.clearRect(0, 0, width, height);
  context.font = "700 20px 'Fira Code', 'Share Tech Mono', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 5;
  context.strokeStyle = "rgba(2, 6, 23, 0.92)";
  context.fillStyle = "rgba(224, 242, 254, 0.94)";
  context.strokeText(label, width / 2, height / 2);
  context.fillText(label, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);

  texture.generateMipmaps = false;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

function createMultiplierPillar() {
  const material = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_COLOR,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const pillar = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1), material);

  pillar.name = "time-car-growth-guide-multiplier-pillar";
  pillar.position.x = -0.14;
  pillar.renderOrder = 4;
  pillar.visible = false;

  return pillar;
}

function createGrowthParticles() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const material = new THREE.PointsMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_PARTICLE_COLOR,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    size: 0.045,
    sizeAttenuation: true,
    transparent: true,
  });
  const particles = new THREE.Points(geometry, material);

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particles.name = "time-car-growth-guide-particles";
  particles.renderOrder = 6;

  return particles;
}

function updateAxisReveal(axisReveal: TimeCarTrail["axisReveal"], frame: TimeCarTrailFrame) {
  const progress = easeOutCubic(frame.axisRevealProgress);
  const offset = 1 - progress;

  axisReveal.position.set(-0.34 * offset, -0.22 * offset, 0);
  axisReveal.scale.set(0.88 + progress * 0.12, 0.88 + progress * 0.12, 1);
}

function updateTimeAxis(
  timeAxis: TimeCarTrail["timeAxis"],
  frame: TimeCarTrailFrame,
  axis: AxisFrame,
) {
  const position = timeAxis.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;

  position.setXYZ(0, 0, 0, 0);
  position.setXYZ(1, frame.width, 0, 0);
  position.needsUpdate = true;
  timeAxis.geometry.computeBoundingSphere();
}

function updateAxisTicks(
  axisTicks: TimeCarTrail["axisTicks"],
  frame: TimeCarTrailFrame,
  axis: AxisFrame,
) {
  const position = axisTicks.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  let point = 0;

  point = setSegment(position, point, 0, 0, 0, frame.width, 0, 0);
  point = setSegment(
    position,
    point,
    0,
    0,
    0,
    0,
    frame.height,
    0,
  );

  for (const tick of axis.timeTicks) {
    const x = tick.value * frame.width;

    point = setSegment(
      position,
      point,
      x,
      -0.035,
      0,
      x,
      tick.value <= axis.timeProgress ? 0.08 : -0.035,
      0,
    );
  }

  for (const tick of axis.multiplierTicks) {
    const y = tick.value * frame.height;

    point = setSegment(
      position,
      point,
      -0.045,
      y,
      0,
      tick.value <= axis.multiplierProgress ? 0.1 : -0.045,
      y,
      0,
    );
  }

  position.needsUpdate = true;
  axisTicks.geometry.computeBoundingSphere();
}

function updateAxisLabels(
  axisLabels: TimeCarTrail["axisLabels"],
  frame: TimeCarTrailFrame,
  axis: AxisFrame,
) {
  let labelIndex = 0;

  for (const tick of axis.multiplierTicks) {
    const label = axisLabels.children[labelIndex] as THREE.Sprite;

    updateAxisLabelSprite(label, tick.label);
    label.position.set(0.2, tick.value * frame.height, 0.055);
    label.scale.set(0.34, 0.09, 1);
    labelIndex += 1;
  }

  for (const tick of axis.timeTicks) {
    const label = axisLabels.children[labelIndex] as THREE.Sprite;

    updateAxisLabelSprite(label, tick.label);
    label.position.set(tick.value * frame.width, -0.13, 0.055);
    label.scale.set(0.26, 0.09, 1);
    labelIndex += 1;
  }
}

function updateMultiplierPillar(
  pillar: TimeCarTrail["multiplierPillar"],
  _frame: TimeCarTrailFrame,
  _axis: AxisFrame,
) {
  const material = pillar.material as THREE.MeshBasicMaterial;

  pillar.visible = false;
  material.opacity = 0;
  material.needsUpdate = true;
}

function updateCurrentMultiplierIndicator(
  trail: TimeCarTrail,
  frame: TimeCarTrailFrame,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
) {
  const point = getCurvePoint(1, axis, input);
  const guidePosition = trail.currentMultiplierGuide.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  const guideMaterial = trail.currentMultiplierGuide.material as THREE.LineBasicMaterial;
  const labelMaterial = trail.currentMultiplierLabel.material as THREE.SpriteMaterial;
  const boost = frame.tone === "boost";

  guidePosition.setXYZ(0, 0, point.y, 0.058);
  guidePosition.setXYZ(1, point.x, point.y, 0.058);
  guidePosition.needsUpdate = true;
  trail.currentMultiplierGuide.geometry.computeBoundingSphere();

  updateAxisLabelSprite(
    trail.currentMultiplierLabel,
    formatMultiplierTick(frame.displayMultiplier ?? frame.multiplier),
  );
  trail.currentMultiplierLabel.position.set(0.24, point.y, 0.08);
  trail.currentMultiplierLabel.scale.set(0.42, 0.115, 1);

  guideMaterial.color.set(boost ? "#bae6fd" : "#fecdd3");
  guideMaterial.opacity = boost ? 0.2 + frame.intensity * 0.14 : 0.24;
  guideMaterial.needsUpdate = true;

  labelMaterial.color.set(boost ? "#ffffff" : "#fff1f2");
  labelMaterial.opacity = boost ? 0.96 : 0.9;
  labelMaterial.needsUpdate = true;
}

function updateCurveGeometry(
  geometry: THREE.BufferGeometry,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;

  for (let index = 0; index <= CURVE_SEGMENTS; index += 1) {
    const t = getVisibleT(index / CURVE_SEGMENTS, input.trail.progress);
    const point = getCurvePoint(t, axis, input);

    position.setXYZ(index, point.x, point.y, 0.06);
  }

  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function updateAreaGeometry(
  geometry: THREE.BufferGeometry,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;

  for (let index = 0; index <= CURVE_SEGMENTS; index += 1) {
    const t = getVisibleT(index / CURVE_SEGMENTS, input.trail.progress);
    const point = getCurvePoint(t, axis, input);
    const glowWidth =
      0.058 + Math.sin(t * Math.PI) * 0.09 + Math.pow(t, 1.35) * 0.034;
    const vertex = index * 2;

    position.setXYZ(vertex, point.x, point.y + glowWidth * 0.18, 0.025);
    position.setXYZ(vertex + 1, point.x, Math.max(0, point.y - glowWidth), 0.025);
  }

  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function updateParticleGeometry(
  geometry: THREE.BufferGeometry,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const motion = input.reducedMotion ? 0 : input.time * 1.2;

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const lane = index / Math.max(1, PARTICLE_COUNT - 1);
    const t = getVisibleT(lane, input.trail.progress);
    const jitter = input.reducedMotion
      ? 0
      : Math.sin(motion + index * 1.73) * 0.018;
    const point = getCurvePoint(t, axis, input);
    const z = 0.08 + hash(index) * 0.028;

    position.setXYZ(index, point.x, point.y + jitter, z);
  }

  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function updateTrailMaterials(trail: TimeCarTrail, frame: TimeCarTrailFrame) {
  const boost = frame.tone === "boost";
  const curveMaterial = trail.curve.material as THREE.LineBasicMaterial;
  const ribbonMaterial = trail.ribbon.material as THREE.MeshBasicMaterial;
  const particleMaterial = trail.particles.material as THREE.PointsMaterial;
  const tickMaterial = trail.axisTicks.material as THREE.LineBasicMaterial;
  const timeMaterial = trail.timeAxis.material as THREE.LineBasicMaterial;

  curveMaterial.color.copy(boost ? BOOST_COLOR : CRASH_COLOR);
  curveMaterial.opacity = Math.min(0.86, 0.24 + frame.intensity * 0.56);
  curveMaterial.needsUpdate = true;

  ribbonMaterial.color.copy(boost ? BOOST_FILL_COLOR : CRASH_FILL_COLOR);
  ribbonMaterial.opacity = Math.min(0.3, 0.07 + frame.intensity * 0.2);
  ribbonMaterial.needsUpdate = true;

  particleMaterial.color.copy(boost ? BOOST_PARTICLE_COLOR : CRASH_PARTICLE_COLOR);
  particleMaterial.opacity = Math.min(0.68, 0.14 + frame.intensity * 0.46);
  particleMaterial.size = boost ? 0.042 : 0.055;
  particleMaterial.needsUpdate = true;

  timeMaterial.opacity = boost ? 0.24 + frame.intensity * 0.18 : 0.18;
  timeMaterial.needsUpdate = true;

  tickMaterial.color.set(boost ? "#93c5fd" : "#fda4af");
  tickMaterial.opacity = boost ? 0.34 : 0.28;
  tickMaterial.needsUpdate = true;

  for (const label of trail.axisLabels.children) {
    const material = (label as THREE.Sprite).material as THREE.SpriteMaterial;

    material.color.set(boost ? "#ffffff" : "#fff1f2");
    material.opacity = boost ? 0.82 : 0.76;
    material.needsUpdate = true;
  }
}

function getHudFrame(camera: THREE.PerspectiveCamera, frame: TimeCarTrailFrame) {
  const distance = HUD_DISTANCE;
  const visibleHeight =
    2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance;
  const visibleWidth = visibleHeight * camera.aspect;
  const compact = camera.aspect < 0.82;
  const marginX = compact ? 0.2 : 0.18;
  const bottomMargin = compact ? 0.28 : 0.24;
  const topMargin = compact ? 0.22 : 0.18;

  return {
    x: -visibleWidth / 2 + marginX,
    y: -visibleHeight / 2 + bottomMargin,
    z: -distance,
    width: Math.max(frame.width, visibleWidth - marginX * 2),
    height: Math.max(frame.height, visibleHeight - bottomMargin - topMargin),
  };
}

function getCurvePoint(
  t: number,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
) {
  const pulse = input.reducedMotion
    ? 0
    : Math.sin(t * Math.PI) * Math.sin(input.time * 5.2) * 0.024;
  const growth = Math.pow(t, CURVE_GROWTH_EXPONENT);

  return {
    x: input.trail.width * axis.timeProgress * t,
    y: input.trail.height * axis.multiplierProgress * growth + pulse,
  };
}

function getTrailCarAnchor(
  trail: TimeCarTrail,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
): TimeCarTrailUpdateResult {
  const endpoint = getCurvePoint(1, axis, input);
  const previous = getCurvePoint(0.94, axis, input);
  const revealScaleX = trail.axisReveal.scale.x;
  const revealScaleY = trail.axisReveal.scale.y;
  const deltaX = (endpoint.x - previous.x) * revealScaleX;
  const deltaY = (endpoint.y - previous.y) * revealScaleY;

  return {
    carAnchor: [
      trail.group.position.x +
        trail.axisReveal.position.x +
        endpoint.x * revealScaleX,
      trail.group.position.y +
        trail.axisReveal.position.y +
        endpoint.y * revealScaleY,
      trail.group.position.z + trail.axisReveal.position.z + 0.14,
    ],
    edgeHoldProgress: getEdgeHoldProgress(input.trail.elapsedSeconds),
    tangentAngle: Math.atan2(deltaY, Math.max(0.001, deltaX)),
  };
}

function getAxisFrame(frame: TimeCarTrailFrame): AxisFrame {
  const multiplier = Math.max(1, frame.multiplier);
  const elapsedSeconds = Math.max(0, frame.elapsedSeconds);
  const multiplierMax = getMultiplierAxisMax(multiplier);
  const timeMax = getTimeAxisMax(elapsedSeconds);

  return {
    multiplierMax,
    multiplierProgress: getMultiplierAxisValue(multiplier, multiplierMax),
    multiplierTicks: getMultiplierTicks(multiplierMax),
    timeMax,
    timeProgress: getTimeAxisValue(elapsedSeconds, timeMax),
    timeTicks: getTimeTicks(elapsedSeconds, timeMax),
  };
}

function getMultiplierTicks(multiplierMax: number) {
  const topMultiplier = multiplierMax;

  return Y_AXIS_TICKS.map((tick) => {
    const multiplier = getMultiplierTickValue(topMultiplier, tick.value);

    return {
      label: formatMultiplierTick(multiplier),
      value: getMultiplierAxisValue(multiplier, topMultiplier),
    };
  });
}

function getTimeTicks(elapsedSeconds: number, timeMax: number) {
  if (elapsedSeconds < 1) {
    return [
      { label: "0s", value: 0 },
      {
        label: `${Math.ceil(BASE_TIME_AXIS_SECONDS / 2)}s`,
        value: getTimeAxisValue(BASE_TIME_AXIS_SECONDS / 2, timeMax),
      },
      {
        label: `${BASE_TIME_AXIS_SECONDS}s`,
        value: getTimeAxisValue(BASE_TIME_AXIS_SECONDS, timeMax),
      },
    ];
  }

  const currentSecond = Math.floor(elapsedSeconds);
  const axisMaxSecond = Math.ceil(timeMax);

  return [
    { label: "0s", value: 0 },
    {
      label:
        currentSecond >= BASE_TIME_AXIS_SECONDS ? "5s" : `${currentSecond}s`,
      value:
        currentSecond >= BASE_TIME_AXIS_SECONDS
          ? getTimeAxisValue(BASE_TIME_AXIS_SECONDS / 2, timeMax)
          : getTimeAxisValue(currentSecond, timeMax),
    },
    {
      label: `${
        currentSecond >= BASE_TIME_AXIS_SECONDS ? axisMaxSecond : BASE_TIME_AXIS_SECONDS
      }s`,
      value: getTimeAxisValue(
        currentSecond >= BASE_TIME_AXIS_SECONDS ? axisMaxSecond : BASE_TIME_AXIS_SECONDS,
        timeMax,
      ),
    },
  ];
}

function getMultiplierAxisMax(multiplier: number) {
  return Math.max(
    INITIAL_MULTIPLIER_AXIS_MAX,
    1 + (multiplier - 1) / AXIS_CURRENT_MAX_PROGRESS,
  );
}

function getTimeAxisMax(elapsedSeconds: number) {
  if (elapsedSeconds <= BASE_TIME_AXIS_SECONDS) {
    return BASE_TIME_AXIS_SECONDS / AXIS_CURRENT_MAX_PROGRESS;
  }

  return elapsedSeconds / AXIS_CURRENT_MAX_PROGRESS;
}

function formatMultiplierTick(multiplier: number) {
  const displayMultiplier = floorMultiplierForAxis(multiplier);

  return Number.isInteger(displayMultiplier)
    ? `${displayMultiplier.toFixed(0)}×`
    : `${displayMultiplier.toFixed(2)}×`;
}

function getTimeAxisValue(elapsedSeconds: number, timeMax: number) {
  const seconds = Math.max(0, elapsedSeconds);

  return clamp01(seconds / Math.max(1, timeMax));
}

function getMultiplierAxisValue(multiplier: number, multiplierMax: number) {
  const displayMultiplier = Math.max(1, multiplier);
  const displayMax = Math.max(1.01, floorMultiplierForAxis(multiplierMax));

  return clamp01((displayMultiplier - 1) / (displayMax - 1));
}

function getMultiplierTickValue(multiplierMax: number, progress: number) {
  const displayMax = Math.max(
    INITIAL_MULTIPLIER_AXIS_MAX,
    floorMultiplierForAxis(multiplierMax),
  );

  return floorMultiplierForAxis(1 + (displayMax - 1) * progress);
}

function floorMultiplierForAxis(multiplier: number) {
  return Math.floor(Math.max(1, multiplier) * 100) / 100;
}

function getEdgeHoldProgress(elapsedSeconds: number) {
  return clamp01(
    (Math.max(0, elapsedSeconds) - BASE_TIME_AXIS_SECONDS) /
      EDGE_HOLD_GROWTH_SECONDS,
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function setSegment(
  position: THREE.BufferAttribute,
  point: number,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
) {
  position.setXYZ(point, startX, startY, startZ);
  position.setXYZ(point + 1, endX, endY, endZ);

  return point + 2;
}

function getVisibleT(t: number, _progress: number) {
  return Math.min(1, Math.max(0, t));
}

function normalizeFrame(frame: TimeCarTrailFrame): TimeCarTrailFrame {
  return {
    ...frame,
    axisRevealProgress: clamp01(frame.axisRevealProgress),
    displayMultiplier: Math.max(1, frame.displayMultiplier ?? frame.multiplier),
    elapsedSeconds: Math.max(0, frame.elapsedSeconds),
    height: Math.max(0.04, frame.height),
    intensity: Math.min(1, Math.max(0, frame.intensity)),
    multiplier: Math.max(1, frame.multiplier),
    progress: Math.min(1, Math.max(0, frame.progress)),
    width: Math.max(0.2, frame.width),
  };
}

function hash(index: number) {
  return Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
}
