export type Element = 'fogo' | 'agua' | 'natureza';
export type Biome = 'brasa' | 'lago' | 'bosque';

export interface Species {
  id: string;
  name: string;
  element: Element;
  biome: Biome;
  shape: 'salamander' | 'fox' | 'axolotl' | 'turtle' | 'deer' | 'cat';
  evolved: boolean;
  evolvesTo?: string;
  description: string;
  colors: [string, string, string, string];
  base: { hp: number; attack: number; defense: number; speed: number; luck: number; range: number };
  skill: { name: string; power: number; charge: number };
}

export const ELEMENTS: Element[] = ['fogo', 'agua', 'natureza'];
export const ELEMENT_LABEL: Record<Element, string> = { fogo: 'Fogo', agua: 'Água', natureza: 'Natureza' };
export const ELEMENT_ICON: Record<Element, string> = { fogo: '✦', agua: '◈', natureza: '✿' };
export const ELEMENT_COLOR: Record<Element, string> = { fogo: '#f68156', agua: '#70c9da', natureza: '#95cf75' };

export const SPECIES: Record<string, Species> = {
  brasito: { id: 'brasito', name: 'Brasito', element: 'fogo', biome: 'brasa', shape: 'salamander', evolved: false, evolvesTo: 'brasalto', description: 'Sua cauda acende quando encontra coragem.', colors: ['#5c2f3f','#d85a43','#ffb464','#fff0ad'], base: { hp: 36, attack: 9, defense: 5, speed: 8, luck: 7, range: 1.4 }, skill: { name: 'Espiral de Brasa', power: 17, charge: 100 } },
  brasalto: { id: 'brasalto', name: 'Brasalto', element: 'fogo', biome: 'brasa', shape: 'salamander', evolved: true, description: 'Deixa rastros de carvão quente pelas pedras.', colors: ['#472b43','#bd3d3c','#ff8d43','#ffe58c'], base: { hp: 52, attack: 14, defense: 9, speed: 10, luck: 8, range: 1.6 }, skill: { name: 'Espiral de Brasa', power: 24, charge: 100 } },
  cinzuri: { id: 'cinzuri', name: 'Cinzuri', element: 'fogo', biome: 'brasa', shape: 'fox', evolved: false, evolvesTo: 'vulcazuri', description: 'Uma raposa que brinca entre as cinzas.', colors: ['#3d3045','#a34b42','#e98954','#ffe0a1'], base: { hp: 32, attack: 10, defense: 4, speed: 11, luck: 11, range: 1.3 }, skill: { name: 'Salto Vulcânico', power: 18, charge: 100 } },
  vulcazuri: { id: 'vulcazuri', name: 'Vulcazuri', element: 'fogo', biome: 'brasa', shape: 'fox', evolved: true, description: 'Sua juba cintila como uma cratera ao anoitecer.', colors: ['#352a3e','#963c3e','#f67b49','#ffd483'], base: { hp: 46, attack: 16, defense: 7, speed: 15, luck: 14, range: 1.5 }, skill: { name: 'Salto Vulcânico', power: 26, charge: 100 } },
  gotejo: { id: 'gotejo', name: 'Gotejo', element: 'agua', biome: 'lago', shape: 'axolotl', evolved: false, evolvesTo: 'marejo', description: 'Acompanha as correntes mais calmas.', colors: ['#26566f','#4b9db1','#81d8d6','#e3f6df'], base: { hp: 38, attack: 8, defense: 6, speed: 8, luck: 8, range: 1.55 }, skill: { name: 'Onda Serena', power: 17, charge: 100 } },
  marejo: { id: 'marejo', name: 'Maréjo', element: 'agua', biome: 'lago', shape: 'axolotl', evolved: true, description: 'Ergue ondas suaves para defender seu grupo.', colors: ['#244a68','#3d8fae','#6dced6','#def5e4'], base: { hp: 56, attack: 13, defense: 10, speed: 11, luck: 9, range: 1.8 }, skill: { name: 'Onda Serena', power: 24, charge: 100 } },
  conchilo: { id: 'conchilo', name: 'Conchilo', element: 'agua', biome: 'lago', shape: 'turtle', evolved: false, evolvesTo: 'coracilo', description: 'Guarda gotas de chuva na concha.', colors: ['#34576a','#4d8190','#85bec0','#e9e2bb'], base: { hp: 44, attack: 8, defense: 10, speed: 6, luck: 5, range: 1.6 }, skill: { name: 'Maré Circular', power: 16, charge: 100 } },
  coracilo: { id: 'coracilo', name: 'Coracilo', element: 'agua', biome: 'lago', shape: 'turtle', evolved: true, description: 'Sua concha ressoa quando a maré muda.', colors: ['#2d4d62','#3e758a','#6db5b9','#e9d5a7'], base: { hp: 66, attack: 12, defense: 17, speed: 8, luck: 6, range: 1.85 }, skill: { name: 'Maré Circular', power: 24, charge: 100 } },
  brotelho: { id: 'brotelho', name: 'Brotelho', element: 'natureza', biome: 'bosque', shape: 'deer', evolved: false, evolvesTo: 'cervaflor', description: 'Pequenas flores surgem por onde ele passa.', colors: ['#405445','#799650','#b6c978','#f3e9b5'], base: { hp: 36, attack: 9, defense: 6, speed: 10, luck: 9, range: 1.5 }, skill: { name: 'Raízes Dançantes', power: 18, charge: 100 } },
  cervaflor: { id: 'cervaflor', name: 'Cervaflor', element: 'natureza', biome: 'bosque', shape: 'deer', evolved: true, description: 'Seus galhos acolhem pássaros e brotos.', colors: ['#354c40','#658a4d','#a6bf69','#f5ddab'], base: { hp: 52, attack: 14, defense: 10, speed: 13, luck: 11, range: 1.75 }, skill: { name: 'Raízes Dançantes', power: 25, charge: 100 } },
  musgato: { id: 'musgato', name: 'Musgato', element: 'natureza', biome: 'bosque', shape: 'cat', evolved: false, evolvesTo: 'floragato', description: 'Prefere passear sob a lua entre as árvores.', colors: ['#344d49','#64866a','#9fba83','#f0e6b3'], base: { hp: 34, attack: 10, defense: 5, speed: 12, luck: 12, range: 1.3 }, skill: { name: 'Folhas Velozes', power: 18, charge: 100 } },
  floragato: { id: 'floragato', name: 'Floragato', element: 'natureza', biome: 'bosque', shape: 'cat', evolved: true, description: 'Uma sombra veloz de folhas e flores.', colors: ['#2d4843','#55775f','#8db47c','#f0d9a4'], base: { hp: 48, attack: 15, defense: 8, speed: 16, luck: 15, range: 1.55 }, skill: { name: 'Folhas Velozes', power: 25, charge: 100 } }
};

export const BASE_SPECIES = ['brasito', 'cinzuri', 'gotejo', 'conchilo', 'brotelho', 'musgato'];
export const STARTERS = ['brasito', 'gotejo', 'brotelho'];

export type HeldItemSlot = 'food' | 'support';
export interface Monster {
  uid: string;
  species: string;
  level: number;
  xp: number;
  hp: number;
  heldItems: Record<HeldItemSlot,string|null>;
}

export function maxHp(monster: Monster): number {
  return SPECIES[monster.species].base.hp + (monster.level - 1) * 5;
}

export function attack(monster: Monster): number {
  return SPECIES[monster.species].base.attack + (monster.level - 1) * 2;
}

export function speed(monster: Monster): number {
  return SPECIES[monster.species].base.speed + Math.floor((monster.level - 1) * 0.8);
}

export function defense(monster: Monster): number {
  return SPECIES[monster.species].base.defense + Math.floor((monster.level - 1) * 1.2);
}

export function luck(monster: Monster): number {
  return SPECIES[monster.species].base.luck + Math.floor((monster.level - 1) * 0.4);
}

export function createMonster(species: string, level: number, uid: string): Monster {
  const monster: Monster = { uid, species, level, xp: 0, hp: 1, heldItems: {food:null,support:null} };
  monster.hp = maxHp(monster);
  return monster;
}

export function advantage(source: Element, target: Element): number {
  if (source === target) return 1;
  if ((source === 'fogo' && target === 'natureza') || (source === 'natureza' && target === 'agua') || (source === 'agua' && target === 'fogo')) return 1.25;
  return 0.8;
}

export function experienceNeeded(level: number): number { return 15 + level * 9; }

export function gainExperience(monster: Monster, amount: number): { levels: number; evolved: boolean } {
  let levels = 0;
  let evolved = false;
  monster.xp += amount;
  while (monster.xp >= experienceNeeded(monster.level)) {
    monster.xp -= experienceNeeded(monster.level);
    monster.level++;
    levels++;
    if (monster.level >= 6 && SPECIES[monster.species].evolvesTo) {
      monster.species = SPECIES[monster.species].evolvesTo!;
      evolved = true;
    }
  }
  return { levels, evolved };
}
