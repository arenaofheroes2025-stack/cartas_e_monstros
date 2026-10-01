import { describe,expect,it } from 'vitest';
import { joystickMovement } from './joystickMovement';

describe('joystickMovement',()=>{
  it('converts upward joystick motion to upward game motion',()=>{
    expect(joystickMovement({x:0,y:1})).toEqual({x:0,y:-1});
    expect(joystickMovement({x:-1,y:0})).toEqual({x:-1,y:0});
  });
  it('ignores tiny motion and clamps oversized input',()=>{
    expect(joystickMovement({x:0.05,y:0.05})).toEqual({x:0,y:0});
    const result=joystickMovement({x:3,y:4});
    expect(Math.hypot(result.x,result.y)).toBeCloseTo(1);
  });
});
