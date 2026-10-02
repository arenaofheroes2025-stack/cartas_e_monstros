import * as THREE from 'three';
import { spriteFootV } from './spriteAnchors';
import { PLAYER_ANIMATIONS, type PlayerAnimation } from './playerAnimations';

const imageCache = new Map<string, THREE.Texture>();
const stripCache = new Map<string, THREE.Texture[]>();

function configure(texture: THREE.Texture): THREE.Texture {
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function imageTexture(path: string, smooth = false): THREE.Texture {
  const key = (smooth ? 'smooth:' : 'pixel:') + path;
  const cached = imageCache.get(key);
  if (cached) return cached;
  const texture = configure(new THREE.TextureLoader().load(path));
  texture.userData.footV = spriteFootV(path);
  if (smooth) {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
  }
  imageCache.set(key, texture);
  return texture;
}

function stripFrames(path: string, count = 6): THREE.Texture[] {
  const key = `${path}:${count}`;
  const cached = stripCache.get(key);
  if (cached) return cached;
  const frames = Array.from({length:count},(_,index)=>{
    const texture=configure(new THREE.Texture());
    texture.repeat.set(1/count,1);
    texture.offset.set(index/count,0);
    texture.userData.footV=spriteFootV(path,index);
    return texture;
  });
  const image=new Image();
  image.onload=()=>frames.forEach(texture=>{texture.image=image;texture.needsUpdate=true;});
  image.src=path;
  stripCache.set(key,frames);
  return frames;
}

export function monsterTexture(speciesId: string, frame = 0): THREE.Texture {
  return stripFrames(`/art/creatures/${speciesId}.png`)[Math.max(0,Math.min(5,frame))];
}

export function monsterPortrait(speciesId: string): string {
  return `/art/creatures/${speciesId}-idle.png`;
}

export function personTexture(role: 'player'|'artisan'|'healer'|'keeper'|'guardian'|'cartographer'|'botanist'|'baker'|'courier', frame = 0): THREE.Texture {
  if (role==='player') return playerTexture('idle',frame);
  if (role==='cartographer'||role==='botanist'||role==='baker'||role==='courier') return stripFrames(`/art/people/${role}.png`,3)[Math.max(0,Math.min(2,frame))];
  return imageTexture(`/art/people/${role}.png`,true);
}

export function playerTexture(animation: PlayerAnimation, frame = 0): THREE.Texture {
  const count=PLAYER_ANIMATIONS[animation].frames;
  return stripFrames(`/art/people/player-anim-${animation}.png`,count)[Math.max(0,Math.min(count-1,frame))];
}

export function personPortrait(role: 'player'|'artisan'|'healer'|'keeper'|'guardian'): string {
  return role==='player' ? '/art/people/player-idle.png' : `/art/people/${role}.png`;
}

export function terrainAtlas(): THREE.Texture {
  return imageTexture('/art/terrain-atlas.png');
}
