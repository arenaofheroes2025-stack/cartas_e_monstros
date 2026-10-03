import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShadowLabScene } from './scene';
import { DEFAULT_SETTINGS, GROUP_KEYS, GROUP_LABELS, PRESETS, groupShadowValues, readShadowSettings,
  saveShadowSettings, shadowSettingsUrl, shadowSunOffset,
  type ShadowGroup, type ShadowSettings, type StageFocus } from './settings';
import './style.css';

type NumericKey = Exclude<keyof ShadowSettings,'showShadows'|'showAnchors'>;

function Slider({label,hint,value,min,max,step,unit,onChange}:{
  label:string;hint:string;value:number;min:number;max:number;step:number;unit:string;onChange:(value:number)=>void
}) {
  const id=label.toLowerCase().replace(/\W+/g,'-');
  const shown=unit==='%'?`${Math.round(value*100)}%`:`${Number(value.toFixed(2))}${unit}`;
  return <div className="qa-slider">
    <div className="qa-slider-heading"><label htmlFor={id}>{label}</label><output htmlFor={id}>{shown}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value}
      onChange={event=>onChange(Number(event.target.value))}/>
    <p>{hint}</p>
  </div>;
}

function App() {
  const [settings,setSettings]=useState<ShadowSettings>(readShadowSettings);
  const [focus,setFocus]=useState<StageFocus>('todos');
  const [selectedGroup,setSelectedGroup]=useState<ShadowGroup>('casas');
  const [panelOpen,setPanelOpen]=useState(()=>window.innerWidth>=900);
  const [copyState,setCopyState]=useState('');
  const exportRef=useRef<HTMLTextAreaElement>(null);
  const groupSectionRef=useRef<HTMLElement>(null);
  useEffect(()=>saveShadowSettings(settings),[settings]);
  const update=(key:NumericKey)=>(value:number)=>setSettings(previous=>({...previous,[key]:value}));
  const keys=GROUP_KEYS[selectedGroup];
  const groupValues=groupShadowValues(settings,selectedGroup);
  const groupUpdate=(key:keyof typeof keys)=>(value:number)=>update(keys[key] as NumericKey)(value);
  const exportText=useMemo(()=>JSON.stringify({
    tipo:'Cartas e Monstros — QA de sombras',
    ...settings,
    posicaoSolarEquivalente:shadowSunOffset(settings),
    referencia:shadowSettingsUrl(settings)
  },null,2),[settings]);
  const sun=shadowSunOffset(settings);
  async function copy(value:string,label:string) {
    try{
      if(navigator.clipboard)await navigator.clipboard.writeText(value);
      else {
        const field=document.createElement('textarea');
        field.value=value;
        field.style.position='fixed';field.style.opacity='0';
        document.body.appendChild(field);field.select();
        const copied=document.execCommand('copy');
        field.remove();
        if(!copied)throw new Error('clipboard indisponível');
      }
      setCopyState(`${label} copiado`);
    }catch{
      exportRef.current?.focus();exportRef.current?.select();
      setCopyState('Selecione e copie o texto abaixo');
    }
  }
  const preset=Object.entries(PRESETS).find(([,value])=>
    Object.entries(value).every(([key,number])=>settings[key as keyof ShadowSettings]===number))?.[0];
  return <main className="qa-app">
    <header className="qa-header">
      <div className="qa-brand"><span className="qa-mark">✦</span><div><small>CARTAS E MONSTROS · FERRAMENTA DE QA</small><strong>Laboratório de sombras</strong></div></div>
      <div className="qa-header-actions"><span className="qa-live"><i/>Prévia ao vivo</span><a href="/qa-posicao-assets.html">Posição dos assets ↗</a><a href="/">Voltar ao jogo <span aria-hidden="true">↗</span></a></div>
    </header>
    <div className="qa-layout">
      <section className="qa-stage" aria-label="Cena de teste das sombras">
        <ShadowLabScene settings={settings} focus={focus}/>
        <div className="qa-stage-top"><span>01 / CIDADE · MEIO-DIA</span><span>Sol {settings.elevation}° · {settings.azimuth>0?'+':''}{settings.azimuth}°</span></div>
        <div className="qa-stage-bottom">
          <div className="qa-focus" role="group" aria-label="Objetos em teste">
            {(['todos','personagens','casas','arvores','pedras','plantas','objetos'] as StageFocus[]).map(value=><button key={value}
              className={focus===value?'active':''} onClick={()=>{
                setFocus(value);
                if(value!=='todos'){
                  setSelectedGroup(value);
                  if(window.innerWidth>=900)groupSectionRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
                }
              }}>{value==='todos'?'Todos':GROUP_LABELS[value]}</button>)}
          </div>
          <p>Âncora dourada: base do asset. Âncora azul: início deslocado da sombra do grupo.</p>
        </div>
        <button className="qa-mobile-settings" onClick={()=>setPanelOpen(value=>!value)} aria-expanded={panelOpen}>
          {panelOpen?'Fechar ajustes':'Ajustar sombras'}
        </button>
      </section>
      <aside className={`qa-panel ${panelOpen?'open':''}`} aria-label="Parâmetros das sombras">
        <div className="qa-panel-head"><div><span className="qa-kicker">MESA DE LUZ</span><h1>Encontre a sombra certa</h1><p>Ajuste a cena e envie os parâmetros escolhidos. Esta página não muda o jogo principal.</p><button className="qa-jump-groups" onClick={()=>groupSectionRef.current?.scrollIntoView({behavior:'smooth',block:'start'})}>Ir aos ajustes por grupo ↓</button></div><button className="qa-panel-close" onClick={()=>setPanelOpen(false)} aria-label="Fechar ajustes">×</button></div>
        <section className="qa-section"><div className="qa-section-title"><span>01</span><h2>Comece por um exemplo</h2></div>
          <div className="qa-presets">{Object.entries(PRESETS).map(([name,value])=><button key={name}
            className={preset===name?'selected':''} onClick={()=>setSettings({...value})}>{name}</button>)}</div>
        </section>
        <section className="qa-section"><div className="qa-section-title"><span>02</span><h2>Posição do sol</h2></div>
          <Slider label="Direção horizontal" hint="Negativo: esquerda. Positivo: direita. Zero: sombra descendo em linha reta." value={settings.azimuth} min={-60} max={60} step={1} unit="°" onChange={update('azimuth')}/>
          <Slider label="Elevação do sol" hint="Mais alto aproxima a sombra dos pés e da base dos objetos." value={settings.elevation} min={40} max={86} step={1} unit="°" onChange={update('elevation')}/>
          <Slider label="Força da luz" hint="Altera a iluminação da arte sem apagar suas cores." value={settings.sunStrength} min={0.5} max={3} step={0.05} unit="×" onChange={update('sunStrength')}/>
          <p className="qa-vector">Posição equivalente no jogo: X {sun.x} · Y {sun.y} · Z {sun.z}</p>
        </section>
        <section className="qa-section"><div className="qa-section-title"><span>03</span><h2>Forma e contato</h2></div>
          <Slider label="Altura física geral" hint="Limite básico da projeção de todos os sprites. A altura exclusiva dos objetos pode ser ajustada abaixo." value={settings.casterHeight} min={1} max={8.5} step={0.1} unit=" u" onChange={update('casterHeight')}/>
          <Slider label="Comprimento da sombra" hint="Ajuste fino da projeção, sem mover os pés do objeto." value={settings.reach} min={0.4} max={1.8} step={0.05} unit="×" onChange={update('reach')}/>
          <Slider label="Escuridão" hint="Controla a intensidade da silhueta inteira." value={settings.opacity} min={0} max={0.8} step={0.02} unit="%" onChange={update('opacity')}/>
          <Slider label="Contato na base" hint="Escurece os pixels inferiores da mesma silhueta; não cria outra camada redonda." value={settings.footGain} min={0.5} max={2} step={0.05} unit="×" onChange={update('footGain')}/>
          <Slider label="Suavidade da borda" hint="Afeta só o alfa do recorte; a sombra mantém a forma do asset." value={settings.softness} min={0.02} max={0.49} step={0.01} unit="" onChange={update('softness')}/>
        </section>
        <section ref={groupSectionRef} className="qa-section qa-object-section"><div className="qa-section-title"><span>04</span><h2>Sombras por grupo</h2></div>
          <p className="qa-object-note">Cada perfil guarda sua própria posição e altura. Selecione um grupo para isolar seus assets na cena.</p>
          <div className="qa-group-tabs" role="group" aria-label="Grupo de sombras">
            {(['personagens','casas','arvores','pedras','plantas','objetos'] as ShadowGroup[]).map(group=><button
              key={group} className={selectedGroup===group?'selected':''}
              aria-pressed={selectedGroup===group}
              onClick={()=>{setSelectedGroup(group);setFocus(group);}}>{GROUP_LABELS[group]}</button>)}
          </div>
          <p className="qa-group-heading">Ajustando: <strong>{GROUP_LABELS[selectedGroup]}</strong></p>
          <Slider label="Sombra para esquerda/direita" hint="Move a sombra deste grupo na tela, sem mover os assets." value={groupValues.side} min={-2} max={2} step={0.05} unit=" u" onChange={groupUpdate('side')}/>
          <Slider label="Sombra para cima/baixo" hint="Move a sombra deste grupo na profundidade da cena." value={groupValues.depth} min={-2} max={2} step={0.05} unit=" u" onChange={groupUpdate('depth')}/>
          <Slider label="Altura da sombra do grupo" hint="Multiplica a altura projetada deste grupo. 1× mantém a altura original." value={groupValues.heightScale} min={0.2} max={2.5} step={0.05} unit="×" onChange={groupUpdate('heightScale')}/>
          <button className="qa-object-reset" onClick={()=>setSettings(previous=>({...previous,
            [keys.side]:0,[keys.depth]:0,[keys.heightScale]:1}))}>
            Zerar somente {GROUP_LABELS[selectedGroup].toLowerCase()}
          </button>
        </section>
        <section className="qa-section"><div className="qa-section-title"><span>05</span><h2>Inspeção</h2></div>
          <Slider label="Zoom da câmera" hint="Aproxime para conferir onde a sombra toca cada sprite." value={settings.zoom} min={26} max={60} step={1} unit="" onChange={update('zoom')}/>
          <label className="qa-check"><input type="checkbox" checked={settings.showShadows} onChange={event=>setSettings(previous=>({...previous,showShadows:event.target.checked}))}/><span>Mostrar sombras</span></label>
          <label className="qa-check"><input type="checkbox" checked={settings.showAnchors} onChange={event=>setSettings(previous=>({...previous,showAnchors:event.target.checked}))}/><span>Mostrar âncoras do asset e da sombra</span></label>
        </section>
        <section className="qa-section qa-export"><div className="qa-section-title"><span>06</span><h2>Envie a combinação</h2></div>
          <p>Copie os parâmetros e cole na conversa. O link também abre exatamente estes ajustes.</p>
          <div className="qa-export-buttons"><button onClick={()=>copy(exportText,'Parâmetros')}>Copiar parâmetros</button><button onClick={()=>copy(shadowSettingsUrl(settings),'Link')}>Copiar link</button></div>
          <textarea ref={exportRef} readOnly value={exportText} aria-label="Parâmetros para compartilhar" rows={8}/>
          <span className="qa-copy-state" role="status">{copyState}</span>
          <button className="qa-reset" onClick={()=>{setSettings({...DEFAULT_SETTINGS});setCopyState('Configuração inicial restaurada');}}>Restaurar padrão do jogo</button>
        </section>
      </aside>
    </div>
  </main>;
}

createRoot(document.getElementById('app')!).render(<App/>);
