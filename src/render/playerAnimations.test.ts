import { describe, expect, it } from 'vitest';
import { BATTLE_CARD_STOW_SECONDS, BATTLE_ITEM_RELEASE_SECONDS, BATTLE_ITEM_THROW_SECONDS, BATTLE_RECALL_END_SECONDS, BATTLE_SUMMON_CARD_ARRIVE_SECONDS, BATTLE_SUMMON_CARD_RELEASE_SECONDS } from '../game/game';
import { PLAYER_ANIMATIONS, playerAnimationFrame, playerIntroCardPose, playerJumpLandingFrame, playerVictoryCardPose, summonCardFlightProgress } from './playerAnimations';
import { SPRITE_FOOT_V } from './spriteAnchors';

describe('animações do herói',()=>{
  it('define onze movimentos com 59 quadros ao todo',()=>{
    expect(Object.keys(PLAYER_ANIMATIONS)).toHaveLength(11);
    expect(Object.values(PLAYER_ANIMATIONS).reduce((sum,clip)=>sum+clip.frames,0)).toBe(59);
  });

  it('repete os ciclos e segura o último quadro das ações únicas',()=>{
    expect(playerAnimationFrame('walk',0)).toBe(0);
    expect(playerAnimationFrame('walk',PLAYER_ANIMATIONS.walk.duration)).toBe(0);
    expect(playerAnimationFrame('walk',PLAYER_ANIMATIONS.walk.duration*3)).toBe(0);
    expect(playerAnimationFrame('jump',0)).toBe(1);
    expect(playerAnimationFrame('defeat',10)).toBe(5);
    expect(playerAnimationFrame('command',-1)).toBe(0);
  });

  it('decola no terceiro quadro, cicla no ar e pousa nos quadros 2 e 1',()=>{
    const duration=PLAYER_ANIMATIONS.jump.duration;
    expect(playerAnimationFrame('jump',duration*0.15)).toBe(1);
    expect(playerAnimationFrame('jump',duration*0.17)).toBe(2);
    expect(playerAnimationFrame('jump',duration*0.3+0.001)).toBe(3);
    expect(playerAnimationFrame('jump',duration*0.3+0.071)).toBe(4);
    expect(playerAnimationFrame('jump',duration*0.3+0.141)).toBe(5);
    expect(playerAnimationFrame('jump',duration*0.3+0.211)).toBe(3);
    expect(playerJumpLandingFrame(0.18)).toBe(1);
    expect(playerJumpLandingFrame(0.08)).toBe(0);
  });
  it('arremessa com os quadros 2, 4, 5 e segura o 6 durante a saída do item',()=>{
    expect(PLAYER_ANIMATIONS.itemThrow.duration).toBe(BATTLE_ITEM_THROW_SECONDS);
    expect(playerAnimationFrame('itemThrow',0)).toBe(1);
    expect(playerAnimationFrame('itemThrow',0.06)).toBe(3);
    expect(playerAnimationFrame('itemThrow',0.12)).toBe(4);
    expect(playerAnimationFrame('itemThrow',BATTLE_ITEM_RELEASE_SECONDS)).toBe(5);
    expect(playerAnimationFrame('itemThrow',BATTLE_ITEM_THROW_SECONDS-0.01)).toBe(5);
  });
  it('solta a carta elemental ao concluir o gesto de invocação, antes de a criatura aparecer',()=>{
    expect(playerIntroCardPose(0)).toEqual({animation:'summon',frame:0});
    expect(playerIntroCardPose(BATTLE_SUMMON_CARD_RELEASE_SECONDS-0.01)).toEqual({animation:'summon',frame:5});
    expect(playerIntroCardPose(BATTLE_SUMMON_CARD_RELEASE_SECONDS)).toEqual({animation:'command',frame:3});
    expect(summonCardFlightProgress(BATTLE_SUMMON_CARD_RELEASE_SECONDS-0.01)).toBeNull();
    expect(summonCardFlightProgress(BATTLE_SUMMON_CARD_RELEASE_SECONDS)).toBe(0);
    expect(summonCardFlightProgress((BATTLE_SUMMON_CARD_RELEASE_SECONDS+BATTLE_SUMMON_CARD_ARRIVE_SECONDS)/2)).toBeCloseTo(0.5);
    expect(summonCardFlightProgress(BATTLE_SUMMON_CARD_ARRIVE_SECONDS)).toBeNull();
  });
  it('espera a carta voltar no quadro 6, guarda com 5 e 4 e só então comemora',()=>{
    expect(playerVictoryCardPose(0)).toEqual({animation:'cardRecall',frame:0});
    expect(playerVictoryCardPose(0.55)).toEqual({animation:'cardRecall',frame:5});
    expect(playerVictoryCardPose(BATTLE_RECALL_END_SECONDS-0.01)).toEqual({animation:'cardRecall',frame:5});
    expect(playerVictoryCardPose(BATTLE_RECALL_END_SECONDS)).toEqual({animation:'cardRecall',frame:4});
    expect(playerVictoryCardPose(BATTLE_RECALL_END_SECONDS+BATTLE_CARD_STOW_SECONDS/2)).toEqual({animation:'cardRecall',frame:3});
    expect(playerVictoryCardPose(BATTLE_RECALL_END_SECONDS+BATTLE_CARD_STOW_SECONDS)).toEqual({animation:'victory',frame:0});
    expect(SPRITE_FOOT_V['/art/people/player-anim-cardRecall.png']).toHaveLength(6);
  });
  it('mede a âncora dos pés para os sete quadros da caminhada',()=>{
    expect(SPRITE_FOOT_V['/art/people/player-anim-walk.png']).toHaveLength(7);
  });
});
