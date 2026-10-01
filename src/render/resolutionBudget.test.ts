import { describe, expect, it } from 'vitest';
import { adjustedRenderDpr, maximumRenderDpr, preferredRenderDpr } from './resolutionBudget';

describe('resolução da cena em janelas grandes',()=>{
  it('preserva os pixels em janelas pequenas e limita o custo em tela cheia',()=>{
    expect(preferredRenderDpr(844,600,1,'high')).toBe(1);
    const fullHd=preferredRenderDpr(1920,1080,1.5,'high');
    expect(fullHd).toBeLessThan(0.7);
    expect(1920*1080*fullHd*fullHd).toBeLessThanOrEqual(1_000_000);
    expect(preferredRenderDpr(1920,1080,1.5,'low')).toBeLessThan(fullHd);
    expect(maximumRenderDpr(1.5,'high')).toBe(1.5);
  });

  it('reduz ao detectar quadros lentos e só recupera com desempenho estável',()=>{
    expect(adjustedRenderDpr(0.8,1,25,0)).toBe(0.72);
    expect(adjustedRenderDpr(0.69,1,20,0)).toBe(0.61);
    expect(adjustedRenderDpr(0.72,1,13,2)).toBe(0.72);
    expect(adjustedRenderDpr(0.72,1,13,3)).toBe(0.76);
    expect(adjustedRenderDpr(0.48,0.8,40,0)).toBe(0.45);
  });
});
