import type { Place, WalkingNpcRole } from './world';

export type StaticNpcRole='artisan'|'healer'|'keeper'|'guardian';

export function staticNpcAt(place:Place):{x:number;z:number;role:StaticNpcRole} {
  return {
    x:place.x+(place.kind==='house'?1.45:2.2),
    z:place.z+(place.kind==='house'?2.05:0.5),
    role:place.kind==='shrine'?'guardian':place.id==='casa-cura'?'healer':place.id==='casa-cartas'?'artisan':'keeper'
  };
}

export const WALKING_NPC_DIALOG: Record<WalkingNpcRole,{name:string;text:string}> = {
  cartographer: {
    name: 'Nara, a cartógrafa',
    text: 'Estou desenhando as trilhas entre os três santuários. As encostas suaves são a passagem segura entre terrenos de alturas diferentes.'
  },
  botanist: {
    name: 'Olmo, o botânico',
    text: 'Cada monstro gosta de um habitat. Procure na grama, perto da água ou entre as pedras quentes. À noite, alguns saem para passear.'
  },
  baker: {
    name: 'Távio, o padeiro',
    text: 'O forno da padaria acende antes do amanhecer. Gosto de ver a praça ganhar movimento enquanto reparto os pães do dia.'
  },
  courier: {
    name: 'Lina, a mensageira',
    text: 'Levo cartas entre as casas e os santuários. Se procurar um caminho, siga os postes acesos quando o sol baixar.'
  }
};
