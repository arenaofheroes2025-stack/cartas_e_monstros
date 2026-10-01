import { useSyncExternalStore } from 'react';

const PORTRAIT_PHONE='(pointer: coarse) and (orientation: portrait)';

function subscribe(listener:()=>void):()=>void {
  const query=window.matchMedia(PORTRAIT_PHONE);
  query.addEventListener('change',listener);
  return()=>query.removeEventListener('change',listener);
}

function snapshot():boolean {return window.matchMedia(PORTRAIT_PHONE).matches;}

export function usePortraitLock():boolean {
  return useSyncExternalStore(subscribe,snapshot,()=>false);
}
