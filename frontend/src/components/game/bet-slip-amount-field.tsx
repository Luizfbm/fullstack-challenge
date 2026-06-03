import { Input } from "../ui/input";

type BetSlipAmountFieldProps = {
  disabled: boolean;
  onValueChange: (value: string) => void;
  value: string;
};

export function BetSlipAmountField({
  disabled,
  onValueChange,
  value,
}: BetSlipAmountFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-amber-100/80" htmlFor="bet">
        Valor em reais
      </label>
      <div className="mt-2 flex h-12 items-center rounded-md border border-amber-200/15 bg-black/35 px-3 transition-colors focus-within:border-amber-200/60 focus-within:shadow-[0_0_24px_rgba(250,204,21,0.14)]">
        <span className="mr-2 shrink-0 font-mono text-lg font-semibold text-amber-100">
          R$
        </span>
        <Input
          className="h-auto border-0 bg-transparent px-0 font-mono text-lg shadow-none focus:border-transparent focus:shadow-none"
          disabled={disabled}
          id="bet"
          inputMode="decimal"
          onChange={(event) => onValueChange(event.target.value)}
          value={value}
        />
      </div>
    </div>
  );
}
