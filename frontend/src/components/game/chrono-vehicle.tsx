import { cn } from "../../lib/utils";

type ChronoVehicleProps = {
  crashed: boolean;
  running: boolean;
};

export function ChronoVehicle({ crashed, running }: ChronoVehicleProps) {
  return (
    <div
      className={cn(
        "absolute bottom-[4.1rem] left-[8%] z-20 w-[13rem] max-w-[45vw]",
        running && "chrono-drive",
      )}
    >
      <svg
        aria-hidden="true"
        className="h-auto w-full drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)]"
        viewBox="0 0 260 112"
      >
        <defs>
          <linearGradient id="chrono-body" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f8fafc" />
            <stop offset="0.52" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="chrono-glass" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#67e8f9" stopOpacity="0.9" />
            <stop offset="1" stopColor="#0f172a" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        <path
          d="M28 72 L58 35 L125 25 L177 45 L225 56 L244 73 L232 88 L42 91 Z"
          fill="url(#chrono-body)"
          stroke="#e2e8f0"
          strokeWidth="2"
        />
        <path
          d="M69 39 L116 32 L105 57 L54 62 Z"
          fill="url(#chrono-glass)"
          stroke="#a5f3fc"
          strokeWidth="2"
        />
        <path
          d="M125 32 L171 48 L132 58 Z"
          fill="#172554"
          stroke="#67e8f9"
          strokeWidth="2"
        />
        <path
          d="M42 76 L225 76"
          stroke="#0f172a"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <path
          d="M143 62 L205 63"
          stroke="#f59e0b"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <circle cx="69" cy="88" fill="#020617" r="22" />
        <circle cx="69" cy="88" fill="#94a3b8" r="12" />
        <circle cx="202" cy="88" fill="#020617" r="22" />
        <circle cx="202" cy="88" fill="#94a3b8" r="12" />
        <path
          d="M12 70 C0 62 0 49 15 42"
          fill="none"
          stroke={crashed ? "#fb7185" : "#22d3ee"}
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path
          d="M6 87 C-16 82 -18 61 5 55"
          fill="none"
          opacity="0.65"
          stroke={crashed ? "#fb7185" : "#f59e0b"}
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}
