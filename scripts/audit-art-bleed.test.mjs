import assert from 'node:assert/strict';
import test from 'node:test';
import { removeDetachedBleed } from './audit-art-bleed.mjs';

test('removes neighboring cell fragments without cutting the main sprite',()=>{
  const width=40,height=40,pixels=Buffer.alloc(width*height*4);
  const paint=(x,y,alpha=255)=>{pixels[(y*width+x)*4+3]=alpha;};
  for(let y=12;y<=31;y++)for(let x=13;x<=27;x++)paint(x,y);
  for(let x=10;x<=12;x++)paint(x,20); // Attached branch belongs to the sprite.
  for(let y=1;y<=3;y++)for(let x=17;x<=24;x++)paint(x,y);
  for(let y=17;y<=20;y++)for(let x=1;x<=3;x++)paint(x,y);
  paint(21,5,20); // Soft fringe around the stray top fragment.
  const result=removeDetachedBleed(pixels,width,height);
  const alpha=(x,y)=>result.pixels[(y*width+x)*4+3];
  assert.equal(result.removed,2);
  assert.equal(alpha(18,2),0);
  assert.equal(alpha(21,5),0);
  assert.equal(alpha(2,18),0);
  assert.equal(alpha(11,20),255);
  assert.equal(alpha(20,20),255);
});
