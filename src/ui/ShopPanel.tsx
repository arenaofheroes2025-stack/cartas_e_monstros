import { useEffect, useState } from 'react';
import { Game } from '../game/game';
import { SHOP_PRODUCTS, shopProductArt, shopProductColor, shopProductDescription, shopProductName, type ShopProduct } from '../game/shop';
import './shop.css';

type Filter='todos'|'item'|'card';

export function ShopPanel({game}:{game:Game}) {
  const [filter,setFilter]=useState<Filter>('todos');
  const [selectedId,setSelectedId]=useState(SHOP_PRODUCTS[0].id);
  const [quantity,setQuantity]=useState(1);
  const [message,setMessage]=useState('');
  const save=game.save;
  const products=SHOP_PRODUCTS.filter(product=>filter==='todos'||product.kind===filter);
  const selected=SHOP_PRODUCTS.find(product=>product.id===selectedId)??SHOP_PRODUCTS[0];
  const total=selected.price*quantity;
  const affordable=!!save&&total<=save.coins;
  const owned=(product:ShopProduct)=>!save?0:product.kind==='card'?save.cards[product.element]:
    save.inventory.filter(entry=>entry.itemId===product.itemId).length;
  const select=(product:ShopProduct)=>{setSelectedId(product.id);setQuantity(1);setMessage('');};
  const buy=()=>{
    if(game.buyFromShop(selected.id,quantity)){
      setMessage(`${quantity} × ${shopProductName(selected)} guardado${quantity>1?'s':''}.`);
      setQuantity(1);
    }else setMessage('Moedas insuficientes para esta compra.');
  };

  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();game.closeShop();}
      if(event.key==='Enter'&&!(event.target instanceof HTMLButtonElement)){
        event.preventDefault();document.querySelector<HTMLButtonElement>('.shop-buy:not(:disabled)')?.click();
      }
    };
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[game]);

  if(!save)return null;
  return <div className="shop-overlay" role="presentation" onPointerDown={event=>{if(event.target===event.currentTarget)game.closeShop();}}>
    <section className="shop-panel" role="dialog" aria-modal="true" aria-label="Empório da Vila">
      <aside className="shop-scene">
        <div className="shop-scene-glow"/>
        <img src="/art/interiors/artisan.png" alt="Interior do empório com prateleiras, balcão e mercadorias"/>
        <div className="shop-scene-caption"><span>✦ VILAREJO</span><h2>Empório<br/>da Vila</h2><p>Provisões para cada jornada.</p></div>
      </aside>
      <div className="shop-counter">
        <header className="shop-header">
          <div><small>MERCADORIA</small><h2>Loja</h2></div>
          <div className="shop-wallet" aria-label={`${save.coins} moedas`}><span>◈</span><strong>{save.coins}</strong><small>moedas</small></div>
          <button type="button" className="shop-close" aria-label="Sair da loja" onClick={()=>game.closeShop()}>✕</button>
        </header>
        <div className="shop-tabs" role="group" aria-label="Filtrar mercadorias">
          {([['todos','Todos'],['item','Itens'],['card','Cartas']] as const).map(([id,label])=><button
            type="button" key={id} aria-pressed={filter===id} className={filter===id?'active':''}
            onClick={()=>{setFilter(id);setMessage('');if(id!=='todos'&&selected.kind!==id){select(SHOP_PRODUCTS.find(product=>product.kind===id)!);}}}>{label}</button>)}
        </div>
        <div className="shop-list" role="listbox" aria-label="Itens à venda">
          {products.map(product=><button type="button" role="option" aria-selected={selected.id===product.id}
            className={`shop-row ${selected.id===product.id?'selected':''}`} key={product.id}
            onClick={()=>select(product)} style={{'--shop-accent':shopProductColor(product)} as React.CSSProperties}>
            <img src={shopProductArt(product)} alt=""/><span className="shop-row-name"><strong>{shopProductName(product)}</strong><small>{product.kind==='card'?'CARTA ELEMENTAL':product.kind==='item'?'ITEM':''} · possui {owned(product)}</small></span>
            <b><i>◈</i> {product.price}</b>
          </button>)}
        </div>
        <div className="shop-purchase" style={{'--shop-accent':shopProductColor(selected)} as React.CSSProperties}>
          <div className="shop-selection">
            <img src={shopProductArt(selected)} alt=""/>
            <span><small>SELECIONADO</small><strong>{shopProductName(selected)}</strong><em>{shopProductDescription(selected)}</em></span>
          </div>
          <div className="shop-checkout">
            <div className="shop-quantity" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" disabled={quantity<=1} onClick={()=>setQuantity(value=>Math.max(1,value-1))}>−</button>
              <span><small>QTDE.</small><b>{quantity}</b></span>
              <button type="button" aria-label="Aumentar quantidade" disabled={quantity>=99} onClick={()=>setQuantity(value=>Math.min(99,value+1))}>+</button>
            </div>
            <div className="shop-total"><small>TOTAL</small><strong>◈ {total}</strong></div>
            <button type="button" className="shop-buy" disabled={!affordable} onClick={buy}>{affordable?'Comprar':'Sem moedas'} <span>➜</span></button>
          </div>
          <p className={`shop-feedback ${message?'visible':''}`} aria-live="polite">{message||'Itens comprados vão para o inventário. Cartas ficam guardadas.'}</p>
        </div>
      </div>
    </section>
  </div>;
}
