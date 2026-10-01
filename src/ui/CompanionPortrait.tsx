import { useEffect, useRef } from 'react';
import { Game } from '../game/game';

export function CompanionPortrait({game,species}:{game:Game;species:string}) {
  const sprite=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    let request=0;
    let previousFrame=-1;
    let previousMoving=false;
    const animate=(time:number)=>{
      const element=sprite.current;
      if(element){
        const moving=game.mode==='explore'&&Math.hypot(game.move.x,game.move.z)>0.08;
        const frame=moving?Math.floor(time/170)%2:0;
        if(frame!==previousFrame){element.style.backgroundPositionX=frame?'20%':'0%';previousFrame=frame;}
        if(moving!==previousMoving){element.classList.toggle('walking',moving);previousMoving=moving;}
      }
      request=requestAnimationFrame(animate);
    };
    request=requestAnimationFrame(animate);
    return()=>cancelAnimationFrame(request);
  },[game,species]);
  return <span ref={sprite} className="companion-sprite" aria-hidden="true"
    style={{backgroundImage:`url(/art/creatures/${species}.png)`}}/>;
}
