import { LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useAuth } from "../../hooks/use-auth";
import { Button } from "../ui/button";
import { ChronoRail } from "./chrono-rail";

export function AppShell({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading, login, logout, username } = useAuth();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070a] text-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(34,211,238,0.22),transparent_34rem)]" />
      <div className="relative mx-auto flex max-w-[112rem] flex-col gap-4 px-3 py-3 sm:px-4 lg:flex-row">
        <ChronoRail />

        <div className="min-w-0 flex-1">
          <header className="chrono-frame rounded-3xl border border-white/10">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-cyan-300/35 bg-cyan-300/15 text-sm font-black text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.22)]">
                  CC
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-black tracking-normal">
                    Chrono Crash
                  </p>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">
                    Crash Game
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 md:flex">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Hash chain
              </div>

              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <div className="hidden items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100 sm:flex">
                    <UserRound className="size-4" aria-hidden="true" />
                    {username}
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
