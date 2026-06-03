import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";

type BetSlipHeaderProps = {
  detailsOpen: boolean;
  onDetailsToggle: () => void;
  onReset: () => void;
};

export function BetSlipHeader({
  detailsOpen,
  onDetailsToggle,
  onReset,
}: BetSlipHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
          Mesa de aposta
        </p>
      <h2 className="mt-1 truncate text-lg font-black text-zinc-50">
        Aposta
      </h2>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          aria-expanded={detailsOpen}
          aria-label="Configurar aposta"
          className="lg:hidden"
          onClick={onDetailsToggle}
          size="icon"
          type="button"
          variant="ghost"
        >
          {detailsOpen ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </Button>
        <Button
          aria-label="Resetar aposta"
          onClick={onReset}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
