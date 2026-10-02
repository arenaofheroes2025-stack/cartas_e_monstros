import { describe, expect, it } from 'vitest';
import { BIRD_FLEE_DISTANCE, BIRD_FLUTTER_SECONDS, birdAirScale, birdCanStartFlight,
  birdFleePose, birdFlutterDelay, birdLookDelay, birdPresence, birdQuietHours,
  birdShadowOpacity, birdSites } from './ambientBirds';
import { generateWorld, tileAt } from './world';

describe('pássaros de cenário', () => {
  it('repete os pousos para a mesma semente e escolhe solo livre ou árvores', () => {
    const world=generateWorld(40732);
    const first=birdSites(world);
    expect(birdSites(generateWorld(40732))).toEqual(first);
    expect(first.some(bird=>bird.perch==='ground')).toBe(true);
    expect(first.some(bird=>bird.perch==='tree')).toBe(true);
    expect(first.some(bird=>bird.perch==='high')).toBe(true);
    expect(first.some(bird=>bird.perch==='roof')).toBe(true);
    expect(first.filter(bird=>bird.perch==='ground').length).toBeLessThanOrEqual(12);
    expect(new Set(first.map(bird=>bird.species)).size).toBe(3);
    for(const bird of first){
      const tile=tileAt(world,Math.floor(bird.x),Math.floor(bird.z));
      expect(tile).toBeDefined();
      if(bird.perch==='ground'||bird.perch==='high'){
        expect(tile!.blocked).toBe(false);
        expect(tile!.prop).toBeNull();
        expect(['grass','stone']).toContain(tile!.terrain);
        expect(tile!.height>=2).toBe(bird.perch==='high');
        expect(Math.hypot(bird.x-world.start.x,bird.z-world.start.z)).toBeGreaterThan(12);
        for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)
          expect(['water','path','bridge','plaza']).not.toContain(
            tileAt(world,tile!.x+dx,tile!.z+dz)?.terrain);
        for(const building of [...world.places,...world.decorations])
          expect(Math.hypot(bird.x-(building.x+0.5),bird.z-(building.z+0.5)))
            .toBeGreaterThanOrEqual(9);
      }else if(bird.perch==='tree')
        expect(['tree','pine','copper-tree','marsh-willow']).toContain(tile!.prop);
      else {
        const building=[...world.places,...world.decorations].find(building=>
          bird.id===`bird-roof-${building.id}`);
        expect(building).toBeDefined();
        expect(Math.hypot(bird.x-(building!.x+0.5),bird.z-(building!.z+0.5)))
          .toBeLessThan(1);
        expect(bird.perchHeight).toBeGreaterThan(4);
      }
    }
    for(const birds of [first.filter(bird=>bird.perch==='ground'),
      first.filter(bird=>bird.perch==='high'),first.filter(bird=>bird.perch==='tree'),
      first.filter(bird=>bird.perch==='roof')])
      for(let i=0;i<birds.length;i++)for(let j=i+1;j<birds.length;j++)
        expect(Math.hypot(birds[i].x-birds[j].x,birds[i].z-birds[j].z)).toBeGreaterThanOrEqual(
          birds[i].perch==='ground'?14:birds[i].perch==='high'?13:10);
  });

  it('bate as asas antes de avançar; mantém o voo e a sombra até sair da câmera', () => {
    expect(BIRD_FLEE_DISTANCE).toBe(2.5);
    expect(birdFleePose(0.1)).toMatchObject({distance:0,lift:0});
    expect(birdFleePose(0.35).lift).toBeGreaterThan(0);
    expect(birdFleePose(0.8).distance).toBeGreaterThan(birdFleePose(0.35).distance);
    expect(birdShadowOpacity(0)).toBeGreaterThan(birdShadowOpacity(1.5));
    expect(birdShadowOpacity(3.4)).toBeGreaterThan(0);
    expect(birdFleePose(3).distance).toBeGreaterThan(birdFleePose(1.85).distance);
    expect(birdFleePose(3).opacity).toBe(1);
    expect(birdAirScale(3,3)).toBeGreaterThan(birdAirScale(1,3));
    expect(birdAirScale(3,3)).toBeGreaterThan(birdAirScale(3,18));
  });

  it('espaça os gestos de asas de cada pássaro sem sincronizar o bando', () => {
    const birds=birdSites(generateWorld(40732)).slice(0,12);
    const delays=birds.map(bird=>birdFlutterDelay(bird,1));
    expect(new Set(delays).size).toBe(12);
    expect(delays.every(delay=>delay>=5&&delay<13)).toBe(true);
    expect(birdFlutterDelay(birds[0],2)).not.toBe(delays[0]);
    expect(new Set(birds.map(bird=>birdLookDelay(bird,1))).size).toBe(12);
    expect(BIRD_FLUTTER_SECONDS).toBeLessThan(Math.min(...delays));
  });

  it('à noite mantém só parte dos pássaros pousados em árvores e casas', () => {
    const sites=birdSites(generateWorld(40732));
    const visibleAt=(hour:number)=>sites.filter(site=>birdPresence(site,hour)>0);
    for(const hour of [19,23.5,0,5.99]){
      expect(birdQuietHours(hour)).toBe(true);
      expect(birdCanStartFlight(hour)).toBe(false);
      const visible=visibleAt(hour);
      expect(visible.length).toBeLessThan(sites.length/2);
      expect(visible.some(site=>site.perch==='roof')).toBe(true);
      expect(visible.some(site=>site.perch==='tree')).toBe(true);
      expect(visible.every(site=>site.perch==='roof'||site.perch==='tree')).toBe(true);
    }
    expect(birdQuietHours(18.99)).toBe(false);
    expect(birdCanStartFlight(18.5)).toBe(false);
    expect(birdQuietHours(6)).toBe(false);
    expect(birdCanStartFlight(6)).toBe(true);
    const ground=sites.find(site=>site.perch==='ground')!;
    expect(birdPresence(ground,18.8)).toBeGreaterThan(0);
    expect(birdPresence(ground,18.8)).toBeLessThan(1);
    expect(birdPresence(ground,19)).toBe(0);
    expect(birdPresence(ground,6)).toBe(0);
    expect(birdPresence(ground,6.25)).toBe(1);
  });
});
