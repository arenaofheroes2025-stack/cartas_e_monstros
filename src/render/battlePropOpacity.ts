import { BATTLE_INTRO_SECONDS, BATTLE_RECALL_END_SECONDS, BATTLE_ZOOM_OUT_END_SECONDS, CAPTURE_RECALL_END_SECONDS, CAPTURE_ZOOM_OUT_END_SECONDS } from '../game/game';

interface BattleFadeState { intro:number; finisher?:{elapsed:number}; captureSequence?:{elapsed:number;success:boolean} }

function smoothstep(value:number,start:number,end:number):number {
  const t=Math.max(0,Math.min(1,(value-start)/(end-start)));
  return t*t*(3-2*t);
}

/** The prop fade follows simulation time, so pausing the game also pauses the fade. */
export function battlePropOpacity(battle:BattleFadeState|null,previous:number,delta:number):number {
  if(battle?.captureSequence?.success)
    return smoothstep(battle.captureSequence.elapsed,CAPTURE_RECALL_END_SECONDS,CAPTURE_ZOOM_OUT_END_SECONDS);
  if(battle?.finisher)
    return smoothstep(battle.finisher.elapsed,BATTLE_RECALL_END_SECONDS,BATTLE_ZOOM_OUT_END_SECONDS);
  if(battle)
    return 1-smoothstep(BATTLE_INTRO_SECONDS-battle.intro,0.06,0.75);
  return Math.min(1,previous+delta/0.7);
}
