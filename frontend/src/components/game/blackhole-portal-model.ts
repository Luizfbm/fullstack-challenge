import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { disposeObject } from "./crash-flight-stage";

export const BLACKHOLE_PORTAL_ASSET_PATH =
  "/models/blackhole_pixel_pass_3.glb";
export const BLACKHOLE_PORTAL_ASSET_ROTATION_X = Math.PI / 2;
export const BLACKHOLE_PORTAL_ASSET_ROTATION_Z = 0;
const BLACKHOLE_PORTAL_TARGET_DIAMETER = 2.9;

export type LoadedBlackholePortal = {
  actions: THREE.AnimationAction[];
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
};

export function createBlackholePortalFallback(): THREE.Group {
  const group = new THREE.Group();
  group.name = "blackhole-portal-fallback";

  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.08, 12, 72),
    glowMaterial("#38bdf8", 0.78),
  );
  const middle = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.045, 10, 64),
    glowMaterial("#a855f7", 0.66),
  );
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 48),
    new THREE.MeshBasicMaterial({
      color: "#020617",
      opacity: 0.84,
      transparent: true,
    }),
  );

  outer.rotation.x = Math.PI / 2;
  middle.rotation.x = Math.PI / 2;
  core.rotation.x = -Math.PI / 2;
  group.add(outer, middle, core);

  return group;
}

export function normalizeBlackholePortalForScene(model: THREE.Object3D) {
  model.rotation.set(
    BLACKHOLE_PORTAL_ASSET_ROTATION_X,
    0,
    BLACKHOLE_PORTAL_ASSET_ROTATION_Z,
  );

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const diameter = Math.max(size.x, size.z, 0.001);
  const scale = BLACKHOLE_PORTAL_TARGET_DIAMETER / diameter;

  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
}

export async function loadBlackholePortalAsset(
  assetPath = BLACKHOLE_PORTAL_ASSET_PATH,
  isCancelled = () => false,
): Promise<LoadedBlackholePortal> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(assetPath);
  const group = new THREE.Group();
  const model = gltf.scene;

  group.name = "blackhole-portal-model";
  model.name = "blackhole-portal-glb-model";
  prepareBlackholePortalMaterialsForScene(model);
  normalizeBlackholePortalForScene(model);

  if (isCancelled()) {
    disposeObject(model);
    return { actions: [], group: createBlackholePortalFallback(), mixer: null };
  }

  group.add(model);

  const mixer = gltf.animations.length
    ? new THREE.AnimationMixer(model)
    : null;
  const actions =
    mixer?.clipAction
      ? gltf.animations.map((clip) => {
          const action = mixer.clipAction(clip);

          action.play();
          return action;
        })
      : [];

  return { actions, group, mixer };
}

export function updateBlackholePortal(
  portal: THREE.Object3D,
  input: {
    crashImpact: number;
    entering: boolean;
    phaseElapsed: number;
    reducedMotion: boolean;
    time: number;
    visible: boolean;
  },
) {
  portal.visible = input.visible;

  if (!input.visible) {
    return;
  }

  const idlePulse = input.reducedMotion
    ? 1
    : 1 + Math.sin(input.time * 1.8) * 0.025;
  const enteringScale = input.entering
    ? 1 + Math.min(1, input.phaseElapsed / 1.4) * 0.28
    : 1;
  const crashScale = 1 + input.crashImpact * 0.08;

  portal.scale.setScalar(idlePulse * enteringScale * crashScale);
  portal.rotation.z = input.reducedMotion
    ? portal.rotation.z
    : input.time * 0.18;
}

export function prepareBlackholePortalMaterialsForScene(model: THREE.Object3D) {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = false;
    child.receiveShadow = false;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((material) => {
      material.transparent = true;

      if (material instanceof THREE.MeshStandardMaterial) {
        if (material.name.startsWith("Blackhole_")) {
          material.color.set("#ffffff");
          material.emissive.set("#ffffff");
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 1);
        } else {
          material.emissive.copy(material.color);
          material.emissiveIntensity = Math.max(
            material.emissiveIntensity,
            0.18,
          );
        }

        material.roughness = Math.min(material.roughness, 0.46);
      }
    });
  });
}

function glowMaterial(color: string, opacity: number) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.7,
    opacity,
    roughness: 0.28,
    transparent: true,
  });
}
