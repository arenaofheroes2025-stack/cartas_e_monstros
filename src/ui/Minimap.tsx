import { useEffect, useRef } from 'react';
import { Game } from '../game/game';
import { index } from '../game/world';

export function Minimap({game,revision}:{game:Game;revision:number}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(!canvas.current||!game.world||!game.save)return;
    const ctx=canvas.current.getContext('2d')!;
    const size=game.world.size;
    ctx.fillStyle='#111d2a';ctx.fillRect(0,0,size,size);
    const discovered=new Set(game.save.discovered);
    const colors={grass:{bosque:'#6eaa78',brasa:'#ba7659',lago:'#78a69a'},water:{bosque:'#4f8aa4',brasa:'#4f8aa4',lago:'#4f8aa4'}};
    for(const tile of game.world.tiles) {
      if(!discovered.has(index(tile.x,tile.z)))continue;
      ctx.fillStyle=tile.terrain==='water'?colors.water.lago:tile.terrain==='path'||tile.terrain==='bridge'||tile.terrain==='plaza'?'#d5bd88':colors.grass[tile.biome];
      ctx.fillRect(tile.x,tile.z,1,1);
    }
    for(const place of game.world.places) {
      if(!discovered.has(index(place.x,place.z)))continue;
      ctx.fillStyle=place.kind==='house'?'#f3e1a9':'#f6a3bd';
      ctx.fillRect(place.x-1,place.z-1,3,3);
    }
    ctx.fillStyle='#ffffff';ctx.fillRect(Math.floor(game.player.x)-1,Math.floor(game.player.z)-1,3,3);
  },[game,revision]);
  return <canvas className="minimap" ref={canvas} width={96} height={96} aria-label="Mapa explorado"/>;
}
