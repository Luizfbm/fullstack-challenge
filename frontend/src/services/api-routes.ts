export const gameRoutes = {
  currentRound: "/games/rounds/current",
  history: "/games/rounds/history",
  leaderboard: "/games/leaderboard",
  verifyRound: (roundId: string) =>
    `/games/rounds/${encodeURIComponent(roundId)}/verify`,
  myBets: "/games/bets/me",
  bet: "/games/bet",
  cashout: "/games/bet/cashout",
  autoBetSessions: "/games/auto-bet/sessions",
  myAutoBetSession: "/games/auto-bet/sessions/me",
  stopMyAutoBetSession: "/games/auto-bet/sessions/me/stop",
} as const;

export const walletRoutes = {
  create: "/wallets",
  me: "/wallets/me",
} as const;
