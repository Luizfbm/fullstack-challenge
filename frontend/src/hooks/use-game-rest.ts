import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  gameApi,
  type LeaderboardPeriod,
  type PlaceBetInput,
} from "../services/game-api";
import { walletApi } from "../services/wallet-api";

export const gameQueryKeys = {
  all: ["game"] as const,
  currentRound: () => [...gameQueryKeys.all, "current-round"] as const,
  history: (limit: number) => [...gameQueryKeys.all, "history", limit] as const,
  leaderboard: (period: LeaderboardPeriod, limit: number) =>
    [...gameQueryKeys.all, "leaderboard", period, limit] as const,
  myBets: (limit: number) => [...gameQueryKeys.all, "my-bets", limit] as const,
  verifyRound: (roundId: string) =>
    [...gameQueryKeys.all, "verify-round", roundId] as const,
};

export const walletQueryKeys = {
  all: ["wallet"] as const,
  me: () => [...walletQueryKeys.all, "me"] as const,
};

export function useCurrentRoundQuery() {
  return useQuery({
    queryFn: () => gameApi.getCurrentRound(),
    queryKey: gameQueryKeys.currentRound(),
    refetchInterval: 1000,
  });
}

export function useRoundHistoryQuery(limit = 10) {
  return useQuery({
    queryFn: () => gameApi.getRoundHistory(limit),
    queryKey: gameQueryKeys.history(limit),
    refetchInterval: 3000,
  });
}

export function useLeaderboardQuery(period: LeaderboardPeriod, limit = 10) {
  return useQuery({
    queryFn: () => gameApi.getLeaderboard({ limit, period }),
    queryKey: gameQueryKeys.leaderboard(period, limit),
    refetchInterval: 5000,
  });
}

export function useVerifyRoundQuery(roundId: string | null) {
  return useQuery({
    enabled: Boolean(roundId),
    queryFn: () => gameApi.verifyRound(roundId ?? ""),
    queryKey: gameQueryKeys.verifyRound(roundId ?? ""),
  });
}

export function useMyBetsQuery(isAuthenticated: boolean, limit = 10) {
  return useQuery({
    enabled: isAuthenticated,
    queryFn: () => gameApi.getMyBets(limit),
    queryKey: gameQueryKeys.myBets(limit),
    refetchInterval: isAuthenticated ? 2000 : false,
  });
}

export function useWalletQuery(isAuthenticated: boolean) {
  return useQuery({
    enabled: isAuthenticated,
    queryFn: () => walletApi.getMe(),
    queryKey: walletQueryKeys.me(),
    refetchInterval: isAuthenticated ? 2000 : false,
  });
}

export function usePlaceBetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PlaceBetInput) => gameApi.placeBet(input),
    onSuccess: async () => {
      await invalidateGameState(queryClient);
    },
  });
}

export function useCashOutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => gameApi.cashOut(),
    onSuccess: async () => {
      await invalidateGameState(queryClient);
    },
  });
}

async function invalidateGameState(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: gameQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: walletQueryKeys.all }),
  ]);
}
