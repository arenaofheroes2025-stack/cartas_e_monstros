import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { samples } from '../qa-shadows/scene';
import { DEFAULT_SETTINGS as DEFAULT_SHADOW_SETTINGS, shadowSunOffset, type ShadowSettings } from '../qa-shadows/settings';
import { AssetPositionScene } from './scene';
import { ShadowPanel } from './ShadowPanel';
import { combinedSettingsUrl, readCombinedShadowSettings, type LabView } from './combinedSettings';
import { DEFAULT_SETTINGS, GROUPS, GROUP_LABELS,
  readPositionSettings, type PositionSettings,
  type ShadowGroup, type StageFocus } from './settings';
import '../qa-shadows/style.css';
import './style.css';

function clampOffset(value: number): number {
  return Number.isFinite(value) ? Math.round(Math.min(2, Math.max(-2, value)) * 100) / 100 : 0;
}

function OffsetControl({label, hint, value, onChange}: {
  label: string; hint: string; value: number; onChange: (value: number) => void
}) {
  const id = label === 'Posição Z no chão' ? 'offset-z' : 'offset-y';
  return <div className="qa-slider position-control">
    <div className="qa-slider-heading"><label htmlFor={id}>{label}</label><output htmlFor={id}>{value > 0 ? '+' : ''}{value.toFixed(2)} u</output></div>
    <div className="position-control-row">
      <input id={id} type="range" min={-2} max={2} step={0.01} value={value}
        onChange={event => onChange(clampOffset(Number(event.target.value)))}/>
      <input type="number" min={-2} max={2} step={0.01} value={value}
        aria-label={`${label}, valor exato`} onChange={event => {
          if (event.target.value !== '') onChange(clampOffset(Number(event.target.value)));
        }}/>
    </div>
    <p>{hint}</p>
  </div>;
}

function App() {
  const [settings, setSettings] = useState<PositionSettings>(readPositionSettings);
  const [shadows, setShadows] = useState<ShadowSettings>(() => {
    let stored: Partial<ShadowSettings> = {};
    try { stored = JSON.parse(localStorage.getItem('cartas-shadow-lab') || '{}'); }
    catch { /* Ignore invalid local QA data. */ }
    return {...readCombinedShadowSettings(window.location.search, stored), zoom: settings.zoom};
  });
  const [view, setView] = useState<LabView>(() =>
    new URLSearchParams(window.location.search).get('view') === 'sombras' ? 'sombras' : 'posicao');
  const [focus, setFocus] = useState<StageFocus>('todos');
  const [selectedGroup, setSelectedGroup] = useState<ShadowGroup>('arvores');
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 900);
  const [copyState, setCopyState] = useState('');
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const groupSectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem('cartas-asset-position-lab', JSON.stringify(settings));
      localStorage.setItem('cartas-shadow-lab', JSON.stringify(shadows));
    } catch { /* The shareable link remains available when storage is full. */ }
    history.replaceState(null, '', combinedSettingsUrl(settings, shadows, view));
  }, [settings, shadows, view]);

  const exportText = useMemo(() => JSON.stringify({
    tipo: 'Cartas e Monstros — QA de posição e sombras dos assets',
    unidade: 'unidades do mundo',
    nota: 'Y = altura relativa à superfície; Z = profundidade no chão. A cena mostra exemplos de cada grupo. Ajustes de QA ainda não aplicados ao jogo.',
    alturaYPorGrupo: settings.heightY,
    posicaoZPorGrupo: settings.depthZ,
    sobreTerrenoPorGrupo: settings.frontGroups,
    assetsSobreTerreno: settings.frontAssetIds.map(id => {
      const asset = samples.find(sample => sample.id === id);
      return {id, arquivo: asset?.path ?? ''};
    }),
    sombras: shadows,
    posicaoSolarEquivalente: shadowSunOffset(shadows),
    referencia: combinedSettingsUrl(settings, shadows, view)
  }, null, 2), [settings, shadows, view]);

  function update(group: ShadowGroup, axis: 'heightY' | 'depthZ', value: number) {
    setSettings(previous => ({...previous, [axis]: {...previous[axis], [group]: value}}));
  }

  function updateZoom(zoom: number) {
    setSettings(previous => ({...previous, zoom}));
    setShadows(previous => ({...previous, zoom}));
  }

  function setAssetInFront(id: string, enabled: boolean) {
    setSettings(previous => ({...previous, frontAssetIds: enabled ?
      [...new Set([...previous.frontAssetIds, id])] : previous.frontAssetIds.filter(item => item !== id)}));
  }

  function selectGroup(group: StageFocus) {
    setFocus(group);
    if (group !== 'todos') setSelectedGroup(group);
  }

  async function copy(value: string, label: string) {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(value);
      else {
        const field = document.createElement('textarea');
        field.value = value;
        field.style.position = 'fixed'; field.style.opacity = '0';
        document.body.appendChild(field); field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('clipboard indisponível');
      }
      setCopyState(`${label} copiado`);
    } catch {
      exportRef.current?.focus(); exportRef.current?.select();
      setCopyState('Selecione e copie o texto abaixo');
    }
  }

  return <main className="qa-app">
    <header className="qa-header">
      <div className="qa-brand"><span className="qa-mark">✦</span><div>
        <small>CARTAS E MONSTROS · FERRAMENTA DE QA</small><strong>Posição e sombras</strong>
      </div></div>
      <div className="qa-header-actions"><span className="qa-live"><i/>Prévia ao vivo</span>
        <a href="/">Voltar ao jogo ↗</a>
      </div>
    </header>
    <div className="qa-layout">
      <section className="qa-stage" aria-label="Cena de teste da posição e das sombras dos assets">
        <AssetPositionScene settings={settings} shadows={shadows} focus={focus}/>
        <div className="qa-stage-top"><span>POSIÇÃO E SOMBRA · REFERÊNCIA NO TERRENO</span>
          <span>{focus === 'todos' ? 'Todos os grupos · selecione um para ajustar' :
            `${GROUP_LABELS[focus]} · Y ${settings.heightY[focus].toFixed(2)} · Z ${settings.depthZ[focus].toFixed(2)}`}</span>
        </div>
        <div className="qa-stage-bottom">
          <div className="qa-focus" role="group" aria-label="Filtrar grupo de assets">
            {(['todos', ...GROUPS] as StageFocus[]).map(group => <button key={group}
              className={focus === group ? 'active' : ''} aria-pressed={focus === group}
              onClick={() => {selectGroup(group); if (group !== 'todos' && window.innerWidth >= 900)
                groupSectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});}}>
              {group === 'todos' ? 'Todos' : GROUP_LABELS[group]}
            </button>)}
          </div>
          <p>Anel dourado: ponto original. Azul: nova base do asset. Roxo: âncora da sombra.</p>
        </div>
        <button className="qa-mobile-settings" onClick={() => setPanelOpen(value => !value)} aria-expanded={panelOpen}>
          {panelOpen ? 'Fechar ajustes' : `Ajustar ${view === 'posicao' ? 'posição' : 'sombras'}`}
        </button>
      </section>
      <aside className={`qa-panel ${panelOpen ? 'open' : ''}`} aria-label="Ajustes de posição e sombras dos assets">
        <nav className="qa-mode-tabs" aria-label="Tipo de ajuste">
          <button className={view === 'posicao' ? 'selected' : ''} aria-pressed={view === 'posicao'}
            onClick={() => setView('posicao')}>Posição</button>
          <button className={view === 'sombras' ? 'selected' : ''} aria-pressed={view === 'sombras'}
            onClick={() => setView('sombras')}>Sombras</button>
          <button className="qa-panel-close" onClick={() => setPanelOpen(false)} aria-label="Fechar ajustes">×</button>
        </nav>
        {view === 'posicao' ? <>
        <div className="qa-panel-head"><div><span className="qa-kicker">MESA DE POSICIONAMENTO</span>
          <h1>Encaixe os assets no terreno</h1>
          <p>Escolha um grupo e ajuste ao vivo. Use os anéis como referência para ver onde o asset está apoiado.</p>
          <p className="position-axis-note">No jogo, a altura vertical usa o eixo <b>Y</b>. O eixo <b>Z</b> move o asset para frente ou para trás sobre o chão.</p>
          <button className="qa-jump-groups" onClick={() => groupSectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})}>Ir aos grupos ↓</button>
        </div></div>

        <section ref={groupSectionRef} className="qa-section qa-object-section">
          <div className="qa-section-title"><span>01</span><h2>Grupo de assets</h2></div>
          <div className="qa-group-tabs" role="group" aria-label="Grupo a ajustar">
            {GROUPS.map(group => <button key={group} className={selectedGroup === group ? 'selected' : ''}
              aria-pressed={selectedGroup === group} onClick={() => selectGroup(group)}>{GROUP_LABELS[group]}</button>)}
          </div>
          <p className="qa-group-heading">Ajustando: <strong>{GROUP_LABELS[selectedGroup]}</strong></p>
          <OffsetControl label="Posição Z no chão" hint="Negativo aproxima da câmera; positivo afasta. Move só este grupo."
            value={settings.depthZ[selectedGroup]} onChange={value => update(selectedGroup, 'depthZ', value)}/>
          <OffsetControl label="Altura Y em relação ao terreno" hint="Negativo abaixa a base da imagem; positivo eleva. Útil para corrigir assets que parecem flutuar."
            value={settings.heightY[selectedGroup]} onChange={value => update(selectedGroup, 'heightY', value)}/>
          <div className="position-front-controls">
            <h3>Prioridade sobre o terreno</h3>
            <p>Revela a parte da imagem coberta pelo chão, mantendo a sombra abaixo do asset. A opção do grupo vale para <strong>todos</strong> os assets dessa família quando os ajustes forem aplicados ao jogo; esta cena mostra só representantes.</p>
            <label className="qa-check"><input type="checkbox" checked={settings.frontGroups[selectedGroup]}
              onChange={event => setSettings(previous => ({...previous,
                frontGroups: {...previous.frontGroups, [selectedGroup]: event.target.checked}}))}/>
              <span>Ativar para todo o grupo, inclusive fora desta cena</span></label>
            <details className="position-specific">
              <summary>Escolher apenas assets específicos (opcional)</summary>
              <div className="position-asset-list" role="group" aria-label={`Assets específicos de ${GROUP_LABELS[selectedGroup]}`}>
                {samples.filter(asset => asset.group === selectedGroup).map(asset => <label key={asset.id}>
                  <input type="checkbox" checked={settings.frontGroups[selectedGroup] || settings.frontAssetIds.includes(asset.id)}
                    disabled={settings.frontGroups[selectedGroup]}
                    onChange={event => setAssetInFront(asset.id, event.target.checked)}/>
                  <span>{asset.label}</span>
                </label>)}
              </div>
              <p className="position-front-note">Estes são apenas os assets exibidos na cena de teste.</p>
              {settings.frontGroups[selectedGroup] && <p className="position-front-note">Desative o grupo para escolher apenas alguns assets.</p>}
            </details>
          </div>
          <button className="qa-object-reset" onClick={() => setSettings(previous => ({...previous,
            heightY: {...previous.heightY, [selectedGroup]: 0},
            depthZ: {...previous.depthZ, [selectedGroup]: 0},
            frontGroups: {...previous.frontGroups, [selectedGroup]: false},
            frontAssetIds: previous.frontAssetIds.filter(id => !samples.some(asset => asset.group === selectedGroup && asset.id === id))}))}>
            Zerar somente {GROUP_LABELS[selectedGroup].toLowerCase()}
          </button>
        </section>

        <section className="qa-section"><div className="qa-section-title"><span>02</span><h2>Inspeção</h2></div>
          <div className="qa-slider"><div className="qa-slider-heading"><label htmlFor="position-zoom">Zoom da câmera</label>
            <output htmlFor="position-zoom">{settings.zoom}</output></div>
            <input id="position-zoom" type="range" min={26} max={60} step={1} value={settings.zoom}
              onChange={event => updateZoom(Number(event.target.value))}/>
            <p>Aproxime para conferir a base em pixels.</p></div>
          <label className="qa-check"><input type="checkbox" checked={settings.showAnchors}
            onChange={event => setSettings(previous => ({...previous, showAnchors: event.target.checked}))}/>
            <span>Mostrar ponto original e nova base</span></label>
        </section>

        </> : <ShadowPanel settings={shadows} setSettings={setShadows} selectedGroup={selectedGroup}
          selectGroup={group => selectGroup(group)} zoom={settings.zoom} onZoom={updateZoom}/>}
        <section className="qa-section qa-export"><div className="qa-section-title"><span>06</span><h2>Envie seus ajustes</h2></div>
          <p>Copie posição e sombras em um único JSON. O link reabre os mesmos valores. Os ajustes de QA não mudam o jogo principal até serem aplicados.</p>
          <div className="qa-export-buttons"><button onClick={() => copy(exportText, 'JSON')}>Copiar JSON</button>
            <button onClick={() => copy(combinedSettingsUrl(settings, shadows, view), 'Link')}>Copiar link</button></div>
          <textarea ref={exportRef} readOnly value={exportText} aria-label="JSON dos ajustes de posição e sombras" rows={8}/>
          <span className="qa-copy-state" role="status">{copyState}</span>
          <button className="qa-reset" onClick={() => {setSettings({
            heightY: {...DEFAULT_SETTINGS.heightY}, depthZ: {...DEFAULT_SETTINGS.depthZ},
            frontGroups: {...DEFAULT_SETTINGS.frontGroups}, frontAssetIds: [],
            zoom: DEFAULT_SETTINGS.zoom, showAnchors: DEFAULT_SETTINGS.showAnchors
          }); setShadows({...DEFAULT_SHADOW_SETTINGS}); setCopyState('Calibração atual do jogo restaurada');}}>Restaurar padrão do jogo</button>
        </section>
      </aside>
    </div>
  </main>;
}

createRoot(document.getElementById('app')!).render(<App/>);
