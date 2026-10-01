import { describe, expect, it } from 'vitest';
import { facingForDirection, facingToward } from './facing';

describe('orientação dos sprites na câmera fixa',()=>{
  it('inverte a silhueta ao andar para os lados da tela',()=>{
    expect(facingForDirection(1,-1)).toBe(1);
    expect(facingForDirection(-1,1)).toBe(-1);
  });
  it('faz os dois monstros olhar um para o outro em qualquer lado',()=>{
    const ally={x:10,z:10},foe={x:8,z:11};
    expect(facingToward(ally,foe)).toBe(-1);
    expect(facingToward(foe,ally)).toBe(1);
  });
});
