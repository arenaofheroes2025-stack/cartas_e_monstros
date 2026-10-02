import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, Game } from './game';

describe('relógio do mundo',()=>{
  it('percorre 24 horas em 24 minutos ativos, incluindo batalhas',()=>{
    expect(DAY_SECONDS).toBe(24*60);
    const game=new Game();
    game.newGame('brasito',40732);
    const start=game.hour;
    game.advanceClock(60);
    expect(game.hour).toBeCloseTo(start+1,6);
    game.mode='battle';
    game.advanceClock(60);
    expect(game.hour).toBeCloseTo(start+2,6);
    game.battleMenu='items';
    game.advanceClock(60);
    expect(game.hour).toBeCloseTo(start+2,6);
    game.battleMenu=null;
    game.mode='pause';
    game.advanceClock(60);
    expect(game.hour).toBeCloseTo(start+2,6);
    game.mode='explore';
    game.advanceClock(DAY_SECONDS);
    expect(game.hour).toBeCloseTo(start+2,6);
  });

  it('mantém 12 minutos de dia e 12 minutos de noite',()=>{
    const game=new Game();
    game.newGame('brasito',40732);
    game.save!.elapsed=DAY_SECONDS*6/24;
    expect(game.hour).toBe(6);
    expect(game.isNight).toBe(false);
    game.advanceClock(12*60);
    expect(game.hour).toBe(18);
    expect(game.isNight).toBe(true);
    game.advanceClock(12*60);
    expect(game.hour).toBe(6);
    expect(game.isNight).toBe(false);
  });
});
