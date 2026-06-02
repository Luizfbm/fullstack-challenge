import { Repeat, ShieldAlert, Trophy } from "lucide-react";
import { Input } from "../ui/input";

type AutoBetSettingsFieldsProps = {
  disabled?: boolean;
  maxRounds: string;
  onMaxRoundsChange: (value: string) => void;
  onStopLossChange: (value: string) => void;
  onTakeProfitChange: (value: string) => void;
  stopLossCents: string;
  takeProfitCents: string;
};

export function AutoBetSettingsFields({
  disabled = false,
  maxRounds,
  onMaxRoundsChange,
  onStopLossChange,
  onTakeProfitChange,
  stopLossCents,
  takeProfitCents,
}: AutoBetSettingsFieldsProps) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <NumberField
        disabled={disabled}
        icon={Repeat}
        id="auto-bet-max-rounds"
        label="Rodadas maximas"
        onChange={onMaxRoundsChange}
        value={maxRounds}
      />
      <NumberField
        disabled={disabled}
        icon={ShieldAlert}
        id="auto-bet-stop-loss"
        label="Stop-loss em centavos"
        onChange={onStopLossChange}
        value={stopLossCents}
      />
      <NumberField
        disabled={disabled}
        icon={Trophy}
        id="auto-bet-take-profit"
        label="Take-profit em centavos"
        onChange={onTakeProfitChange}
        value={takeProfitCents}
      />
    </div>
  );
}

type NumberFieldProps = {
  disabled: boolean;
  icon: typeof Repeat;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

function NumberField({
  disabled,
  icon: Icon,
  id,
  label,
  onChange,
  value,
}: NumberFieldProps) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3">
      <label
        className="flex items-center gap-2 text-xs font-medium text-zinc-400"
        htmlFor={id}
      >
        <Icon className="size-3.5 text-cyan-200" aria-hidden="true" />
        {label}
      </label>
      <Input
        className="mt-2 h-10 border-cyan-300/20 bg-black/45 font-mono"
        disabled={disabled}
        id={id}
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}
