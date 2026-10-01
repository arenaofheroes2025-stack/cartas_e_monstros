export type RenderQuality = 'high' | 'low';

const PIXEL_BUDGET: Record<RenderQuality, number> = {
  high: 1_000_000,
  low: 750_000
};

export function maximumRenderDpr(deviceDpr: number, quality: RenderQuality): number {
  return Math.max(0.45, Math.min(deviceDpr || 1, quality === 'high' ? 1.75 : 1));
}

/** Limit the WebGL buffer, not the CSS size of the game or its DOM interface. */
export function preferredRenderDpr(width: number, height: number, deviceDpr: number, quality: RenderQuality): number {
  const deviceLimit = maximumRenderDpr(deviceDpr, quality);
  const pixelLimit = Math.sqrt(PIXEL_BUDGET[quality] / Math.max(1, width * height));
  return Math.max(0.45, Math.min(deviceLimit, pixelLimit));
}

/** Small, infrequent steps avoid visible jumps when the GPU gets busy. */
export function adjustedRenderDpr(current: number, maximum: number, averageFrameMs: number, fastWindows: number): number {
  if (averageFrameMs > 18.5) return Math.max(0.45, Math.round((current - 0.08) * 100) / 100);
  if (averageFrameMs < 14 && fastWindows >= 3) return Math.min(maximum, Math.round((current + 0.04) * 100) / 100);
  return current;
}
