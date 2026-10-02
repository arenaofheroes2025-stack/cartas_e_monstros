import { describe, expect, it } from 'vitest';
import { daylightPhase } from './daylightPhase';

describe('luz ao longo do dia',()=>{
  it('é clara ao meio-dia, aquece no fim da tarde e cede à noite',()=>{
    expect(daylightPhase(8).morning).toBeGreaterThan(0.7);
    expect(daylightPhase(12)).toEqual({daylight:1,morning:0,warmth:0});
    expect(daylightPhase(16).warmth).toBeGreaterThan(0.9);
    expect(daylightPhase(17.5).warmth).toBeGreaterThan(0);
    expect(daylightPhase(17.5).daylight).toBeGreaterThan(daylightPhase(18).daylight);
    expect(daylightPhase(6).daylight).toBe(0);
    expect(daylightPhase(18).daylight).toBe(0);
    expect(daylightPhase(22)).toEqual({daylight:0,morning:0,warmth:0});
  });

  it('transita sem saltos nos horários em que as cores mudam',()=>{
    for(const hour of [6,7,7.5,10.5,14,16,17,17.5,18]){
      const before=daylightPhase(hour-0.01),after=daylightPhase(hour+0.01);
      expect(Math.abs(after.daylight-before.daylight)).toBeLessThan(0.02);
      expect(Math.abs(after.morning-before.morning)).toBeLessThan(0.02);
      expect(Math.abs(after.warmth-before.warmth)).toBeLessThan(0.02);
    }
  });
});
