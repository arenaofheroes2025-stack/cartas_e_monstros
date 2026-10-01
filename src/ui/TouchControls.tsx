import { type Controls } from '../input/useControls';
import { Game } from '../game/game';
import './touchControls.css';

export function TouchControls({game,controls}:{game:Game;controls:Controls}) {
  const move=(x:number,y:number)=>(event:React.PointerEvent<HTMLButtonElement>)=>{
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);controls.touch(x,y);
  };
  const stop=(event:React.PointerEvent<HTMLButtonElement>)=>{event.preventDefault();controls.release();};
  return <div className="touch-controls">
    <div className="dpad" aria-label="Controle de movimento">
      <button className="up" onPointerDown={move(0,-1)} onPointerUp={stop} onPointerCancel={stop} aria-label="Andar para cima">▲</button>
      <button className="left" onPointerDown={move(-1,0)} onPointerUp={stop} onPointerCancel={stop} aria-label="Andar para a esquerda">◀</button>
      <button className="right" onPointerDown={move(1,0)} onPointerUp={stop} onPointerCancel={stop} aria-label="Andar para a direita">▶</button>
      <button className="down" onPointerDown={move(0,1)} onPointerUp={stop} onPointerCancel={stop} aria-label="Andar para baixo">▼</button>
    </div>
    {game.mode==='explore'||game.mode==='battle'?
      <button className={`touch-jump ${game.mode==='battle'?'battle-jump':''}`} onClick={()=>game.jumpForward()} aria-label="Pular">Pular</button>
    :null}
  </div>;
}
