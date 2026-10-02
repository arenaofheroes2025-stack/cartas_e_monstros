import { ELEMENT_COLOR, ELEMENT_LABEL, type Element } from './content';
import { ITEMS, itemArt, type ItemId } from './items';

export type ShopProduct =
  | { id:string; kind:'item'; itemId:ItemId; price:number }
  | { id:string; kind:'card'; element:Element; price:number };

export const SHOP_PRODUCTS:ShopProduct[]=[
  {id:'pao',kind:'item',itemId:'pao',price:18},
  {id:'bolo',kind:'item',itemId:'bolo',price:36},
  {id:'tonico-brasa',kind:'item',itemId:'tonico-brasa',price:54},
  {id:'pocao-casca',kind:'item',itemId:'pocao-casca',price:54},
  {id:'amuleto-lento',kind:'item',itemId:'amuleto-lento',price:64},
  {id:'amuleto-fraco',kind:'item',itemId:'amuleto-fraco',price:64},
  {id:'carta-fogo',kind:'card',element:'fogo',price:78},
  {id:'carta-agua',kind:'card',element:'agua',price:78},
  {id:'carta-natureza',kind:'card',element:'natureza',price:78}
];

export function shopProductName(product:ShopProduct):string {
  return product.kind==='item'?ITEMS[product.itemId].name:`Carta de ${ELEMENT_LABEL[product.element]}`;
}

export function shopProductArt(product:ShopProduct):string {
  return product.kind==='item'?itemArt(product.itemId):`/art/cards/${product.element}.png`;
}

export function shopProductColor(product:ShopProduct):string {
  return product.kind==='item'?ITEMS[product.itemId].color:ELEMENT_COLOR[product.element];
}

export function shopProductDescription(product:ShopProduct):string {
  return product.kind==='item'?ITEMS[product.itemId].description:
    `Permite capturar criaturas de ${ELEMENT_LABEL[product.element].toLowerCase()} durante a batalha.`;
}
