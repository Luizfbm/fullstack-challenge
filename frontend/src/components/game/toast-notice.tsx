type ToastNoticeProps = {
  message: string;
};

export function ToastNotice({ message }: ToastNoticeProps) {
  return (
    <div
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+15rem)] z-50 rounded-md border border-rose-400/40 bg-rose-950 px-4 py-3 text-sm text-rose-50 shadow-xl shadow-black/40 sm:left-auto sm:w-96 lg:bottom-4"
      role="alert"
    >
      {message}
    </div>
  );
}
