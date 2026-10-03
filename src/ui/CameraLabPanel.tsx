import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { cameraProfileZoomScale, cameraZoom, perspectiveFovForZoom } from '../render/cameraZoom';
import { DEFAULT_CAMERA_LAB_SETTINGS, cameraLabExport, type CameraLabSettings } from '../render/cameraLabSettings';
import './cameraLab.css';

type NumericKey = Exclude<keyof CameraLabSettings,'blurEnabled'|'spriteMode'>;

function Slider({id,label,value,min,max,step,unit='',hint,onChange}:{
  id:string;label:string;value:number;min:number;max:number;step:number;unit?:string;
  hint?:string;onChange:(value:number)=>void;
}) {
  return <div className="camera-lab-slider">
    <div><label htmlFor={id}>{label}</label><output htmlFor={id}>{Number(value.toFixed(2))}{unit}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value}
      onChange={event=>onChange(Number(event.target.value))}/>
    {hint&&<small>{hint}</small>}
  </div>;
}

export function CameraLabPanel({settings,setSettings,onClose}:{
  settings:CameraLabSettings;setSettings:Dispatch<SetStateAction<CameraLabSettings>>;onClose:()=>void;
}) {
  const [collapsed,setCollapsed]=useState(false);
  const [copyState,setCopyState]=useState('');
  const exportRef=useRef<HTMLTextAreaElement>(null);
  const width=window.innerWidth,height=window.innerHeight;
  const zoom=Math.round(cameraZoom(width,height,false)*cameraProfileZoomScale(width,settings.zoomScale)*10)/10;
  const fov=perspectiveFovForZoom(height,zoom,settings.distance);
  const exportText=useMemo(()=>cameraLabExport(settings,width,height),[settings,width,height]);
  const update=(key:NumericKey)=>(value:number)=>setSettings(previous=>({...previous,[key]:value}));
  async function copy(){
    try{
      if(navigator.clipboard)await navigator.clipboard.writeText(exportText);
      else throw new Error('clipboard indisponível');
      setCopyState('Configuração copiada');
    }catch{
      const field=exportRef.current;
      field?.focus();field?.select();
      const copied=document.execCommand('copy');
      setCopyState(copied?'Configuração copiada':'Selecione e copie o JSON abaixo');
    }
  }
  return <aside className={`camera-lab${collapsed?' collapsed':''}`} aria-label="Controle de câmera no jogo">
    <header className="camera-lab-header">
      <div><small>TESTE NO JOGO</small><strong>Controle de câmera</strong></div>
      <div className="camera-lab-actions">
        <button onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?'Expandir controles':'Recolher controles'}>
          {collapsed?'Expandir':'Recolher'}</button>
        <button onClick={onClose} aria-label="Sair do controle de câmera">Sair</button>
      </div>
    </header>
    {!collapsed&&<div className="camera-lab-scroll">
      <p className="camera-lab-intro">Ande pelo mapa enquanto ajusta. Sair restaura a câmera normal; os valores ficam guardados para seu próximo teste.</p>
      <section><h3>Enquadramento</h3>
        <Slider id="camera-lab-zoom" label="Zoom" value={settings.zoomScale} min={0.55} max={1.6} step={0.01} unit="×"
          hint={`${zoom} pixels por unidade · FOV ${fov.toFixed(1)}°. Menor mostra mais mapa.`} onChange={update('zoomScale')}/>
        <Slider id="camera-lab-elevation" label="Inclinação vista de cima" value={settings.elevation} min={20} max={75} step={0.5} unit="°" onChange={update('elevation')}/>
        <Slider id="camera-lab-azimuth" label="Rotação ao redor do jogador" value={settings.azimuth} min={-20} max={110} step={0.5} unit="°" onChange={update('azimuth')}/>
        <Slider id="camera-lab-distance" label="Distância da câmera" value={settings.distance} min={10} max={36} step={0.1} unit=" u"
          hint="Muda a perspectiva mantendo o zoom no plano do jogador." onChange={update('distance')}/>
      </section>
      <section><h3>Centro da imagem</h3>
        <Slider id="camera-lab-height" label="Altura do foco" value={settings.focusHeight} min={-3} max={5} step={0.05} unit=" u" onChange={update('focusHeight')}/>
        <Slider id="camera-lab-x" label="Foco X" value={settings.focusX} min={-8} max={8} step={0.05} unit=" u" onChange={update('focusX')}/>
        <Slider id="camera-lab-z" label="Foco Z" value={settings.focusZ} min={-8} max={8} step={0.05} unit=" u" onChange={update('focusZ')}/>
      </section>
      <section><h3>Movimento da câmera</h3>
        <Slider id="camera-lab-lead" label="Antecipação ao andar" value={settings.lookAhead} min={0} max={3} step={0.05} unit="×" onChange={update('lookAhead')}/>
        <Slider id="camera-lab-lead-response" label="Velocidade da antecipação" value={settings.leadResponse} min={0.2} max={8} step={0.1} unit="×" onChange={update('leadResponse')}/>
        <Slider id="camera-lab-follow" label="Velocidade para seguir" value={settings.followResponse} min={0.5} max={20} step={0.1} unit="×" onChange={update('followResponse')}/>
        <Slider id="camera-lab-zoom-response" label="Velocidade do zoom" value={settings.zoomResponse} min={0.5} max={20} step={0.1} unit="×" onChange={update('zoomResponse')}/>
      </section>
      <section><h3>Blur por distância</h3>
        <label className="camera-lab-toggle"><input type="checkbox" checked={settings.blurEnabled}
          onChange={event=>setSettings(previous=>({...previous,blurEnabled:event.target.checked}))}/>
          <span>Ativar blur</span></label>
        <Slider id="camera-lab-blur-radius" label="Força do blur" value={settings.blurRadius} min={0} max={12} step={0.1} unit=" px" onChange={update('blurRadius')}/>
        <Slider id="camera-lab-blur-amount" label="Mistura do blur" value={settings.blurAmount} min={0} max={1} step={0.02} unit="×" onChange={update('blurAmount')}/>
        <Slider id="camera-lab-focus-shift" label="Distância do foco" value={settings.blurFocusOffset} min={-10} max={10} step={0.1} unit=" u" onChange={update('blurFocusOffset')}/>
        <Slider id="camera-lab-near-full" label="Perto: blur completo" value={settings.nearBlurFull} min={2} max={16} step={0.1} unit=" u" onChange={update('nearBlurFull')}/>
        <Slider id="camera-lab-near-clear" label="Perto: fica nítido" value={settings.nearBlurClear} min={0.3} max={7} step={0.1} unit=" u" onChange={update('nearBlurClear')}/>
        <Slider id="camera-lab-far-start" label="Longe: começa blur" value={settings.farBlurStart} min={0.3} max={9} step={0.1} unit=" u" onChange={update('farBlurStart')}/>
        <Slider id="camera-lab-far-full" label="Longe: blur completo" value={settings.farBlurFull} min={2} max={20} step={0.1} unit=" u" onChange={update('farBlurFull')}/>
      </section>
      <section><h3>Sprites e câmera</h3>
        <div className="camera-lab-segment" role="group" aria-label="Como os assets acompanham a câmera">
          <button className={settings.spriteMode==='isometrico'?'selected':''}
            aria-pressed={settings.spriteMode==='isometrico'}
            onClick={()=>setSettings(previous=>({...previous,spriteMode:'isometrico'}))}>Isométrico fixo</button>
          <button className={settings.spriteMode==='acompanhar'?'selected':''}
            aria-pressed={settings.spriteMode==='acompanhar'}
            onClick={()=>setSettings(previous=>({...previous,spriteMode:'acompanhar'}))}>Acompanhar câmera</button>
        </div>
        <p>A base fica no chão; a parte superior se inclina e se estica conforme o ângulo da câmera. Use o modo fixo para comparar.</p>
        <Slider id="camera-lab-sprite-warp" label="Força da adaptação" value={settings.spriteWarp} min={0} max={1.5} step={0.05} unit="×" onChange={update('spriteWarp')}/>
        <Slider id="camera-lab-sprite-stretch" label="Alongamento da parte superior" value={settings.spriteStretch} min={0.6} max={1.6} step={0.02} unit="×" onChange={update('spriteStretch')}/>
      </section>
      <section className="camera-lab-export"><h3>Copiar configuração</h3>
        <div><button onClick={copy}>Copiar JSON</button>
          <button onClick={()=>setSettings({...DEFAULT_CAMERA_LAB_SETTINGS})}>Restaurar padrão</button></div>
        <textarea ref={exportRef} readOnly value={exportText} aria-label="Configuração de câmera para copiar" rows={8}/>
        <span role="status">{copyState}</span>
      </section>
    </div>}
  </aside>;
}
