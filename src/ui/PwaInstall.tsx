import { useCallback, useEffect, useState } from 'react';
import './pwaInstall.css';

interface InstallPromptEvent extends Event {
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:'accepted'|'dismissed';platform:string}>;
}

function isStandalone():boolean {
  return window.matchMedia('(display-mode: standalone)').matches||
    Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
}

export interface PwaInstallState {
  installed:boolean;
  available:boolean;
  secure:boolean;
  ios:boolean;
  helpOpen:boolean;
  install:()=>Promise<void>;
  closeHelp:()=>void;
}

export function usePwaInstall():PwaInstallState {
  const [installed,setInstalled]=useState(isStandalone);
  const [deferred,setDeferred]=useState<InstallPromptEvent|null>(null);
  const [helpOpen,setHelpOpen]=useState(false);
  const secure=window.isSecureContext;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||
    (/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);

  useEffect(()=>{
    const display=window.matchMedia('(display-mode: standalone)');
    const onDisplayChange=()=>setInstalled(isStandalone());
    const onPrompt=(event:Event)=>{
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    const onInstalled=()=>{setInstalled(true);setDeferred(null);setHelpOpen(false);};
    display.addEventListener('change',onDisplayChange);
    window.addEventListener('beforeinstallprompt',onPrompt);
    window.addEventListener('appinstalled',onInstalled);
    return()=>{
      display.removeEventListener('change',onDisplayChange);
      window.removeEventListener('beforeinstallprompt',onPrompt);
      window.removeEventListener('appinstalled',onInstalled);
    };
  },[]);

  const install=useCallback(async()=>{
    if(!secure||ios||!deferred){setHelpOpen(true);return;}
    const prompt=deferred;
    setDeferred(null);
    try {
      await prompt.prompt();
      const choice=await prompt.userChoice;
      if(choice.outcome==='dismissed')setHelpOpen(true);
    } catch {setHelpOpen(true);}
  },[secure,ios,deferred]);

  return {installed,available:!!deferred&&!ios,secure,ios,helpOpen,install,
    closeHelp:()=>setHelpOpen(false)};
}

export function PwaInstallButton({pwa}:{pwa:PwaInstallState}) {
  if(pwa.installed)return null;
  return <button type="button" className="secondary pwa-install-button" onClick={()=>void pwa.install()}>
    <span aria-hidden="true">⬇</span>{pwa.available?'Instalar jogo':'Como instalar'}
  </button>;
}

export function PwaInstallHelp({pwa}:{pwa:PwaInstallState}) {
  if(!pwa.helpOpen)return null;
  return <div className="overlay pwa-install-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)pwa.closeHelp();}}>
    <section className="modal-panel pwa-install-panel" role="dialog" aria-modal="true" aria-label="Instalação do jogo">
      <button type="button" className="close-button" onClick={pwa.closeHelp} aria-label="Fechar instruções">✕</button>
      <img src="/art/pwa-192.png" alt="" className="pwa-install-icon"/>
      <div className="eyebrow">LEVE O JOGO COM VOCÊ</div>
      <h2>Instalar Cartas & Monstros</h2>
      {!pwa.secure?<p>Esta prévia por HTTP na rede local permite jogar, mas a instalação no celular exige uma versão HTTPS do jogo.</p>:
        pwa.ios?<p>No Safari, toque em <strong>Compartilhar</strong> e escolha <strong>Adicionar à Tela de Início</strong>. Depois, abra o jogo pelo novo ícone.</p>:
        <p>Abra o menu do navegador e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>. Depois, abra o jogo pelo novo ícone.</p>}
      <small>Após o primeiro carregamento completo, os arquivos do jogo ficam disponíveis offline neste dispositivo.</small>
      <button type="button" className="primary" onClick={pwa.closeHelp}>Entendi</button>
    </section>
  </div>;
}
