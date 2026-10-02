import { BATTLE_CARD_STOW_SECONDS, BATTLE_ITEM_RELEASE_SECONDS, BATTLE_ITEM_THROW_SECONDS, BATTLE_RECALL_END_SECONDS, BATTLE_SUMMON_CARD_ARRIVE_SECONDS, BATTLE_SUMMON_CARD_RELEASE_SECONDS, PLAYER_JUMP_LAND_SECONDS, PLAYER_JUMP_TAKEOFF } from '../game/game';

export const PLAYER_ANIMATIONS = {
  idle: { frames: 4, duration: 1, loop: true },
  walk: { frames: 7, duration: 0.7, loop: true },
  jump: { frames: 6, duration: 0.56, loop: false },
  summon: { frames: 6, duration: 0.9, loop: false },
  cardRecall: { frames: 6, duration: 0.6, loop: false },
  itemThrow: { frames: 6, duration: BATTLE_ITEM_THROW_SECONDS, loop: false },
  pickup: { frames: 4, duration: 0.6, loop: false },
  command: { frames: 4, duration: 0.4, loop: false },
  talk: { frames: 4, duration: 0.8, loop: true },
  victory: { frames: 6, duration: 1, loop: false },
  defeat: { frames: 6, duration: 1, loop: false }
} as const;

export type PlayerAnimation = keyof typeof PLAYER_ANIMATIONS;

export function playerAnimationFrame(animation: PlayerAnimation, elapsed: number): number {
  const {frames, duration, loop} = PLAYER_ANIMATIONS[animation];
  const progress = Math.max(0, elapsed) / duration;
  if(animation==='jump'){
    const t=Math.min(1,progress);
    if(t<PLAYER_JUMP_TAKEOFF)return 1;
    if(t<0.3)return 2;
    return 3+Math.floor((Math.max(0,elapsed-duration*0.3)/0.07))%3;
  }
  if(animation==='itemThrow'){
    if(elapsed<0.06)return 1;
    if(elapsed<0.12)return 3;
    if(elapsed<BATTLE_ITEM_RELEASE_SECONDS)return 4;
    return 5;
  }
  return loop
    ? Math.floor(Math.max(0,progress-Math.floor(progress+1e-9))*frames)
    : Math.min(frames - 1, Math.floor(progress * frames));
}

export function playerJumpLandingFrame(remaining: number): number {
  return remaining>PLAYER_JUMP_LAND_SECONDS/2?1:0;
}

export function playerIntroCardPose(elapsed:number):{animation:'summon'|'command';frame:number} {
  return elapsed<BATTLE_SUMMON_CARD_RELEASE_SECONDS
    ?{animation:'summon',frame:playerAnimationFrame('summon',elapsed)}
    :{animation:'command',frame:PLAYER_ANIMATIONS.command.frames-1};
}

export function summonCardFlightProgress(elapsed:number):number|null {
  if(elapsed<BATTLE_SUMMON_CARD_RELEASE_SECONDS||elapsed>=BATTLE_SUMMON_CARD_ARRIVE_SECONDS)return null;
  return (elapsed-BATTLE_SUMMON_CARD_RELEASE_SECONDS)/(BATTLE_SUMMON_CARD_ARRIVE_SECONDS-BATTLE_SUMMON_CARD_RELEASE_SECONDS);
}

export function playerVictoryCardPose(elapsed:number):{animation:'cardRecall'|'victory';frame:number} {
  if(elapsed<BATTLE_RECALL_END_SECONDS){
    return {animation:'cardRecall',frame:playerAnimationFrame('cardRecall',elapsed)};
  }
  const stow=elapsed-BATTLE_RECALL_END_SECONDS;
  if(stow<BATTLE_CARD_STOW_SECONDS){
    return {animation:'cardRecall',frame:stow<BATTLE_CARD_STOW_SECONDS/2?4:3};
  }
  return {animation:'victory',frame:playerAnimationFrame('victory',stow-BATTLE_CARD_STOW_SECONDS)};
}
