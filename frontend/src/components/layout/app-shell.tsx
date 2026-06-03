import { LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useAuth } from "../../hooks/use-auth";
import { useWalletQuery } from "../../hooks/use-game-rest";
import { formatCents } from "../../services/money";
import { Button } from "../ui/button";
import { ChronoRail } from "./chrono-rail";

export function AppShell({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading, login, logout, username } = useAuth();
  const walletQuery = useWalletQuery(isAuthenticated);
  const balanceLabel =
    isAuthenticated && walletQuery.data
      ? formatCents(walletQuery.data.balanceCents)
      : isAuthenticated && walletQuery.isLoading
        ? "..."
        : "-";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020617] text-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_48%_-12%,rgba(250,204,21,0.16),transparent_34rem),radial-gradient(circle_at_82%_12%,rgba(6,78,59,0.32),transparent_30rem)]" />
      <div className="relative mx-auto flex max-w-[112rem] flex-col gap-4 px-3 py-3 sm:px-4 lg:flex-row">
        <ChronoRail />

        <div className="min-w-0 flex-1">
          <header className="chrono-frame rounded-3xl border border-amber-200/25">
            <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:justify-between sm:px-6">
              <div className="mr-auto flex min-w-0 items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-amber-200/45 bg-emerald-950/70 text-sm font-black text-amber-100 shadow-[0_0_32px_rgba(250,204,21,0.18)]">
                  CC
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-black tracking-normal">
                    Chrono Crash
                  </h1>
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-200">
                    Arcade casino premium
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 md:flex">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Hash chain
              </div>

              {isAuthenticated ? (
                <div
                  aria-label="Ações da conta"
                  className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:justify-end"
                >
                  <div
                    aria-label="Conta do jogador"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-2 text-emerald-100 sm:flex-none sm:px-3"
                  >
                    <UserRound
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-sm font-semibold">
                        {username ?? "-"}
                      </p>
                      <p className="truncate font-mono text-[0.68rem] font-semibold text-emerald-100 sm:text-xs">
                        {balanceLabel}
                      </p>
                    </div>
                  </div>
                  <Button onClick={logout} size="sm" type="button" variant="ghost">
                    <LogOut className="size-4" aria-hidden="true" />
                    Sair
                  </Button>
                </div>
              ) : (
                <Button
                  disabled={isLoading}
                  onClick={() => void login()}
                  size="sm"
                  type="button"
                  variant="neon"
                >
                  <LogIn className="size-4" aria-hidden="true" />
                  Entrar
                </Button>
              )}
            </div>
          </header>

          <main className="mt-4 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
