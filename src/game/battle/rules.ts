import { advantage, attack, defense, luck, maxHp, speed, SPECIES, type Monster } from '../content';

export function captureChance(enemy: Monster, remainingHp: number): number {
  const maximum = maxHp(enemy);
  if (remainingHp > maximum * 0.5) return 0;
  return Math.round(50 + 35 * (1 - remainingHp / (maximum * 0.5)));
}

export function attackDamage(attacker: Monster, defender: Monster, skill: boolean, critical = false, attackBonus=0, defenseBonus=0): number {
  const species = SPECIES[attacker.species];
  const factor = advantage(species.element, SPECIES[defender.species].element);
  const raw = Math.max(1,attack(attacker)+attackBonus+(skill ? species.skill.power : 0)) * factor * (skill ? 0.66 : 0.72);
  return Math.max(1, Math.round(Math.max(1,raw - Math.max(0,defense(defender)+defenseBonus) * 0.34) * (critical ? 1.5 : 1)));
}

export function criticalChance(monster: Monster): number {
  return Math.min(0.3,0.03 + luck(monster) * 0.01);
}

export function attackInterval(monster: Monster, speedBonus=0): number {
  return Math.max(0.95, Math.min(2.3, 2.55 - Math.max(1,speed(monster)+speedBonus) * 0.075));
}

export function enemyAttackInterval(monster: Monster, speedBonus=0): number {
  return attackInterval(monster,speedBonus)+0.75;
}

export function enemyRecovery(monster: Monster, speedBonus=0): number {
  return Math.max(1.2,1.65-Math.max(1,speed(monster)+speedBonus)*0.02);
}

export function attackRadius(monster: Monster, skill = false): number {
  return SPECIES[monster.species].base.range + Math.min(0.2, (monster.level - 1) * 0.025) + (skill ? 0.25 : 0);
}

export function battleMoveSpeed(monster: Monster, enemy = false, speedBonus=0): number {
  return (enemy ? 0.95 : 1.55) + Math.max(1,speed(monster)+speedBonus) * 0.055;
}

export function dodgeCooldown(monster: Monster, speedBonus=0): number {
  return Math.max(2.6, 4.3 - Math.max(1,speed(monster)+speedBonus) * 0.055);
}
