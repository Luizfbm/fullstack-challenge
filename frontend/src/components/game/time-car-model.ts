import * as THREE from "three";

export function createTimeCarModel(): THREE.Group {
  const car = new THREE.Group();
  car.name = "time-car-model";

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.42, 0.92),
    metalMaterial("#cbd5e1", 0.62),
  );
  body.castShadow = true;
  body.position.y = 0.22;
  car.add(body);

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.22, 0.86),
    metalMaterial("#e5e7eb", 0.7),
  );
  hood.position.set(-0.78, 0.43, 0);
  hood.rotation.z = -0.08;
  car.add(hood);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.52, 0.78),
    new THREE.MeshStandardMaterial({
      color: "#111827",
      emissive: "#082f49",
      emissiveIntensity: 0.28,
      metalness: 0.28,
      roughness: 0.38,
    }),
  );
  cabin.position.set(0.08, 0.72, 0);
  cabin.rotation.z = -0.06;
  car.add(cabin);

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.04, 0.72),
    glassMaterial(),
  );
  windshield.position.set(-0.3, 0.83, 0);
  windshield.rotation.z = -0.72;
  car.add(windshield);

  const rearReactor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.48, 20),
    glowMaterial("#38bdf8", 0.95),
  );
  rearReactor.position.set(1.35, 0.56, 0);
  rearReactor.rotation.z = Math.PI / 2;
  car.add(rearReactor);

  const sideStripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.045, 0.04),
    glowMaterial("#f59e0b", 0.75),
  );
  sideStripe.position.set(0.18, 0.25, 0.49);
  car.add(sideStripe);

  addWheels(car, 0.68);
  addWheels(car, -0.68);
  addWingDoor(car, 0.54, 0.2);
  addWingDoor(car, -0.54, -0.2);

  car.scale.setScalar(0.78);
  return car;
}

function addWheels(car: THREE.Group, z: number) {
  for (const x of [-0.78, 0.82]) {
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.18, 28),
      new THREE.MeshStandardMaterial({
        color: "#020617",
        metalness: 0.25,
        roughness: 0.42,
      }),
    );
    tire.position.set(x, -0.02, z);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    car.add(tire);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.2, 24),
      metalMaterial("#94a3b8", 0.44),
    );
    hub.position.copy(tire.position);
    hub.rotation.x = Math.PI / 2;
    car.add(hub);
  }
}

function addWingDoor(car: THREE.Group, z: number, rotation: number) {
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.05, 0.36),
    metalMaterial("#cbd5e1", 0.7),
  );
  door.position.set(0.1, 0.96, z);
  door.rotation.set(0.15, rotation, 0.34 * Math.sign(z));
  car.add(door);
}

function metalMaterial(color: string, roughness: number) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.86,
    roughness,
  });
}

function glassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#7dd3fc",
    emissive: "#0ea5e9",
    emissiveIntensity: 0.35,
    metalness: 0.2,
    opacity: 0.56,
    roughness: 0.08,
    transparent: true,
  });
}

function glowMaterial(color: string, intensity: number) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.18,
    roughness: 0.25,
  });
}
