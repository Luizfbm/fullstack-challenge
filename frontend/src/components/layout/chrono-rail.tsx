import {
  BookOpenCheck,
  Clipboard,
  ExternalLink,
  KeyRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import {
  railItems,
  type RailItem,
  type RailItemId,
} from "./chrono-rail-items";

export function ChronoRail() {
  const [activePanelId, setActivePanelId] = useState<RailItemId | null>(null);
  const [copiedPanelId, setCopiedPanelId] = useState<RailItemId | null>(null);
  const activePanel =
    railItems.find((item) => item.id === activePanelId) ?? null;

  async function copyPanel(panel: RailItem): Promise<void> {
    if (!panel.copyValue || !globalThis.navigator?.clipboard) {
      return;
    }

    await globalThis.navigator.clipboard.writeText(panel.copyValue);
    setCopiedPanelId(panel.id);
    window.setTimeout(() => setCopiedPanelId(null), 1600);
  }

  return (
    <nav
      aria-label="Chrono cockpit sections"
      className="sticky top-3 z-40 rounded-2xl border border-white/10 bg-slate-950/85 p-2 shadow-2xl shadow-black/45 backdrop-blur lg:h-[calc(100vh-2rem)] lg:w-16 lg:rounded-3xl lg:p-3"
    >
      <div className="flex items-center justify-around gap-1 lg:h-full lg:flex-col lg:justify-start lg:gap-3">
        {railItems.map(({ icon: Icon, id, title }) => {
          const active =
            activePanelId === id || (activePanelId === null && id === "cockpit");

          return (
            <button
              aria-current={active ? "page" : undefined}
              aria-expanded={activePanelId === id}
              aria-label={title}
              className={cn(
                "grid size-10 cursor-pointer place-items-center rounded-xl border text-zinc-500 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200",
                active
                  ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.22)]"
                  : "border-white/5 bg-white/[0.03] hover:border-zinc-500/40 hover:text-zinc-200",
              )}
              key={id}
              onClick={() =>
                setActivePanelId((current) => (current === id ? null : id))
              }
              type="button"
              title={title}
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {activePanel ? (
        <section
          aria-label={`${activePanel.title} do avaliador`}
          className="absolute left-0 top-full mt-2 max-h-[min(34rem,calc(100vh-6rem))] w-[min(calc(100vw-1.5rem),24rem)] overflow-y-auto rounded-2xl border border-cyan-200/20 bg-slate-950/95 p-3 text-left shadow-2xl shadow-black/60 backdrop-blur lg:left-full lg:top-0 lg:ml-3 lg:mt-0 lg:w-96"
        >
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
              <activePanel.icon className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-100">
                {activePanel.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-300">
                {activePanel.description}
              </p>
            </div>
            <button
              aria-label="Fechar painel de avaliador"
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              onClick={() => setActivePanelId(null)}
              type="button"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {activePanel.copyValue ? (
            <button
              className="mt-3 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-left text-xs font-semibold text-amber-100 transition-colors hover:border-amber-200/45 hover:bg-amber-200/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
              onClick={() => void copyPanel(activePanel)}
              type="button"
            >
              <span>
                {copiedPanelId === activePanel.id
                  ? "Resumo copiado"
                  : "Copiar resumo"}
              </span>
              <Clipboard className="size-4 shrink-0" aria-hidden="true" />
            </button>
          ) : null}

          {activePanel.credentials ? (
            <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
                <KeyRound className="size-4" aria-hidden="true" />
                Credenciais
              </div>
              <dl className="mt-3 space-y-2">
                {activePanel.credentials.map((credential) => (
                  <div
                    className="grid gap-1 rounded-lg border border-white/10 bg-black/25 p-2"
                    key={credential.label}
                  >
                    <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-emerald-200/80">
                      {credential.label}
                    </dt>
                    <dd className="break-words font-mono text-xs text-emerald-50">
                      {credential.username} / {credential.password}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="mt-3 grid gap-2">
            {activePanel.links.map((link) => (
              <a
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-3 text-zinc-200 transition-colors hover:border-cyan-300/30 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                href={link.href}
                key={link.href}
                rel="noreferrer"
                target="_blank"
              >
                <span className="flex items-start gap-3">
                  <BookOpenCheck
                    className="mt-0.5 size-4 shrink-0 text-cyan-200"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
                      <span className="truncate">{link.label}</span>
                      <ExternalLink
                        className="size-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-cyan-200"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-400">
                      {link.description}
                    </span>
                    {link.credential ? (
                      <span className="mt-2 inline-flex max-w-full rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 font-mono text-[0.68rem] text-emerald-100">
                        {link.credential}
                      </span>
                    ) : null}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </nav>
  );
}
