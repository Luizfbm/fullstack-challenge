import * as THREE from "three";

export type FlightStage = {
  engineLight: THREE.PointLight;
  group: THREE.Group;
  redFlash: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  road: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
};

export function createFlightStage(): FlightStage {
  const group = new THREE.Group();
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 1.42),
    new THREE.MeshStandardMaterial({
      color: "#16202c",
      metalness: 0.1,
      opacity: 0.62,
      roughness: 0.8,
      transparent: true,
    }),
  );
  const grid = new THREE.GridHelper(7.5, 20, "#5eead4", "#334155");
  const redFlash = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 5),
    new THREE.MeshBasicMaterial({
      color: "#fb7185",
      opacity: 0,
      transparent: true,
    }),
  );
  const engineLight = new THREE.PointLight("#38bdf8", 1.2, 5.4);

  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -1.08, -0.1);
  road.receiveShadow = true;
  grid.position.set(0, -1.05, -0.2);
  updateGridMaterial(grid);
  redFlash.position.set(0, 0.38, -1.7);
  engineLight.position.set(-1.65, -0.36, 0.25);

  group.add(createStars(), createLights(), road, grid, redFlash, engineLight);

  return { engineLight, group, redFlash, road };
}

export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.Line ||
      child instanceof THREE.Points
    ) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}

function createLights() {
  const group = new THREE.Group();
  const key = new THREE.DirectionalLight("#e0f2fe", 2.1);
  const rim = new THREE.DirectionalLight("#f59e0b", 1.1);
  const fill = new THREE.HemisphereLight("#67e8f9", "#020617", 1.9);

  key.position.set(-2.2, 4.4, 4);
  rim.position.set(3.5, 1.7, 2);
  group.add(key, rim, fill);

  return group;
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = Array.from({ length: 96 }, (_, index) => {
    const column = (index % 24) / 23;
    const row = Math.floor(index / 24) / 3;

    return [
      -3.8 + column * 7.6,
      -0.2 + row * 3.2 + Math.sin(index) * 0.16,
      -2.8 - (index % 7) * 0.32,
    ];
  }).flat();
  const material = new THREE.PointsMaterial({
    color: "#bae6fd",
    opacity: 0.38,
    size: 0.025,
    transparent: true,
  });

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  return new THREE.Points(geometry, material);
}

function updateGridMaterial(grid: THREE.GridHelper) {
  const materials = Array.isArray(grid.material)
    ? grid.material
    : [grid.material];

  materials.forEach((material) => {
    material.opacity = 0.2;
    material.transparent = true;
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
}
