import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source=path.join(process.cwd(),'assets','source','items','atlas.png');
const output=path.join(process.cwd(),'public','art','items');
const ids=['pao','bolo','tonico-brasa','pocao-casca','amuleto-lento','amuleto-fraco'];

export async function buildItemIcons(){
  const image=sharp(source);
  const {width,height}=await image.metadata();
  if(!width||!height||width%3||height%2)throw new Error('Atlas de itens precisa ter grade 3×2 exata.');
  await mkdir(output,{recursive:true});
  for(let i=0;i<ids.length;i++){
    await sharp(source).extract({left:(i%3)*width/3,top:Math.floor(i/3)*height/2,
      width:width/3,height:height/2}).resize(192,192,{fit:'contain',kernel:'lanczos3'})
      .png().toFile(path.join(output,`${ids[i]}.png`));
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await buildItemIcons();
