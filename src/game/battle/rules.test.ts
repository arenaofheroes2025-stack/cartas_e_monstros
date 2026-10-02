import { describe, expect, it } from 'vitest';
import { createMonster } from '../content';
import { attackDamage, attackInterval, attackRadius, battleMoveSpeed, criticalChance, dodgeCooldown } from './rules';

describe('atributos em combate',()=>{
  it('defesa reduz dano e sorte aumenta a chance de crítico',()=>{
    const attacker=createMonster('brotelho',1,'a');
    const lowDefense=createMonster('gotejo',1,'b');
    const highDefense=createMonster('coracilo',1,'c');
    expect(attackDamage(attacker,highDefense,false)).toBeLessThan(attackDamage(attacker,lowDefense,false));
    expect(attackDamage(attacker,highDefense,false,true)).toBeGreaterThan(attackDamage(attacker,highDefense,false));
    expect(criticalChance(createMonster('vulcazuri',1,'d'))).toBeGreaterThan(criticalChance(createMonster('conchilo',1,'e')));
  });
  it('velocidade reduz o intervalo entre ataques',()=>{
    expect(attackInterval(createMonster('musgato',1,'fast'))).toBeLessThan(attackInterval(createMonster('conchilo',1,'slow')));
    expect(battleMoveSpeed(createMonster('musgato',1,'fast'))).toBeGreaterThan(battleMoveSpeed(createMonster('conchilo',1,'slow')));
    expect(dodgeCooldown(createMonster('musgato',1,'fast'))).toBeLessThan(dodgeCooldown(createMonster('conchilo',1,'slow')));
  });
  it('a área do golpe depende da espécie e aumenta na habilidade',()=>{
    expect(attackRadius(createMonster('coracilo',1,'wide'))).toBeGreaterThan(attackRadius(createMonster('cinzuri',1,'narrow')));
    expect(attackRadius(createMonster('brasito',1,'skill'),true)).toBeGreaterThan(attackRadius(createMonster('brasito',1,'basic')));
  });
  it('o golpe comum sempre causa ao menos 1 PV quando acerta, mesmo contra defesa elevada',()=>{
    const attacker=createMonster('gotejo',1,'weak');
    const defender=createMonster('coracilo',30,'armored');
    expect(attackDamage(attacker,defender,false)).toBe(1);
    expect(attackDamage(attacker,defender,true)).toBeGreaterThanOrEqual(1);
  });
});
