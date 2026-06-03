import { Repeat, ShieldAlert, Trophy } from "lucide-react";
import { AutoBetNumberField } from "./auto-bet-number-field";

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
    <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3 xl:grid-cols-1">
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

const NumberField = AutoBetNumberField;
