import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { visibleLightIds } from './lightCulling';

describe('luzes da área visível',()=>{
  it('mantém uma fonte visível mesmo quando o jogador está longe e remove a fonte fora da câmera',()=>{
    const camera=new THREE.OrthographicCamera(-10,10,10,-10,0.1,100);
    camera.position.set(0,18,18);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
    const sources=[
      {id:'visible',x:7,y:2,z:0,reach:2},
      {id:'far',x:80,y:2,z:80,reach:2}
    ];
    expect(visibleLightIds(camera,sources,new Set())).toEqual(['visible']);
  });
  it('usa uma margem maior para desligar uma luz já ativa',()=>{
    const camera=new THREE.OrthographicCamera(-10,10,10,-10,0.1,100);
    camera.position.set(0,18,18);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
    const edge={id:'edge',x:17,y:1,z:0,reach:0};
    expect(visibleLightIds(camera,[edge],new Set(),2,8)).toEqual([]);
    expect(visibleLightIds(camera,[edge],new Set(['edge']),2,8)).toEqual(['edge']);
  });
  it('mantém todas as fontes que iluminam o enquadramento, sem limite por proximidade do herói',()=>{
    const camera=new THREE.OrthographicCamera(-12,12,9,-9,0.1,100);
    camera.position.set(0,18,18);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
    const sources=Array.from({length:12},(_,index)=>({id:`poste-${index}`,x:index-6,y:2,z:0,reach:3}));
    expect(visibleLightIds(camera,sources,new Set()).sort()).toEqual(sources.map(source=>source.id).sort());
  });
});
