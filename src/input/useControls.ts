import { useEffect, useRef } from 'react';
import { Game } from '../game/game';
import { dialogChoiceIndex } from './dialogChoices';
import { ELEMENTS } from '../game/content';
import { battleKeyAction } from './battleKeys';

export interface Controls { touch: (x:number,y:number)=>void; release:()=>void }

export function useControls(game:Game,blocked=false,onBag?:()=>void):Controls {
  const keys=useRef(new Set<string>());
  const touch=useRef({x:0,y:0});
  const qHeldViaRepeat=useRef(false);
  const update=()=>{
    if(blocked||game.battleMenu==='items'||game.battleMenu==='cards'){game.setMove(0,0);return;}
    const arrowsOnly=game.mode==='battle';
    const right=(keys.current.has('arrowright')||(!arrowsOnly&&keys.current.has('d'))?1:0)-
      (keys.current.has('arrowleft')||(!arrowsOnly&&keys.current.has('a'))?1:0)+touch.current.x;
    const down=(keys.current.has('arrowdown')||(!arrowsOnly&&keys.current.has('s'))?1:0)-
      (keys.current.has('arrowup')||(!arrowsOnly&&keys.current.has('w'))?1:0)+touch.current.y;
    game.setMove((right+down)*Math.SQRT1_2,(-right+down)*Math.SQRT1_2);
  };
  useEffect(()=>{
    if(blocked){keys.current.clear();touch.current={x:0,y:0};game.setMove(0,0);}
    const down=(event:KeyboardEvent)=>{
      if(blocked)return;
      const target=event.target as HTMLElement;
      if(target?.tagName==='INPUT'||target?.tagName==='TEXTAREA')return;
      const key=event.key.toLowerCase();
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))event.preventDefault();
      keys.current.add(key);update();
      if(event.repeat){if(key==='q'&&game.battleMenu==='items')qHeldViaRepeat.current=true;return;}
      if(key==='q')qHeldViaRepeat.current=false;
      if(game.mode==='dialog'){
        const choice=dialogChoiceIndex(key);
        if(choice>=0){
          event.preventDefault();
          if(key==='z'&&game.dialog?.actions.length===0)game.interact();
          else game.chooseDialogAction(choice);
          return;
        }
      }
      if(game.mode==='battle'){
        if(game.battleMenu==='cards'){
          if(key==='s'||key==='escape'){event.preventDefault();game.closeBattleMenu();return;}
          if(/^[1-3]$/.test(key)){event.preventDefault();game.selectBattleCard(ELEMENTS[Number(key)-1]);return;}
          if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
            event.preventDefault();
            const index=ELEMENTS.indexOf(game.selectedBattleCard);
            const direction=['arrowleft','arrowup'].includes(key)?-1:1;
            game.selectBattleCard(ELEMENTS[(index+direction+ELEMENTS.length)%ELEMENTS.length]);return;
          }
          if(key==='z'||key==='enter'){event.preventDefault();game.useSelectedBattleCard();return;}
          return;
        }
        if(game.battleMenu==='items'){
          if(key==='q'||key==='i'||key==='escape'){
            event.preventDefault();game.closeBattleMenu();return;
          }
          if(/^[1-6]$/.test(key)){
            event.preventDefault();game.selectBattleBagSlot(Number(key)-1);return;
          }
          const direction:Record<string,number>={arrowleft:-1,arrowright:1,arrowup:-2,arrowdown:2,
            a:-1,d:1,w:-2,s:2};
          if(key in direction){event.preventDefault();game.selectBattleBagSlot(Math.max(0,Math.min(5,game.selectedBattleBagSlot+direction[key])));return;}
          if(key==='z'||key==='enter'){event.preventDefault();game.useSelectedBattleItem();return;}
          return;
        }
        if(key==='q'||key==='i'){
          event.preventDefault();game.openBattleMenu('items');return;
        }
        const action=battleKeyAction(key,game.battle?.command==='follow');
        if(action){
          event.preventDefault();
          if(action==='cards')game.openBattleMenu('cards');
          else game.battleCommand(action);
          return;
        }
      }
      if(key==='i'&&game.mode==='explore'){event.preventDefault();onBag?.();return;}
      if(key==='z'&&game.mode==='explore'){event.preventDefault();game.interact();}
      if(key===' ')game.jumpForward();
      if(key==='escape')game.togglePause();
      if(key==='f')game.flee();
    };
    const up=(event:KeyboardEvent)=>{
      const key=event.key.toLowerCase();keys.current.delete(key);
      if(key==='q'&&qHeldViaRepeat.current){
        qHeldViaRepeat.current=false;
        if(game.battleMenu==='items')game.closeBattleMenu();
      }
      update();
    };
    const blur=()=>{keys.current.clear();touch.current={x:0,y:0};update();};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return ()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
  },[game,blocked,onBag]);
  return {
    touch:(x,y)=>{if(blocked)return;touch.current={x,y};update();},
    release:()=>{touch.current={x:0,y:0};update();}
  };
}
