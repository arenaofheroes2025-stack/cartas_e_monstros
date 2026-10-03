import { DEFAULT_SETTINGS, GROUP_KEYS, PRESETS, groupShadowValues, shadowSunOffset,
  type ShadowSettings } from '../qa-shadows/settings';
import { GROUPS, GROUP_LABELS, type ShadowGroup } from './settings';

type NumericKey = Exclude<keyof ShadowSettings, 'showShadows' | 'showAnchors'>;

function Slider({id, label, hint, value, min, max, step, unit, onChange}: {
  id: string; label: string; hint: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (value: number) => void;
}) {
  const shown = unit === '%' ? `${Math.round(value * 100)}%` : `${Number(value.toFixed(2))}${unit}`;
  return <div className="qa-slider">
    <div className="qa-slider-heading"><label htmlFor={id}>{label}</label><output htmlFor={id}>{shown}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value}
      onChange={event => onChange(Number(event.target.value))}/>
    <p>{hint}</p>
  </div>;
}

export function ShadowPanel({settings, setSettings, selectedGroup, selectGroup, zoom, onZoom}: {
  settings: ShadowSettings;
  setSettings: React.Dispatch<React.SetStateAction<ShadowSettings>>;
  selectedGroup: ShadowGroup;
  selectGroup: (group: ShadowGroup) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
}) {
  const update = (key: NumericKey) => (value: number) =>
    setSettings(previous => ({...previous, [key]: value}));
  const keys = GROUP_KEYS[selectedGroup];
  const values = groupShadowValues(settings, selectedGroup);
  const updateGroup = (field: keyof typeof keys) => update(keys[field]);
  const sun = shadowSunOffset(settings);
  const preset = Object.entries(PRESETS).find(([, value]) =>
    Object.entries(value).every(([key, number]) => key === 'zoom' ||
      settings[key as keyof ShadowSettings] === number))?.[0];
  return <>
    <div className="qa-panel-head"><div><span className="qa-kicker">MESA DE LUZ</span>
      <h1>Ajuste as sombras</h1>
      <p>A mesma cena mostra a posição do asset e a sombra. Os valores escolhidos podem ser enviados juntos.</p>
    </div></div>
    <section className="qa-section"><div className="qa-section-title"><span>01</span><h2>Exemplos</h2></div>
      <div className="qa-presets">{Object.entries(PRESETS).map(([name, value]) => <button key={name}
        className={preset === name ? 'selected' : ''} onClick={() => setSettings({...value, zoom})}>{name}</button>)}</div>
    </section>
    <section className="qa-section"><div className="qa-section-title"><span>02</span><h2>Posição do sol</h2></div>
      <Slider id="shadow-azimuth" label="Direção horizontal" hint="Negativo: esquerda. Positivo: direita." value={settings.azimuth} min={-60} max={60} step={1} unit="°" onChange={update('azimuth')}/>
      <Slider id="shadow-elevation" label="Elevação do sol" hint="Mais alto aproxima a sombra da base." value={settings.elevation} min={40} max={86} step={1} unit="°" onChange={update('elevation')}/>
      <Slider id="shadow-sun-strength" label="Força da luz" hint="Iluminação da arte." value={settings.sunStrength} min={0.5} max={3} step={0.05} unit="×" onChange={update('sunStrength')}/>
      <p className="qa-vector">Posição equivalente no jogo: X {sun.x} · Y {sun.y} · Z {sun.z}</p>
    </section>
    <section className="qa-section"><div className="qa-section-title"><span>03</span><h2>Forma e contato</h2></div>
      <Slider id="shadow-caster-height" label="Altura física geral" hint="Limite da projeção dos sprites." value={settings.casterHeight} min={1} max={8.5} step={0.1} unit=" u" onChange={update('casterHeight')}/>
      <Slider id="shadow-reach" label="Comprimento" hint="Projeção da sombra sem mover a base." value={settings.reach} min={0.4} max={1.8} step={0.05} unit="×" onChange={update('reach')}/>
      <Slider id="shadow-opacity" label="Escuridão" hint="Intensidade da silhueta." value={settings.opacity} min={0} max={0.8} step={0.02} unit="%" onChange={update('opacity')}/>
      <Slider id="shadow-foot-gain" label="Contato na base" hint="Escurece a região próxima aos pés." value={settings.footGain} min={0.5} max={2} step={0.05} unit="×" onChange={update('footGain')}/>
      <Slider id="shadow-softness" label="Suavidade da borda" hint="Suaviza o recorte da sombra." value={settings.softness} min={0.02} max={0.49} step={0.01} unit="" onChange={update('softness')}/>
    </section>
    <section className="qa-section qa-object-section"><div className="qa-section-title"><span>04</span><h2>Sombras por grupo</h2></div>
      <div className="qa-group-tabs" role="group" aria-label="Grupo de sombras">
        {GROUPS.map(group => <button key={group} className={selectedGroup === group ? 'selected' : ''}
          aria-pressed={selectedGroup === group} onClick={() => selectGroup(group)}>{GROUP_LABELS[group]}</button>)}
      </div>
      <p className="qa-group-heading">Ajustando: <strong>{GROUP_LABELS[selectedGroup]}</strong></p>
      <Slider id="shadow-side" label="Sombra para esquerda/direita" hint="Move a sombra deste grupo sem mover o asset." value={values.side} min={-2} max={2} step={0.05} unit=" u" onChange={updateGroup('side')}/>
      <Slider id="shadow-depth" label="Sombra para cima/baixo" hint="Move a sombra na profundidade." value={values.depth} min={-2} max={2} step={0.05} unit=" u" onChange={updateGroup('depth')}/>
      <Slider id="shadow-height-scale" label="Altura projetada do grupo" hint="1× mantém a altura original." value={values.heightScale} min={0.2} max={2.5} step={0.05} unit="×" onChange={updateGroup('heightScale')}/>
      <button className="qa-object-reset" onClick={() => setSettings(previous => ({...previous,
        [keys.side]: 0, [keys.depth]: 0, [keys.heightScale]: 1}))}>
        Zerar somente {GROUP_LABELS[selectedGroup].toLowerCase()}
      </button>
    </section>
    <section className="qa-section"><div className="qa-section-title"><span>05</span><h2>Inspeção da sombra</h2></div>
      <Slider id="shared-zoom" label="Zoom da câmera" hint="O mesmo enquadramento é usado nos dois menus."
        value={zoom} min={26} max={60} step={1} unit="" onChange={onZoom}/>
      <label className="qa-check"><input type="checkbox" checked={settings.showShadows}
        onChange={event => setSettings(previous => ({...previous, showShadows: event.target.checked}))}/>
        <span>Mostrar sombras</span></label>
      <label className="qa-check"><input type="checkbox" checked={settings.showAnchors}
        onChange={event => setSettings(previous => ({...previous, showAnchors: event.target.checked}))}/>
        <span>Mostrar âncora da sombra</span></label>
      <button className="qa-reset" onClick={() => setSettings({...DEFAULT_SETTINGS, zoom})}>Restaurar sombras do jogo</button>
    </section>
  </>;
}
