type StageRendererRect = Pick<DOMRectReadOnly, "height" | "width">;

export function getCrashFlightRendererSize(rect: StageRendererRect | null) {
  return {
    height: Math.max(1, Math.floor(rect?.height ?? 460)),
    width: Math.max(1, Math.floor(rect?.width ?? 760)),
  };
}
