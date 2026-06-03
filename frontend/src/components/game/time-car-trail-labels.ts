import * as THREE from "three";
import { X_AXIS_TICKS, Y_AXIS_TICKS } from "./time-car-trail-constants";

export function createAxisLabels() {
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

export function createAxisLabelSprite(label: string) {
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

export function updateAxisLabelSprite(sprite: THREE.Sprite, label: string) {
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
