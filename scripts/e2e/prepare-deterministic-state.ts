import {
  DETERMINISTIC_ROUND_FIXTURES,
  type DeterministicRoundScenario,
  ensureStackIsHealthy,
  extendBettingRound,
  getRoundCrashPointBp,
  prepareDeterministicRound,
  withE2ELock,
} from "../../services/games/tests/e2e/e2e-helpers";

const scenarios = Object.keys(
  DETERMINISTIC_ROUND_FIXTURES,
) as DeterministicRoundScenario[];
const scenario = parseScenario(Bun.argv[2]);
const extendedBettingWindowMs = parsePositiveIntegerEnv(
  process.env.E2E_PREPARE_BETTING_WINDOW_MS,
);

await withE2ELock(async () => {
  await ensureStackIsHealthy();

  const round = await prepareDeterministicRound(scenario);

  if (extendedBettingWindowMs !== null) {
    await extendBettingRound(round.id, extendedBettingWindowMs);
  }

  const crashPointBp = await getRoundCrashPointBp(round.id);

  console.log(
    JSON.stringify(
      {
        crashPointBp,
        multiplier: (crashPointBp / 10000).toFixed(2),
        roundId: round.id,
        scenario,
        status: round.status,
        chainIndex: round.chainIndex,
        extendedBettingWindowMs,
      },
      null,
      2,
    ),
  );
});

function parseScenario(value: string | undefined): DeterministicRoundScenario {
  if (!value) {
    return "clean-betting";
  }

  if (scenarios.includes(value as DeterministicRoundScenario)) {
    return value as DeterministicRoundScenario;
  }

  throw new Error(
    `Invalid scenario "${value}". Expected one of: ${scenarios.join(", ")}`,
  );
}

function parsePositiveIntegerEnv(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("E2E_PREPARE_BETTING_WINDOW_MS must be a positive integer");
  }

  return parsed;
}
