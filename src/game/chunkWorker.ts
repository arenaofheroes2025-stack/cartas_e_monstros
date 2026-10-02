/// <reference lib="webworker" />
import { generateSeededChunk } from './chunkWorld';

self.onmessage=(event:MessageEvent<{seed:number;x:number;z:number}>)=>{
  const {seed,x,z}=event.data;
  try { self.postMessage({ok:true,chunk:generateSeededChunk(seed,x,z)}); }
  catch(error){self.postMessage({ok:false,x,z,error:String(error)});}
};
