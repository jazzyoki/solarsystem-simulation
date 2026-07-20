export interface ViewportSize {
  width: number;
  height: number;
}

function fade(coverage: number, start: number, end: number): number {
  if (coverage <= start) return 0;
  if (coverage >= end) return 1;
  return (coverage - start) / (end - start);
}

export function moonOpacity(bubbleScreenDiameter: number, viewport: ViewportSize): number {
  return fade(bubbleScreenDiameter / Math.min(viewport.width, viewport.height), 0.15, 0.25);
}

export function labelOpacity(bubbleScreenDiameter: number, viewport: ViewportSize): number {
  return fade(bubbleScreenDiameter / Math.min(viewport.width, viewport.height), 0.35, 0.45);
}
