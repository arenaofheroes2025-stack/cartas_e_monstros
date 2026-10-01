import { useEffect, useRef } from 'react';
import nipplejs from 'nipplejs';
import { type Controls } from '../input/useControls';
import { joystickMovement } from '../input/joystickMovement';
import { Game } from '../game/game';
import './touchControls.css';

export function TouchControls({game,controls}:{game:Game;controls:Controls}) {
  const zoneRef=useRef<HTMLDivElement>(null);
  const controlsRef=useRef(controls);
  const lastTouchJump=useRef(0);
  controlsRef.current=controls;
  useEffect(()=>{
    if(!zoneRef.current||!window.matchMedia('(pointer: coarse) and (orientation: landscape)').matches)return;
    const manager=nipplejs.create({
      zone:zoneRef.current,
      mode:'dynamic',
      multitouch:true,
      maxNumberOfJoysticks:1,
      size:104,
      threshold:0.12,
      fadeTime:100,
      color:{front:'rgba(244,194,124,.65)',back:'rgba(19,49,60,.28)'}
    });
    manager.on('move',event=>{
      const direction=joystickMovement(event.data.vector);
      controlsRef.current.touch(direction.x,direction.y);
    });
    const release=()=>controlsRef.current.release();
    const releaseWhenNoTouches=(event:TouchEvent)=>{if(event.touches.length===0)release();};
    manager.on('end',release);
    window.addEventListener('blur',release);
    window.addEventListener('touchend',releaseWhenNoTouches);
    window.addEventListener('touchcancel',releaseWhenNoTouches);
    return()=>{
      window.removeEventListener('blur',release);
      window.removeEventListener('touchend',releaseWhenNoTouches);
      window.removeEventListener('touchcancel',releaseWhenNoTouches);
      manager.destroy();release();
    };
  },[]);
  return <>
    <div ref={zoneRef} className="mobile-joystick-zone" aria-label="Toque e arraste para andar"/>
    <div className="touch-controls">
      <button type="button" className={`touch-jump ${game.mode==='battle'?'battle-jump':''}`}
        onPointerDown={event=>{if(event.pointerType==='touch'){lastTouchJump.current=Date.now();game.jumpForward();}}}
        onClick={event=>{if((event.nativeEvent as PointerEvent).pointerType!=='touch'&&Date.now()-lastTouchJump.current>2000)game.jumpForward();}}
        aria-label="Pular">Pular</button>
    </div>
  </>;
}
