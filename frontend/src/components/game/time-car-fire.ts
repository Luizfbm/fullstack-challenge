import * as THREE from "three";

export function animateTimeCarFire(
  car: THREE.Object3D,
  time: number,
  enabled: boolean,
) {
  car.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !isFireDetailMesh(child)) {
      return;
    }

    const pulse = enabled ? 0.5 + Math.sin(time * 18) * 0.5 : 0;
    const flicker = enabled ? 0.5 + Math.sin(time * 31.7) * 0.5 : 0;
    const scale = enabled ? 1 + pulse * 0.08 + flicker * 0.035 : 1;

    child.scale.setScalar(scale);
    child.position.y = enabled ? Math.sin(time * 24) * 0.018 : 0;
    child.position.z = enabled ? Math.cos(time * 19) * 0.012 : 0;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) {
        return;
      }

      material.opacity = enabled ? 0.72 + pulse * 0.24 : 0.82;
      material.emissiveIntensity = enabled ? 1.1 + pulse * 0.75 : 1;
      material.needsUpdate = true;
    });
  });
}

function isFireDetailMesh(mesh: THREE.Mesh) {
  if (mesh.name.includes("Shock")) {
    return true;
  }

  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];

  return materials.some((material) => material.name.includes("Shock"));
}
