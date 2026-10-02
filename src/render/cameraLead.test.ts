import { describe,expect,it } from 'vitest';
import { cameraLookAhead, smoothCameraLookAhead } from './cameraLead';

describe('câmera de exploração',()=>{
  it('mostra a direção real do movimento nos quatro sentidos',()=>{
    expect(cameraLookAhead(4,0,1280,800)).toEqual({x:1.8,z:0});
    expect(cameraLookAhead(-4,0,1280,800)).toEqual({x:-1.8,z:0});
    expect(cameraLookAhead(0,4,1280,800)).toEqual({x:0,z:1.8});
    expect(cameraLookAhead(0,-4,1280,800)).toEqual({x:0,z:-1.8});
  });
  it('volta ao centro sem deslocamento e usa um avanço menor no celular',()=>{
    expect(cameraLookAhead(0,0,844,390)).toEqual({x:0,z:0});
    expect(cameraLookAhead(0.2,0,844,390)).toEqual({x:0,z:0});
    expect(cameraLookAhead(4,0,844,390).x).toBeLessThan(cameraLookAhead(4,0,1280,800).x);
    expect(cameraLookAhead(2,0,844,390).x).toBeGreaterThan(0);
    expect(cameraLookAhead(2,0,844,390).x).toBeLessThan(cameraLookAhead(4,0,844,390).x);
  });
  it('entra e sai do avanço lentamente, no mesmo ritmo',()=>{
    const center={x:0,z:0};
    const ahead={x:1.8,z:0};
    const entering=smoothCameraLookAhead(center,ahead,0.2);
    const returning=smoothCameraLookAhead(ahead,center,0.2);
    expect(entering.x).toBeGreaterThan(0);
    expect(entering.x).toBeLessThan(ahead.x*0.3);
    expect(returning.x).toBeCloseTo(ahead.x-entering.x);
    expect(smoothCameraLookAhead(center,ahead,1).x).toBeLessThan(ahead.x*0.3);
  });
});
