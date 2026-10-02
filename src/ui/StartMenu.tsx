import { useEffect, useState } from 'react';
import { Game, hasSave, hasSaveAsync } from '../game/game';
import { ELEMENT_COLOR, ELEMENT_LABEL, SPECIES, STARTERS } from '../game/content';
import { monsterPortrait } from '../render/art';
import { PwaInstallButton, type PwaInstallState } from './PwaInstall';

export function StartMenu({game,pwa}:{game:Game;pwa:PwaInstallState}) {
  const [choosing,setChoosing]=useState(false);
  const [seed,setSeed]=useState('');
  const [canContinue,setCanContinue]=useState(hasSave);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;void hasSaveAsync().then(value=>{if(active)setCanContinue(value);});return()=>{active=false;};},[]);
  return <div className="start-screen">
    <img className="start-art" src="/art/trio-elemental-web.png" alt="" aria-hidden="true"/>
    <div className="start-card">
      <div className="eyebrow">UMA AVENTURA ENTRE MUNDOS</div>
      <h1>Cartas <span>&</span> Monstros</h1>
      <p className="subtitle">Explore uma região viva, crie laços com criaturas elementais e reúna os três selos.</p>
      {choosing?<>
        <div className="small-heading">Escolha seu primeiro companheiro</div>
        <div className="starter-grid">
          {STARTERS.map(id=>{
            const s=SPECIES[id];return <button className="starter-card" key={id} onClick={()=>game.newGame(id,seed.trim()?Number(seed):undefined)}>
              <img src={monsterPortrait(id)} alt={s.name}/>
              <strong>{s.name}</strong><span style={{color:ELEMENT_COLOR[s.element]}}>{ELEMENT_LABEL[s.element]}</span>
              <small>{s.description}</small>
            </button>;
          })}
        </div>
        <label className="seed-label">Semente do mundo (opcional)<input type="number" value={seed} onChange={event=>setSeed(event.target.value)} placeholder="Aleatória"/></label>
        <button className="subtle-link" onClick={()=>setChoosing(false)}>Voltar</button>
      </>:<div className="start-actions">
        <button className="primary" onClick={()=>setChoosing(true)}>Nova aventura <span>→</span></button>
        {canContinue?<button className="secondary" disabled={loading} onClick={()=>{
          setLoading(true);setError('');
          void game.continueGameAsync().then(ok=>{if(!ok)setError('Não foi possível abrir a partida salva.');})
            .catch(()=>setError('Não foi possível abrir a partida salva.')).finally(()=>setLoading(false));
        }}>{loading?'Carregando jornada…':'Continuar jornada'}</button>:null}
        {error?<p role="alert">{error}</p>:null}
        <PwaInstallButton pwa={pwa}/>
      </div>}
      <div className="start-foot">Um RPG de exploração, cartas e encontros visíveis • Desktop e celular</div>
    </div>
  </div>;
}
