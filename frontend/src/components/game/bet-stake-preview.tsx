import { formatCents } from "../../services/money";

type BetStakePreviewProps = {
  entryLabel: string;
  potentialPayout: bigint | null;
};

export function BetStakePreview({
  entryLabel,
  potentialPayout,
}: BetStakePreviewProps) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-1">
      <div className="min-w-0 rounded-md border border-white/5 bg-black/35 px-3 py-2.5 text-sm text-zinc-300">
        <p className="text-xs text-zinc-500">Entrada</p>
        <p className="font-mono text-zinc-50">{entryLabel}</p>
      </div>
      <div className="min-w-0 rounded-md border border-emerald-300/15 bg-emerald-300/10 px-3 py-2.5 text-sm">
        <p className="text-xs text-zinc-500">Extracao estimada</p>
        <p className="font-mono text-emerald-100">
          {potentialPayout ? formatCents(potentialPayout) : "-"}
        </p>
      </div>
    </div>
  );
}
