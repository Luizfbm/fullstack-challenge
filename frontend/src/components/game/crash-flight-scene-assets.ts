import * as THREE from "three";
import {
  loadBlackholePortalAsset,
} from "./blackhole-portal-model";
import { disposeObject } from "./crash-flight-stage";
import {
  loadTimeCarAsset,
  TIME_CAR_ASSET_PATH,
  TIME_CAR_RUNNING_ASSET_PATH,
} from "./time-car-model";

type LoadedPortal = {
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
};

type CrashFlightAssetsInput = {
  currentPortal: THREE.Group;
  isDisposed: () => boolean;
  parkedCar: THREE.Group;
  portalRoot: THREE.Group;
  replacePortal: (loadedPortal: LoadedPortal) => void;
  runningCar: THREE.Group;
};

export function loadCrashFlightAssets({
  currentPortal,
  isDisposed,
  parkedCar,
  portalRoot,
  replacePortal,
  runningCar,
}: CrashFlightAssetsInput) {
  loadTimeCarAsset(parkedCar, TIME_CAR_ASSET_PATH, isDisposed).catch(() => {
    if (!isDisposed()) {
      parkedCar.name = "time-car-model-parked-fallback";
    }
  });

  loadTimeCarAsset(runningCar, TIME_CAR_RUNNING_ASSET_PATH, isDisposed).catch(
    () => {
      if (!isDisposed()) {
        runningCar.name = "time-car-model-running-fallback";
      }
    },
  );

  loadBlackholePortalAsset(undefined, isDisposed)
    .then((loadedPortal) => {
      if (isDisposed()) {
        disposeObject(loadedPortal.group);
        return;
      }

      portalRoot.remove(currentPortal);
      disposeObject(currentPortal);
      replacePortal(loadedPortal);
      portalRoot.add(loadedPortal.group);
    })
    .catch(() => {
      if (!isDisposed()) {
        currentPortal.name = "blackhole-portal-fallback-active";
      }
    });
}
