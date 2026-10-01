import { useEffect, useRef } from 'react';
import { type Controls } from '../input/useControls';
import { joystickMovement } from '../input/joystickMovement';
import { Game } from '../game/game';
import './touchControls.css';

export function TouchControls({game,controls}:{game:Game;controls:Controls}) {
  const zoneRef=useRef<HTMLDivElement>(null);
  const baseRef=useRef<HTMLDivElement>(null);
  const thumbRef=useRef<HTMLDivElement>(null);
  const controlsRef=useRef(controls);
  const activePointer=useRef<number|null>(null);
  const origin=useRef({x:0,y:0});
  const lastTouchJump=useRef(0);
  controlsRef.current=controls;
  const release=()=>{
    if(activePointer.current===null)return;
    activePointer.current=null;
    controlsRef.current.release();
    if(baseRef.current)baseRef.current.style.opacity='0';
    if(thumbRef.current)thumbRef.current.style.transform='translate(-50%,-50%)';
  };
  useEffect(()=>{
    window.addEventListener('blur',release);
    const hidden=()=>{if(document.hidden)release();};
    document.addEventListener('visibilitychange',hidden);
    return()=>{
      window.removeEventListener('blur',release);
      document.removeEventListener('visibilitychange',hidden);
      release();
    };
  },[]);
  const move=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.pointerId!==activePointer.current)return;
    const dx=event.clientX-origin.current.x,dy=event.clientY-origin.current.y;
    const length=Math.hypot(dx,dy);
    const scale=length>52?52/length:1;
    const x=dx*scale,y=dy*scale;
    if(thumbRef.current)thumbRef.current.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px)`;
    const direction=joystickMovement({x:x/52,y:-y/52});
    controlsRef.current.touch(direction.x,direction.y);
  };
  return <>
    <div ref={zoneRef} className="mobile-joystick-zone" aria-label="Toque e arraste para andar"
      onPointerDown={event=>{
        if(activePointer.current!==null||event.pointerType==='mouse')return;
        activePointer.current=event.pointerId;
        origin.current={x:event.clientX,y:event.clientY};
        event.currentTarget.setPointerCapture(event.pointerId);
        const bounds=event.currentTarget.getBoundingClientRect();
        if(baseRef.current){
          baseRef.current.style.left=`${event.clientX-bounds.left}px`;
          baseRef.current.style.top=`${event.clientY-bounds.top}px`;
          baseRef.current.style.opacity='1';
        }
        move(event);
      }}
      onPointerMove={move}
      onPointerUp={event=>{if(event.pointerId===activePointer.current)release();}}
      onPointerCancel={event=>{if(event.pointerId===activePointer.current)release();}}
      onLostPointerCapture={event=>{if(event.pointerId===activePointer.current)release();}}>
      <div ref={baseRef} className="mobile-joystick-base"><div ref={thumbRef} className="mobile-joystick-thumb"/></div>
    </div>
    <div className="touch-controls">
      <button type="button" className={`touch-jump ${game.mode==='battle'?'battle-jump':''}`}
        onPointerDown={event=>{if(event.pointerType==='touch'){lastTouchJump.current=Date.now();game.jumpForward();}}}
        onClick={event=>{if((event.nativeEvent as PointerEvent).pointerType!=='touch'&&Date.now()-lastTouchJump.current>2000)game.jumpForward();}}
        aria-label="Pular">Pular</button>
    </div>
  </>;
}
