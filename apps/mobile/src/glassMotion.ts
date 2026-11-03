export function rubberBand(value: number, max: number) {
  if (value < 0) return -Math.sqrt(-value) * 2;
  if (value > max) return max + Math.sqrt(value - max) * 2;
  return value;
}

export function releaseTab(
  position: number,
  velocity: number,
  cellWidth: number,
  count: number,
) {
  if (cellWidth <= 0) return 0;
  const projected = position + Math.max(-2.5, Math.min(2.5, velocity)) * 110;
  return Math.max(0, Math.min(count - 1, Math.round(projected / cellWidth)));
}

export function jellyShape(velocity: number) {
  const stretch = Math.min(Math.abs(velocity) * 0.13, 0.24);
  return { x: 1 + stretch, y: 1 - stretch * 0.65 };
}
