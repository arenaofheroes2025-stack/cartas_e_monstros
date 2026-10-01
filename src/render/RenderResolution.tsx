import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { adjustedRenderDpr, maximumRenderDpr, preferredRenderDpr, type RenderQuality } from './resolutionBudget';

/** Scale only the WebGL buffer. HTML controls keep their native sharpness. */
export function RenderResolution({quality}:{quality:RenderQuality}) {
  const {size,gl,setDpr}=useThree();
  const preferred=preferredRenderDpr(size.width,size.height,window.devicePixelRatio,quality);
  const maximum=maximumRenderDpr(window.devicePixelRatio,quality);
  const sample=useRef({seconds:0,frames:0,fastWindows:0,readyAt:0});

  useEffect(()=>{
    setDpr(preferred);
    sample.current={seconds:0,frames:0,fastWindows:0,readyAt:performance.now()+2000};
  },[preferred,setDpr]);

  useFrame((_,delta)=>{
    if(document.hidden||performance.now()<sample.current.readyAt||delta>0.12)return;
    sample.current.seconds+=delta;
    sample.current.frames++;
    if(sample.current.seconds<2)return;
    const averageFrameMs=sample.current.seconds*1000/sample.current.frames;
    sample.current.fastWindows=averageFrameMs<14?sample.current.fastWindows+1:0;
    const current=gl.getPixelRatio();
    const next=adjustedRenderDpr(current,maximum,averageFrameMs,sample.current.fastWindows);
    if(Math.abs(next-current)>0.015){
      setDpr(next);
      sample.current.fastWindows=0;
    }
    sample.current.seconds=0;
    sample.current.frames=0;
  });
  return null;
}
