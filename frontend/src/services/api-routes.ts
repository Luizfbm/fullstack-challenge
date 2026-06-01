export const gameRoutes = {
  currentRound: "/games/rounds/current",
  history: "/games/rounds/history",
  leaderboard: "/games/leaderboard",
  verifyRound: (roundId: string) =>
    `/games/rounds/${encodeURIComponent(roundId)}/verify`,
  myBets: "/games/bets/me",
  bet: "/games/bet",
  cashout: "/games/bet/cashout",
} as const;

export const walletRoutes = {
  create: "/wallets",
  me: "/wallets/me",
} as const;
