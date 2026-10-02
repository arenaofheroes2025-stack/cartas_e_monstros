import { describe, expect, it } from 'vitest';
import { battleKeyAction } from './battleKeys';

describe('atalhos de batalha no desktop',()=>{
  it('mantém as cinco ações nas teclas combinadas e alterna perseguir/voltar no A',()=>{
    expect(['z','x','c','a','s'].map(key=>battleKeyAction(key,false)))
      .toEqual(['attack','dodge','special','follow','cards']);
    expect(battleKeyAction('a',true)).toBe('return');
    for(const oldKey of ['r','v','b','1','2','3','4','5'])expect(battleKeyAction(oldKey,false)).toBeNull();
  });
});
