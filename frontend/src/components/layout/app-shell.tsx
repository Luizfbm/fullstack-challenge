import { LogIn, LogOut, UserRound } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useAuth } from "../../hooks/use-auth";
import { Button } from "../ui/button";

export function AppShell({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading, login, logout, username } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-900 bg-zinc-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-emerald-400 text-sm font-black text-zinc-950">
              CG
            </div>
            <div>
              <p className="text-sm font-semibold">Crash Game</p>
              <p className="text-xs text-zinc-500">Local table</p>
            </div>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 sm:flex">
                <UserRound className="size-4 text-emerald-300" aria-hidden="true" />
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
              variant="ghost"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Entrar
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
