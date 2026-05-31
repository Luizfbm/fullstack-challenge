import {
  DETERMINISTIC_ROUND_FIXTURES,
  type DeterministicRoundScenario,
  ensureStackIsHealthy,
  getRoundCrashPointBp,
  prepareDeterministicRound,
  withE2ELock,
} from "../../services/games/tests/e2e/e2e-helpers";

const scenarios = Object.keys(
  DETERMINISTIC_ROUND_FIXTURES,
) as DeterministicRoundScenario[];
const scenario = parseScenario(Bun.argv[2]);

await withE2ELock(async () => {
  await ensureStackIsHealthy();

  const round = await prepareDeterministicRound(scenario);
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
