import { BASE_SPECIES, createMonster, ELEMENT_LABEL, gainExperience, maxHp, type Element, type HeldItemSlot, type Monster, SPECIES, speed } from './content';
import { canStep, findPath, generateWorld, HEIGHT_STEP, index, replacementGroundItem, tileAt, type CardCache, type ItemSpawn, type Place, type Point, type WalkingNpcSpawn, type WildSpawn, type WorldData, WORLD_SIZE } from './world';
import { WALKING_NPC_DIALOG, staticNpcAt } from './npcs';
import { attackDamage, attackInterval, attackRadius, battleMoveSpeed, captureChance, criticalChance, dodgeCooldown, enemyAttackInterval, enemyRecovery } from './battle/rules';
import { readSave, writeSave, type SaveData } from './save';
import { canPlayerOccupy, collidesWithNpcAt, collidesWithNpcs } from './assetCollision';
import { addItem, BAG_CAPACITY, ITEMS, statusBonus, type ItemId, type TimedStatus, type BattleStat } from './items';

export { hasSave, readSave } from './save';
export type { SaveData } from './save';

export const DAY_SECONDS = 24 * 60;
export const BATTLE_INTRO_SECONDS = 2.8;
export const BATTLE_RECALL_END_SECONDS = 2.53;
export const BATTLE_ZOOM_OUT_END_SECONDS = 3.8;
export const BATTLE_FINISH_SECONDS = 4.1;
export const CAPTURE_RECALL_END_SECONDS = 3.2;
export const CAPTURE_ZOOM_OUT_END_SECONDS = 4.1;
export const CAPTURE_FINISH_SECONDS = 4.35;
export const CAPTURE_FAIL_SECONDS = 1.7;
export type Mode = 'title' | 'explore' | 'battle' | 'dialog' | 'pause';
export type BattleCommand = 'attack' | 'special' | 'dodge' | 'follow' | 'return' | 'move';
export type BattleMenu = 'cards' | 'party' | 'items';
export interface CommandCue {
  sequence: number;
  label: string;
  icon: string;
  color: string;
  itemId?: ItemId;
  remaining: number;
  poseRemaining: number;
}

const COMMAND_CUES:Record<Exclude<BattleCommand,'move'>,Pick<CommandCue,'label'|'icon'|'color'>>={
  attack:{label:'Atacar!',icon:'⚔',color:'#ef665e'},
  special:{label:'Especial!',icon:'✦',color:'#c49aff'},
  dodge:{label:'Esquivar!',icon:'◇',color:'#68c6ee'},
  follow:{label:'Perseguir!',icon:'➤',color:'#f4d36a'},
  return:{label:'Volte!',icon:'↶',color:'#a4db8d'}
};

export interface BattleActor {
  x: number;
  z: number;
  hp: number;
  charge: number;
  attackTimer: number;
  windup: number;
  skillWindup: boolean;
  dodgeTime: number;
  dodgeCooldown: number;
  dodgeTarget?: Point;
  strikeOrigin?: Point;
  strikeRadius: number;
  recovery: number;
  flash: number;
  itemPoseTime?: number;
}

export interface BattleState {
  center: Point;
  radius: number;
  wildId?: string;
  guardian?: Element;
  enemy: Monster;
  allyIndex: number;
  ally: BattleActor;
  foe: BattleActor;
  command: BattleCommand;
  waypoint?: Point;
  moveTime: number;
  message: string;
  messageTime: number;
  time: number;
  intro: number;
  introSummoned: boolean;
  statuses: TimedStatus[];
  itemUseTime: number;
  pendingAutoSupport: boolean;
  autoItemDelay: number;
  cue: CommandCue | null;
  finisher?: {
    elapsed: number;
    duration: number;
    xp: number;
    xpShown: boolean;
    enemyElement: Element;
    allyElement: Element;
    foe: Point;
    ally: Point;
    hero: Point;
  };
  captureSequence?: {
    elapsed: number;
    duration: number;
    announced: boolean;
    success: boolean;
    element: Element;
    speciesName: string;
    destination?: 'equipe'|'coleção';
    foe: Point;
    ally: Point;
    hero: Point;
  };
}

export interface DialogAction { label: string; run: () => void }
export interface Dialog { title: string; text: string; actions: DialogAction[]; anchor: Point; interior?: 'artisan'|'healer'|'keeper' }
export type InteractionTarget =
  | {kind:'cache'; id:string; name:string; verb:string; subject:CardCache}
  | {kind:'item'; id:string; name:string; verb:string; subject:ItemSpawn}
  | {kind:'walker'; id:string; name:string; verb:string; subject:WalkingNpcActor}
  | {kind:'place'; id:string; name:string; verb:string; subject:Place}
  | {kind:'wild'; id:string; name:string; verb:string; subject:WildActor};
export interface EffectEvent { kind: 'hit' | 'skill' | 'dodge' | 'capture' | 'evolve' | 'seal' | 'summon' | 'damage' | 'item' | 'xp'; x: number; z: number; element?: Element; species?: string; amount?: number; critical?: boolean; itemId?: ItemId; target?: Point; targetUid?: string; itemEffect?: 'heal'|'status'; stat?: BattleStat; autoItem?: boolean }
export interface WildActor extends WildSpawn { x: number; z: number; direction: number; moveTimer: number; target?: Point }
export interface WalkingNpcActor extends WalkingNpcSpawn { moveTimer: number; target?: Point }
export interface JumpState { from:Point; to:Point; fromHeight:number; toHeight:number; elapsed:number; duration:number }

function randomSeed(): number { return Math.floor(Math.random() * 2_000_000_000) + 1; }
function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.z - b.z); }
function clamp(v: number, a: number, b: number): number { return Math.max(a, Math.min(b, v)); }

export class Game {
  mode: Mode = 'title';
  previousMode: Mode = 'explore';
  world: WorldData | null = null;
  save: SaveData | null = null;
  battle: BattleState | null = null;
  battleMenu: BattleMenu | null = null;
  dialog: Dialog | null = null;
  wildActors: WildActor[] = [];
  walkingNpcs: WalkingNpcActor[] = [];
  jump: JumpState | null = null;
  move = { x: 0, z: 0 };
  private lastMove = { x: 1, z: 0 };
  private fallHeight = 0;
  private fallTime = 0;
  message = '';
  messageTime = 0;
  effects: EffectEvent[] = [];
  onChange: (() => void) | null = null;
  private saveTimer = 0;
  private walkDistance = 0;
  private cueSequence = 0;
  selectedBattleBagSlot = 0;
  selectedBattleCard: Element = 'fogo';

  get player(): Point { return this.save?.player || {x:48,z:48}; }
  get hour(): number { return this.save ? ((this.save.elapsed / DAY_SECONDS) % 1) * 24 : 9; }
  get isNight(): boolean { return this.hour < 6 || this.hour >= 19; }
  get activeMonster(): Monster | undefined { return this.battle && this.save ? this.save.party[this.battle.allyIndex] : undefined; }

  newGame(starter: string, requestedSeed?: number): void {
    const seed = requestedSeed && Number.isInteger(requestedSeed) ? requestedSeed : randomSeed();
    this.world = generateWorld(seed);
    const chosen = BASE_SPECIES.includes(starter) ? starter : 'brasito';
    this.save = {
      version: 1, seed, player: {x:48,z:48}, elapsed: DAY_SECONDS * 0.35,
      party: [createMonster(chosen, 1, 'starter')], collection: [],
      cards: { fogo: 2, agua: 2, natureza: 2 }, seals: [], openedCaches: [], collectedItems: [],
      groundItems:this.world.items,nextItemSerial:0,
      inventory: [{uid:'starter-pao',itemId:'pao'},{uid:'starter-bolo',itemId:'bolo'},{uid:'starter-tonico',itemId:'tonico-brasa'}],
      battleBag:['starter-pao','starter-bolo','starter-tonico',null,null,null],wildCooldown: {},
      wins: 0, claimedWins: { fogo: -1, agua: -1, natureza: -1 }, discovered: [], completed: false
    };
    this.wildActors = this.world.wild.map(w => ({...w, direction: 0, moveTimer: 0}));
    this.walkingNpcs = this.world.walkers.map(npc => ({...npc, moveTimer: 0}));
    this.jump=null;this.fallTime=0;
    this.mode = 'explore';
    this.reveal();
    this.notify('Sua jornada começou. Converse no vilarejo e explore os caminhos.', 6);
    this.persist();
    this.onChange?.();
  }

  continueGame(): boolean {
    const save = readSave();
    if (!save) return false;
    this.save = save;
    this.world = generateWorld(save.seed);
    this.world.items=save.groundItems?.length?save.groundItems:this.world.items;
    save.groundItems=this.world.items;
    save.nextItemSerial??=0;
    this.wildActors = this.world.wild.map(w => ({...w, direction: 0, moveTimer: 0}));
    this.walkingNpcs = this.world.walkers.map(npc => ({...npc, moveTimer: 0}));
    this.jump=null;this.fallTime=0;
    this.mode = 'explore';
    this.reveal();
    this.persist();
    this.onChange?.();
    return true;
  }

  persist(): void {
    if (!this.save) return;
    if (!writeSave(this.save)) this.notify('Não foi possível salvar neste navegador.', 5);
  }

  notify(message: string, seconds = 3): void {
    this.message = message;
    this.messageTime = seconds;
    this.onChange?.();
  }

  setMove(x: number, z: number): void {
    const magnitude = Math.hypot(x,z);
    this.move.x = magnitude > 1 ? x / magnitude : x;
    this.move.z = magnitude > 1 ? z / magnitude : z;
    if(magnitude>0.1)this.lastMove={x:this.move.x,z:this.move.z};
  }

  jumpForward(): boolean {
    if((this.mode!=='explore'&&this.mode!=='battle')||!this.world||this.jump)return false;
    const battle=this.mode==='battle'?this.battle:null;
    if(this.mode==='battle'&&(!battle||battle.intro>0||battle.finisher||battle.captureSequence||this.battleMenu))return false;
    const from={...this.player};
    const source=tileAt(this.world,Math.floor(from.x),Math.floor(from.z));
    if(!source)return false;
    const direction=battle?this.move:this.lastMove;
    const axes=[
      {amount:Math.abs(direction.x),x:Math.sign(direction.x),z:0},
      {amount:Math.abs(direction.z),x:0,z:Math.sign(direction.z)}
    ].filter(axis=>axis.amount>0.05).sort((a,b)=>b.amount-a.amount);
    const options=axes.map(axis=>({x:source.x+axis.x,z:source.z+axis.z}));
    const canLand=(point:Point)=>{
      const to={x:point.x+0.5,z:point.z+0.5};
      return (!battle||distance(to,battle.center)<battle.radius-0.8)&&
        canPlayerOccupy(this.world!,from,to,true,battle||undefined,this.walkingNpcs);
    };
    const landing=options.find(point=>tileAt(this.world!,point.x,point.z)?.height===source.height+1&&canLand(point)) ||
      options.find(point=>tileAt(this.world!,point.x,point.z)?.height===source.height&&canLand(point));
    if(!landing&&!battle)return false;
    const to=landing?{x:landing.x+0.5,z:landing.z+0.5}:from;
    this.jump={from,to,fromHeight:source.height*HEIGHT_STEP,
      toHeight:landing?tileAt(this.world,landing.x,landing.z)!.height*HEIGHT_STEP:source.height*HEIGHT_STEP,
      elapsed:0,duration:0.56};
    this.fallTime=0;
    this.onChange?.();
    return true;
  }

  get playerVisualLift():number {
    if(this.jump){
      const t=Math.min(1,this.jump.elapsed/this.jump.duration);
      const y=this.jump.fromHeight+(this.jump.toHeight-this.jump.fromHeight)*t+Math.sin(Math.PI*t)*1.12;
      return y-this.getGroundHeight(this.player.x,this.player.z);
    }
    return this.fallTime>0?this.fallHeight*this.fallTime/0.24:0;
  }

  private advanceJump(dt:number):void {
    const jump=this.jump;
    if(!jump)return;
    jump.elapsed=Math.min(jump.duration,jump.elapsed+dt);
    const t=jump.elapsed/jump.duration;
    const eased=t*t*(3-2*t);
    this.player.x=jump.from.x+(jump.to.x-jump.from.x)*eased;
    this.player.z=jump.from.z+(jump.to.z-jump.from.z)*eased;
    if(t>=1)this.jump=null;
  }

  private canOccupy(from: Point, to: Point, isPlayer=false): boolean {
    if (!this.world) return false;
    const ax = Math.floor(from.x), az = Math.floor(from.z), bx = Math.floor(to.x), bz = Math.floor(to.z);
    const target = tileAt(this.world, bx, bz);
    if (!target || target.terrain === 'water') return false;
    if(isPlayer)return canPlayerOccupy(this.world,from,to,false,this.battle||undefined,this.walkingNpcs);
    if(this.battle&&distance(to,this.battle.center)<this.battle.radius+0.5) {
      const source=tileAt(this.world,ax,az);
      return !!source&&Math.abs(source.height-target.height)<=1;
    }
    if(target.blocked)return false;
    if (ax === bx && az === bz) return true;
    if (Math.abs(ax-bx) + Math.abs(az-bz) === 1) return canStep(this.world, {x:ax,z:az}, {x:bx,z:bz});
    return false;
  }

  private movePosition(point: Point, dx: number, dz: number, speedPerSecond: number, dt: number, isPlayer=false): void {
    const distance=Math.hypot(dx,dz)*speedPerSecond*dt;
    const steps=Math.max(1,Math.ceil(distance/0.07));
    for(let step=0;step<steps;step++){
      const x=point.x+dx*speedPerSecond*dt/steps;
      if(this.canOccupy(point,{x,z:point.z},isPlayer))point.x=clamp(x,0.05,WORLD_SIZE-0.05);
      const z=point.z+dz*speedPerSecond*dt/steps;
      if(this.canOccupy(point,{x:point.x,z},isPlayer))point.z=clamp(z,0.05,WORLD_SIZE-0.05);
    }
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    if (this.messageTime > 0) { this.messageTime -= dt; if (this.messageTime <= 0) this.message = ''; }
    if (!this.world || !this.save || this.mode === 'pause' || this.mode === 'dialog' || this.mode === 'title') return;
    if (this.mode === 'explore') {
      this.save.elapsed += dt;
      const before = {...this.player};
      const beforeHeight=this.getGroundHeight(before.x,before.z);
      if(this.jump)this.advanceJump(dt);
      else this.movePosition(this.player, this.move.x, this.move.z, 4, dt,true);
      const drop=beforeHeight-this.getGroundHeight(this.player.x,this.player.z);
      if(!this.jump&&drop>0.1){this.fallHeight=drop;this.fallTime=0.24;}
      else this.fallTime=Math.max(0,this.fallTime-dt);
      this.walkDistance += distance(before, this.player);
      if (this.walkDistance > 1) { this.walkDistance = 0; this.reveal(); }
      this.updateWild(dt);
      this.updateWalkingNpcs(dt);
      if(!this.jump)this.checkNearbyWild();
      this.saveTimer += dt;
      if (this.saveTimer > 8) { this.saveTimer = 0; this.persist(); this.onChange?.(); }
    } else if (this.battle && !this.battleMenu) {
      if(this.battle.intro>0){
        this.battle.intro=Math.max(0,this.battle.intro-dt);
        if(this.battle.intro<=1.05&&!this.battle.introSummoned){
          this.battle.introSummoned=true;
          this.effects.push({kind:'summon',x:this.battle.ally.x,z:this.battle.ally.z,
            element:SPECIES[this.activeMonster!.species].element});
        }
        if(this.battle.intro===0)this.onChange?.();
      } else {
        if(this.jump&&!this.battle.captureSequence)this.advanceJump(dt);
        this.updateBattle(dt);
      }
    }
  }

  private reveal(): void {
    if (!this.save) return;
    const seen = new Set(this.save.discovered);
    const px = Math.floor(this.player.x), pz = Math.floor(this.player.z);
    for (let z=pz-6;z<=pz+6;z++) for (let x=px-6;x<=px+6;x++) {
      if (x>=0 && z>=0 && x<WORLD_SIZE && z<WORLD_SIZE && Math.hypot(x-px,z-pz)<=6) seen.add(index(x,z));
    }
    this.save.discovered = [...seen];
  }

  isWildVisible(wild: WildSpawn): boolean {
    if (!this.save) return false;
    if (wild.night && !this.isNight) return false;
    return (this.save.wildCooldown[wild.id] || 0) <= this.save.elapsed;
  }

  wildSpecies(wild: WildSpawn): string {
    const base = SPECIES[wild.species];
    const number = Number(wild.id.split('-')[1]);
    return this.save && this.save.seals.length > 0 && number % 11 === 0 && base.evolvesTo ? base.evolvesTo : wild.species;
  }

  private updateWild(dt: number): void {
    if (!this.world) return;
    for (const wild of this.wildActors) {
      if (!this.isWildVisible(wild) || distance(wild,this.player) > 16) continue;
      wild.moveTimer -= dt;
      if (wild.moveTimer <= 0) {
        wild.moveTimer = 1.3 + Math.random() * 2.3;
        const options = [[1,0],[-1,0],[0,1],[0,-1],[0,0]];
        const [dx,dz] = options[Math.floor(Math.random() * options.length)];
        const target = {x:Math.floor(wild.x)+dx,z:Math.floor(wild.z)+dz};
        wild.target = Math.hypot(target.x-wild.homeX,target.z-wild.homeZ) <= 4 && canStep(this.world,{x:Math.floor(wild.x),z:Math.floor(wild.z)},target) ? {x:target.x+0.5,z:target.z+0.5} : undefined;
      }
      if (wild.target && distance(wild,wild.target)>0.08) {
        const dx=wild.target.x-wild.x,dz=wild.target.z-wild.z,len=Math.hypot(dx,dz);
        this.movePosition(wild,dx/len,dz/len,0.85,dt);
        wild.direction = Math.atan2(dz,dx);
      }
    }
  }

  private updateWalkingNpcs(dt: number): void {
    if (!this.world) return;
    for (const npc of this.walkingNpcs) {
      if (distance(npc,this.player)>22) continue;
      npc.moveTimer-=dt;
      if (npc.moveTimer<=0) {
        npc.moveTimer=1.1+Math.random()*1.2;
        const options=[[1,0],[-1,0],[0,1],[0,-1]];
        const [dx,dz]=options[Math.floor(Math.random()*options.length)];
        const from={x:Math.floor(npc.x),z:Math.floor(npc.z)};
        const to={x:from.x+dx,z:from.z+dz};
        npc.target=Math.hypot(to.x-npc.homeX,to.z-npc.homeZ)<=4 && canStep(this.world,from,to)
          ? {x:to.x+0.5,z:to.z+0.5} : undefined;
      }
      if (npc.target && distance(npc,npc.target)>0.06) {
        const dx=npc.target.x-npc.x,dz=npc.target.z-npc.z,len=Math.hypot(dx,dz);
        const next={x:npc.x+dx/len*1.1*dt,z:npc.z+dz/len*1.1*dt,role:npc.role};
        if(Math.abs(this.getGroundHeight(next.x,next.z)-this.getGroundHeight(this.player.x,this.player.z))<0.1&&collidesWithNpcAt(this.player,next)){
          npc.target=undefined;continue;
        }
        if(collidesWithNpcs(this.world,next,this.walkingNpcs.filter(other=>other!==npc))){npc.target=undefined;continue;}
        this.movePosition(npc,dx/len,dz/len,1.1,dt);
      } else npc.target=undefined;
    }
  }

  private checkNearbyWild(): void {
    if (this.mode !== 'explore') return;
    const wild = this.wildActors.find(w => this.isWildVisible(w) && distance(w,this.player) < 0.72);
    if (wild) this.beginBattle(wild);
  }

  nearbyInteraction():InteractionTarget|null {
    if(this.mode!=='explore'||!this.world||!this.save||this.jump)return null;
    const cache=this.world.caches.find(c=>!this.save!.openedCaches.includes(c.id)&&distance(c,this.player)<1.9);
    if(cache)return {kind:'cache',id:cache.id,name:'Carta de '+ELEMENT_LABEL[cache.element],verb:'Pegar',subject:cache};
    const walker=this.walkingNpcs.find(npc=>distance(npc,this.player)<1.5);
    if(walker)return {kind:'walker',id:walker.id,name:WALKING_NPC_DIALOG[walker.role].name,verb:'Falar',subject:walker};
    const place=this.world.places.find(p=>distance(p,this.player)<2.8);
    if(place)return {kind:'place',id:place.id,name:place.name,verb:place.kind==='shrine'?'Conversar':'Interagir',subject:place};
    const item=this.world.items.find(p=>distance(p,this.player)<1.9);
    if(item)return {kind:'item',id:item.id,name:ITEMS[item.itemId].name,verb:'Pegar',subject:item};
    const wild=this.wildActors.find(w=>this.isWildVisible(w)&&distance(w,this.player)<2);
    if(wild)return {kind:'wild',id:wild.id,name:SPECIES[this.wildSpecies(wild)].name,verb:'Desafiar',subject:wild};
    return null;
  }

  interact(): void {
    if(this.mode==='dialog'){this.closeDialog();return;}
    const target=this.nearbyInteraction();
    if(target?.kind==='cache'){this.collectCache(target.subject);return;}
    if(target?.kind==='item'){this.collectItem(target.subject);return;}
    if(target?.kind==='walker'){
      const npc=target.subject;
      const dialog=WALKING_NPC_DIALOG[npc.role];
      this.showDialog(dialog.name,dialog.text,[],{x:npc.x,z:npc.z});
      return;
    }
    if(target?.kind==='place'){this.interactPlace(target.subject);return;}
    if(target?.kind==='wild'){this.beginBattle(target.subject);return;}
    if(this.mode!=='explore')return;
    this.notify('Chegue perto de uma carta, casa, santuário ou monstro para interagir.');
  }

  private collectCache(cache: CardCache): void {
    if (!this.save) return;
    this.save.openedCaches.push(cache.id);
    this.save.cards[cache.element]++;
    this.effects.push({kind:'capture',x:cache.x,z:cache.z,element:cache.element});
    this.notify('Você encontrou 1 carta de ' + ELEMENT_LABEL[cache.element] + '!');
    this.persist();
  }

  private collectItem(spawn:ItemSpawn):void {
    if(!this.save||!this.world)return;
    const activeIndex=this.world.items.findIndex(item=>item.id===spawn.id);
    if(activeIndex<0)return;
    addItem(this.save.inventory,{uid:spawn.id,itemId:spawn.itemId});
    this.save.collectedItems.push(spawn.id);
    if(this.save.collectedItems.length>200)this.save.collectedItems.splice(0,this.save.collectedItems.length-200);
    this.world.items.splice(activeIndex,1);
    const serial=this.save.nextItemSerial??0;
    const replacement=replacementGroundItem(this.world,this.world.items,spawn,this.player,serial);
    this.save.nextItemSerial=serial+1;
    if(replacement)this.world.items.push(replacement);
    this.save.groundItems=this.world.items;
    this.effects.push({kind:'capture',x:spawn.x,z:spawn.z});
    this.notify(ITEMS[spawn.itemId].name+' guardado no inventário!');
    this.persist();this.onChange?.();
  }

  private showDialog(title: string, text: string, actions: DialogAction[], anchor:Point, interior?: Dialog['interior']): void {
    this.dialog = {title,text,actions,anchor,interior};
    this.mode = 'dialog';
    this.setMove(0,0);
    this.message='';this.messageTime=0;
    this.onChange?.();
  }

  closeDialog(): void { this.dialog = null; this.mode = 'explore'; this.setMove(0,0); this.onChange?.(); }

  chooseDialogAction(index:number):boolean {
    if(this.mode!=='dialog')return false;
    const action=this.dialog?.actions[index];
    if(!action)return false;
    action.run();
    return true;
  }

  private interactPlace(place: Place): void {
    if (!this.save) return;
    const npc=staticNpcAt(place);
    const anchor={x:npc.x,z:npc.z};
    if (place.kind === 'shrine') {
      const element = place.element!;
      if (this.save.seals.includes(element)) {
        this.showDialog(place.name, 'O selo deste santuário já responde às suas cartas. Continue sua jornada.', [{label:'Voltar',run:()=>this.closeDialog()}],anchor);
      } else {
        this.showDialog(place.name, 'Guardião: prove que seu vínculo com os monstros é forte. Seu monstro enfrentará o meu nesta arena.', [
          {label:'Aceitar desafio',run:()=>{this.closeDialog();this.beginBattle(undefined,element,place);}},
          {label:'Depois',run:()=>this.closeDialog()}
        ],anchor);
      }
      return;
    }
    if (place.id === 'casa-cura') {
      this.showDialog('Casa de Repouso', 'A guardiã da casa oferece descanso gratuito para todos os seus monstros.', [
        {label:'Curar equipe',run:()=>{this.save!.party.forEach(m=>m.hp=maxHp(m));this.closeDialog();this.notify('Sua equipe descansou e está pronta!');this.persist();}},
        {label:'Sair',run:()=>this.closeDialog()}
      ],anchor,'healer');
    } else if (place.id === 'casa-cartas') {
      const actions: DialogAction[] = (['fogo','agua','natureza'] as Element[]).map(element => ({
        label: 'Criar carta de ' + ELEMENT_LABEL[element],
        run: () => {
          if (this.save!.wins <= this.save!.claimedWins[element]) { this.notify('Vença mais um encontro selvagem para preparar outra carta.'); this.closeDialog(); return; }
          this.save!.claimedWins[element] = this.save!.wins;
          this.save!.cards[element]++;
          this.closeDialog();
          this.notify('Carta de ' + ELEMENT_LABEL[element] + ' criada!');
          this.persist();
        }
      }));
      actions.push({label:'Sair',run:()=>this.closeDialog()});
      this.showDialog('Ateliê de Cartas', 'A artesã usa a energia de suas vitórias para criar cartas. Após cada encontro selvagem vencido, peça uma carta elemental.', actions,anchor,'artisan');
    } else {
      const discovered = new Set([...this.save.party,...this.save.collection].map(m=>m.species));
      this.showDialog('Arquivo do Éter', 'Pesquisador: já registramos ' + discovered.size + ' formas de 12. Explore os três biomas, capture com cartas do mesmo elemento e vença os guardiões dos selos.', [{label:'Entendi',run:()=>this.closeDialog()}],anchor,'keeper');
    }
  }

  beginBattle(wild?: WildActor, guardian?: Element, place?: Place): void {
    if (!this.save || !this.world) return;
    let allyIndex = this.save.party.findIndex(m=>m.hp>0);
    if (allyIndex<0) { this.rescue(); return; }
    const species = wild ? this.wildSpecies(wild) : guardian === 'fogo' ? 'vulcazuri' : guardian === 'agua' ? 'coracilo' : 'cervaflor';
    const level = wild ? (species !== wild.species ? 6 : wild.level) : 5 + this.save.seals.length;
    const enemy = createMonster(species,level,'enemy');
    const center = wild ? {x:wild.x,z:wild.z} : {x:place!.x+0.5,z:place!.z+0.5};
    const ally = this.save.party[allyIndex];
    const allyStart = this.findAllySpawn(center);
    const foeStart = this.findArenaSpawn(center, allyStart);
    this.battle = {
      center, radius:7.5, wildId:wild?.id, guardian, enemy, allyIndex,
      ally:{...allyStart,hp:ally.hp,charge:0,attackTimer:0.6,windup:0,skillWindup:false,dodgeTime:0,dodgeCooldown:0,strikeRadius:0,recovery:0,flash:0},
      foe:{...foeStart,hp:maxHp(enemy),charge:0,attackTimer:1.55,windup:0,skillWindup:false,dodgeTime:0,dodgeCooldown:0,strikeRadius:0,recovery:0,flash:0},
      command:'return',moveTime:0,message:'A arena se formou!',messageTime:2,time:0,
      intro:BATTLE_INTRO_SECONDS,introSummoned:false,statuses:[],itemUseTime:0,
      pendingAutoSupport:true,autoItemDelay:0,cue:null
    };
    this.battleMenu=null;
    this.jump=null;
    this.message='';
    this.messageTime=0;
    this.mode='battle';
    this.onChange?.();
  }

  private findAllySpawn(center: Point): Point {
    if(!this.world)return {...this.player};
    const origin=tileAt(this.world,Math.floor(this.player.x),Math.floor(this.player.z));
    const fromFoe={x:this.player.x-center.x,z:this.player.z-center.z};
    const length=Math.hypot(fromFoe.x,fromFoe.z);
    const away=length>0.001?{x:fromFoe.x/length,z:fromFoe.z/length}:{x:1,z:0};
    const side=Math.SQRT1_2;
    const directions=[{x:side,z:-side},{x:-side,z:side},{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1},away];
    for(const radius of [1.75,1.9,2.1])for(const direction of directions){
      const point={x:this.player.x+direction.x*radius,z:this.player.z+direction.z*radius};
      const tile=tileAt(this.world,Math.floor(point.x),Math.floor(point.z));
      if(tile&&tile.terrain!=='water'&&origin&&Math.abs(tile.height-origin.height)<=1&&
        distance(point,center)<3.8&&canPlayerOccupy(this.world,point,point))return point;
    }
    return {x:clamp(this.player.x,center.x-2,center.x+2),z:clamp(this.player.z,center.z-2,center.z+2)};
  }

  openBattleMenu(menu: BattleMenu): void {
    if (this.mode!=='battle'||!this.battle||this.battle.intro>0||this.battle.finisher||this.battle.captureSequence) return;
    this.battleMenu=menu;
    if(menu==='items'){
      this.selectedBattleBagSlot=Math.max(0,this.save?.battleBag.findIndex(Boolean)??0);
      this.setMove(0,0);
    }
    if(menu==='cards'){
      this.selectedBattleCard=SPECIES[this.battle.enemy.species].element;
      this.setMove(0,0);
    }
    this.onChange?.();
  }

  toggleBattleBag():void {
    if(this.battleMenu==='items')this.closeBattleMenu();
    else this.openBattleMenu('items');
  }

  selectBattleBagSlot(slot:number):void {
    if(this.battleMenu!=='items'||!Number.isInteger(slot)||slot<0||slot>=BAG_CAPACITY)return;
    this.selectedBattleBagSlot=slot;
    this.onChange?.();
  }

  selectBattleCard(element:Element):void {
    if(this.battleMenu!=='cards')return;
    this.selectedBattleCard=element;
    this.onChange?.();
  }

  useSelectedBattleCard():void {
    if(this.battleMenu==='cards')this.capture(this.selectedBattleCard);
  }

  equipMonsterItem(monsterUid:string,slot:HeldItemSlot,itemUid:string):boolean {
    const save=this.save;
    if(!save||this.battle)return false;
    const monster=[...save.party,...save.collection].find(entry=>entry.uid===monsterUid);
    const item=save.inventory.find(entry=>entry.uid===itemUid);
    if(!monster||!item||ITEMS[item.itemId].effect.kind!==(slot==='food'?'heal':'status'))return false;
    if([...save.party,...save.collection].some(entry=>entry.uid!==monsterUid&&
      (entry.heldItems.food===itemUid||entry.heldItems.support===itemUid)))return false;
    if(monster.heldItems[slot]===itemUid)return true;
    const bagSlot=save.battleBag.indexOf(itemUid);
    if(bagSlot>=0)save.battleBag[bagSlot]=null;
    monster.heldItems[slot]=itemUid;
    this.persist();this.onChange?.();
    return true;
  }

  unequipMonsterItem(monsterUid:string,slot:HeldItemSlot):void {
    const save=this.save;
    if(!save||this.battle)return;
    const monster=[...save.party,...save.collection].find(entry=>entry.uid===monsterUid);
    if(!monster||!monster.heldItems[slot])return;
    monster.heldItems[slot]=null;
    this.persist();this.onChange?.();
  }

  equipBattleItem(uid:string,slot?:number):boolean {
    const save=this.save;
    if(!save||this.mode==='battle'||!save.inventory.some(item=>item.uid===uid))return false;
    if([...save.party,...save.collection].some(monster=>
      monster.heldItems.food===uid||monster.heldItems.support===uid))return false;
    const target=slot??save.battleBag.findIndex(value=>value===null);
    if(target<0||target>=BAG_CAPACITY)return false;
    const previous=save.battleBag.indexOf(uid);
    if(previous===target)return true;
    const displaced=save.battleBag[target];
    save.battleBag[target]=uid;
    if(previous>=0)save.battleBag[previous]=displaced;
    this.persist();this.onChange?.();
    return true;
  }

  unequipBattleItem(slot:number):void {
    if(!this.save||this.mode==='battle'||slot<0||slot>=BAG_CAPACITY)return;
    this.save.battleBag[slot]=null;
    this.persist();this.onChange?.();
  }

  useSelectedBattleItem():boolean {
    const uid=this.save?.battleBag[this.selectedBattleBagSlot];
    if(!uid){this.notify('Escolha um item da mochila.');return false;}
    return this.useBattleItem(uid);
  }

  useHealingItemOutsideBattle(uid:string,targetUid?:string):boolean {
    const save=this.save;
    if(this.mode!=='explore'||!save)return false;
    const index=save.inventory.findIndex(item=>item.uid===uid);
    if(index<0)return false;
    const item=save.inventory[index],definition=ITEMS[item.itemId];
    if(definition.effect.kind!=='heal')return false;
    if([...save.party,...save.collection].some(monster=>monster.heldItems.food===uid))return false;
    const target=targetUid?save.party.find(monster=>monster.uid===targetUid):
      save.party.find(monster=>monster.hp>0&&monster.hp<maxHp(monster));
    if(!target||target.hp<=0){this.notify('Escolha um companheiro que possa ser curado.');return false;}
    const restored=Math.min(definition.effect.amount,maxHp(target)-target.hp);
    if(restored<=0){this.notify(SPECIES[target.species].name+' já está com a vida cheia.');return false;}
    target.hp+=restored;
    save.inventory.splice(index,1);
    const slot=save.battleBag.indexOf(uid);
    if(slot>=0)save.battleBag[slot]=null;
    this.effects.push({kind:'item',itemId:item.itemId,x:this.player.x,z:this.player.z,
      target:{...this.player},itemEffect:'heal',amount:restored});
    this.notify(`${SPECIES[target.species].name} recuperou ${restored} PV com ${definition.name}!`);
    this.persist();this.onChange?.();
    return true;
  }

  closeBattleMenu(): void {
    this.battleMenu=null;
    this.onChange?.();
  }

  statusBonus(targetUid:string,stat:BattleStat):number {
    return this.battle?statusBonus(this.battle.statuses,targetUid,stat):0;
  }

  private showCommandCue(label:string,icon:string,color:string,itemId?:ItemId):void {
    if(!this.battle)return;
    this.battle.cue={sequence:++this.cueSequence,label,icon,color,itemId,remaining:1.6,poseRemaining:1.25};
    this.onChange?.();
  }

  useBattleItem(uid:string):boolean {
    const battle=this.battle,save=this.save;
    if(this.mode!=='battle'||!battle||!save||battle.intro>0||battle.finisher||battle.captureSequence||this.battleMenu!=='items')return false;
    if(!save.battleBag.includes(uid))return false;
    return this.applyBattleItem(uid,false);
  }

  private applyBattleItem(uid:string,automatic:boolean):boolean {
    const battle=this.battle,save=this.save;
    if(!battle||!save)return false;
    const index=save.inventory.findIndex(item=>item.uid===uid);
    if(index<0)return false;
    const item=save.inventory[index],definition=ITEMS[item.itemId],effect=definition.effect;
    const target=effect.target==='ally'?battle.ally:battle.foe;
    const targetUid=effect.target==='ally'?this.activeMonster!.uid:battle.enemy.uid;
    if(effect.kind==='heal'&&target.hp>=maxHp(this.activeMonster!)){
      if(!automatic)this.notify('Seu monstro já está com a vida cheia.');
      return false;
    }
    save.inventory.splice(index,1);
    const bagSlot=save.battleBag.indexOf(uid);
    if(bagSlot>=0)save.battleBag[bagSlot]=null;
    for(const monster of [...save.party,...save.collection])for(const slot of ['food','support'] as const)
      if(monster.heldItems[slot]===uid)monster.heldItems[slot]=null;
    let appliedAmount=effect.amount;
    if(effect.kind==='heal'){
      const previousHp=target.hp;
      target.hp=Math.min(maxHp(this.activeMonster!),target.hp+effect.amount);
      appliedAmount=target.hp-previousHp;
      save.party[battle.allyIndex].hp=target.hp;
    }else{
      battle.statuses=battle.statuses.filter(status=>!(status.targetUid===targetUid&&status.stat===effect.stat));
      battle.statuses.push({itemId:item.itemId,targetUid,stat:effect.stat,amount:effect.amount,
        duration:effect.duration,remaining:effect.duration});
    }
    const source=automatic?battle.ally:this.player;
    this.effects.push({kind:'item',itemId:item.itemId,x:source.x,z:source.z,
      target:{x:target.x,z:target.z},itemEffect:effect.kind,amount:appliedAmount,
      stat:effect.kind==='status'?effect.stat:undefined,targetUid,autoItem:automatic});
    if(automatic){
      battle.ally.itemPoseTime=0.72;
      battle.autoItemDelay=0.82;
      battle.message=effect.kind==='heal'
        ?`${SPECIES[this.activeMonster!.species].name} comeu ${definition.name} e recuperou ${appliedAmount} PV!`
        :`${SPECIES[this.activeMonster!.species].name} ativou ${definition.name} automaticamente!`;
    }else{
      battle.itemUseTime=0.75;
      battle.message=`${definition.name} usado em ${effect.target==='ally'?SPECIES[this.activeMonster!.species].name:SPECIES[battle.enemy.species].name}!`;
      this.battleMenu=null;
      this.showCommandCue(definition.name+'!', '✦', definition.color, item.itemId);
    }
    battle.messageTime=2.1;
    this.persist();this.onChange?.();
    return true;
  }

  private activateHeldSupport():void {
    const uid=this.activeMonster?.heldItems.support;
    if(uid)this.applyBattleItem(uid,true);
  }

  private maybeUseHeldFood():void {
    const monster=this.activeMonster,battle=this.battle;
    if(!monster||!battle||battle.ally.hp<=0||battle.autoItemDelay>0)return;
    if(battle.ally.hp<=maxHp(monster)*0.5&&monster.heldItems.food)
      this.applyBattleItem(monster.heldItems.food,true);
  }

  private findArenaSpawn(center: Point, ally: Point): Point {
    if (!this.world) return {...center};
    const start = {x:Math.floor(ally.x),z:Math.floor(ally.z)};
    const seen = new Set<number>([index(start.x,start.z)]);
    const queue: Point[] = [start];
    let best: Point = {x:start.x+0.5,z:start.z+0.5};
    let bestScore = -Infinity;
    for (let head=0;head<queue.length;head++) {
      const tile=queue[head];
      const point={x:tile.x+0.5,z:tile.z+0.5};
      const separation=distance(point,ally);
      const fromCenter=distance(point,center);
      if (separation>=2.4 && fromCenter<5.5) {
        const score=-Math.abs(separation-3.6)-fromCenter*0.1;
        if (score>bestScore) {best=point;bestScore=score;}
      }
      for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const next={x:tile.x+dx,z:tile.z+dz};
        if (distance({x:next.x+0.5,z:next.z+0.5},center)>5.7) continue;
        const key=index(next.x,next.z);
        if (!seen.has(key) && canStep(this.world,tile,next)) {seen.add(key);queue.push(next);}
      }
    }
    return best;
  }

  battleCommand(command: BattleCommand): void {
    const battle=this.battle;
    if (this.mode!=='battle'||!battle||battle.intro>0||battle.finisher||battle.captureSequence||this.battleMenu) return;
    if(command==='return'&&battle.command!=='follow')return;
    if(command==='follow'&&battle.command==='follow')return;
    if(command==='special'&&battle.ally.charge<100)return;
    if (command==='dodge') {
      if (battle.ally.dodgeCooldown>0) {this.notify('A esquiva ainda está recarregando.');return;}
      const ally=battle.ally;
      const threat=battle.foe.strikeOrigin||battle.foe;
      let best:Point|undefined;
      let score=-Infinity;
      for(let i=0;i<16;i++){
        const angle=i*Math.PI/8;
        const leap=Math.max(2.15,battle.foe.strikeRadius+0.45);
        const candidate={x:ally.x+Math.cos(angle)*leap,z:ally.z+Math.sin(angle)*leap};
        if(distance(candidate,battle.center)>=battle.radius-0.65||!this.canOccupy(ally,candidate))continue;
        const value=distance(candidate,threat)-distance(candidate,this.player)*0.02;
        if(value>score){score=value;best=candidate;}
      }
      if(!best){this.notify('Sem espaço para esquivar!');return;}
      ally.dodgeTarget=best;
      ally.dodgeTime=Math.max(0.6,battle.foe.windup+0.12);
      ally.dodgeCooldown=dodgeCooldown(this.activeMonster!,this.statusBonus(this.activeMonster!.uid,'speed'));
      this.effects.push({kind:'dodge',x:battle.ally.x,z:battle.ally.z,element:SPECIES[this.activeMonster!.species].element});
      this.notify(SPECIES[this.activeMonster!.species].name+' saltou para fora do golpe!');
    } else { battle.command=command; battle.waypoint=undefined;battle.moveTime=0; }
    const cue=COMMAND_CUES[command as Exclude<BattleCommand,'move'>];
    if(cue)this.showCommandCue(command==='special'?SPECIES[this.activeMonster!.species].skill.name+'!':cue.label,cue.icon,cue.color);
    this.onChange?.();
  }

  orderMove(point: Point): void {
    if (this.mode!=='battle'||!this.battle||this.battle.intro>0||this.battle.finisher||this.battle.captureSequence||this.battleMenu) return;
    const center=this.battle.center;
    if (distance(point,center)>this.battle.radius-0.5) return;
    this.battle.command='move';
    this.battle.waypoint=point;
    this.battle.moveTime=4;
    this.showCommandCue('Ir até lá!','⌖','#98d6ed');
    this.onChange?.();
  }

  switchMonster(index: number): void {
    if (!this.battle||!this.save||this.mode!=='battle'||this.battle.intro>0||this.battle.finisher||this.battle.captureSequence) return;
    if (index<0||index>=this.save.party.length||this.save.party[index].hp<=0||index===this.battle.allyIndex) return;
    this.save.party[this.battle.allyIndex].hp=this.battle.ally.hp;
    this.battle.allyIndex=index;
    this.battle.ally.hp=this.save.party[index].hp;
    this.battle.ally.charge=0;
    this.battle.ally.attackTimer=1.3;
    this.battle.ally.windup=0;
    this.battle.ally.strikeOrigin=undefined;
    this.battle.ally.dodgeTarget=undefined;
    this.battle.ally.itemPoseTime=0;
    this.battle.command='return';
    this.battle.waypoint=undefined;
    this.battle.moveTime=0;
    this.battle.pendingAutoSupport=true;
    this.battle.autoItemDelay=0;
    this.battleMenu=null;
    this.notify(SPECIES[this.save.party[index].species].name+' entrou na arena!');
    this.onChange?.();
  }

  private moveActor(actor: BattleActor, target: Point, pace: number, dt: number): void {
    if (!this.battle||!this.world) return;
    const diffX=target.x-actor.x,diffZ=target.z-actor.z,len=Math.hypot(diffX,diffZ);
    if (len<0.05) return;
    let next = {x:actor.x+diffX/len*pace*dt,z:actor.z+diffZ/len*pace*dt};
    if (!this.canOccupy(actor,next)) {
      const path=findPath(this.world,{x:Math.floor(actor.x),z:Math.floor(actor.z)},{x:Math.floor(target.x),z:Math.floor(target.z)},200);
      if (path.length) next={x:path[0].x+0.5,z:path[0].z+0.5};
    }
    if (distance(next,this.battle.center)<this.battle.radius-0.5) {
      const dx=next.x-actor.x,dz=next.z-actor.z,l=Math.hypot(dx,dz);
      if (l>0.001) this.movePosition(actor,dx/l,dz/l,pace,dt);
    }
  }

  private updateBattle(dt: number): void {
    const battle=this.battle!, save=this.save!;
    if(battle.captureSequence){
      const sequence=battle.captureSequence;
      sequence.elapsed=Math.min(sequence.duration,sequence.elapsed+dt);
      if(!sequence.announced&&sequence.elapsed>=1.75){sequence.announced=true;this.onChange?.();}
      if(sequence.elapsed>=sequence.duration){
        if(sequence.success){
          this.endBattle('capture');
          this.notify(`${sequence.speciesName} foi capturado! ${sequence.destination==='equipe'?'Entrou na equipe.':'Foi para a coleção.'}`,5);
        } else {
          battle.captureSequence=undefined;
          battle.message=`${sequence.speciesName} escapou da carta!`;
          battle.messageTime=2;
          this.onChange?.();
        }
      }
      return;
    }
    if (battle.finisher) {
      const finish=battle.finisher;
      finish.elapsed=Math.min(finish.duration,finish.elapsed+dt);
      if (!finish.xpShown && finish.elapsed>=1.12) {
        finish.xpShown=true;
        this.effects.push({kind:'xp',x:finish.ally.x,z:finish.ally.z,amount:finish.xp});
        this.onChange?.();
      }
      if (finish.elapsed>=finish.duration) this.endBattle('victory');
      return;
    }
    battle.time+=dt;
    battle.autoItemDelay=Math.max(0,battle.autoItemDelay-dt);
    if(battle.pendingAutoSupport){
      battle.pendingAutoSupport=false;
      this.activateHeldSupport();
    }
    this.maybeUseHeldFood();
    if(battle.cue){
      battle.cue.remaining=Math.max(0,battle.cue.remaining-dt);
      battle.cue.poseRemaining=Math.max(0,battle.cue.poseRemaining-dt);
      if(battle.cue.remaining===0){battle.cue=null;this.onChange?.();}
    }
    battle.itemUseTime=Math.max(0,battle.itemUseTime-dt);
    let expired=false;
    for(const status of battle.statuses){status.remaining=Math.max(0,status.remaining-dt);if(status.remaining===0)expired=true;}
    if(expired){battle.statuses=battle.statuses.filter(status=>status.remaining>0);this.onChange?.();}
    if (battle.messageTime>0) battle.messageTime-=dt;
    const movement={x:this.move.x,z:this.move.z};
    const old={...save.player};
    if(!this.jump)this.movePosition(save.player,movement.x,movement.z,3.7,dt,true);
    if (distance(save.player,battle.center)>battle.radius-0.8) { save.player.x=old.x;save.player.z=old.z; }
    for (const actor of [battle.ally,battle.foe]) {
      actor.attackTimer=Math.max(0,actor.attackTimer-dt);
      actor.dodgeTime=Math.max(0,actor.dodgeTime-dt);
      actor.dodgeCooldown=Math.max(0,actor.dodgeCooldown-dt);
      actor.recovery=Math.max(0,actor.recovery-dt);
      actor.flash=Math.max(0,actor.flash-dt);
      actor.itemPoseTime=Math.max(0,(actor.itemPoseTime??0)-dt);
      actor.charge=Math.min(100,actor.charge+dt*14);
    }
    const allyMonster=this.activeMonster!;
    if(battle.ally.dodgeTime>0){
      if(battle.ally.dodgeTarget){
        this.moveActor(battle.ally,battle.ally.dodgeTarget,3.8+Math.max(1,speed(allyMonster)+this.statusBonus(allyMonster.uid,'speed'))*0.11,dt);
        if(distance(battle.ally,battle.ally.dodgeTarget)<0.13)battle.ally.dodgeTarget=undefined;
      }
    } else if(battle.ally.windup<=0&&battle.ally.recovery<=0){
      const pace=battleMoveSpeed(allyMonster,false,this.statusBonus(allyMonster.uid,'speed'));
      if(battle.command==='return'){
        const awayX=save.player.x-battle.foe.x,awayZ=save.player.z-battle.foe.z;
        const length=Math.hypot(awayX,awayZ)||1;
        const home={x:save.player.x+awayX/length*0.72,z:save.player.z+awayZ/length*0.72};
        if(distance(battle.ally,home)>0.3)this.moveActor(battle.ally,home,pace*1.22,dt);
      }else if(battle.command==='move'&&battle.waypoint){
        battle.moveTime=Math.max(0,battle.moveTime-dt);
        if(distance(battle.ally,battle.waypoint)>0.28&&battle.moveTime>0)
          this.moveActor(battle.ally,battle.waypoint,pace,dt);
        else {battle.command='return';battle.waypoint=undefined;this.onChange?.();}
      }else {
        const desired=battle.command==='follow'?0.75:attackRadius(allyMonster)-0.15;
        if(distance(battle.ally,battle.foe)>desired)this.moveActor(battle.ally,battle.foe,pace,dt);
      }
    }
    if(battle.foe.windup<=0&&battle.foe.recovery<=0&&distance(battle.foe,battle.ally)>attackRadius(battle.enemy)-0.12)
      this.moveActor(battle.foe,battle.ally,battleMoveSpeed(battle.enemy,true,this.statusBonus(battle.enemy.uid,'speed')),dt);
    this.processAttack(battle.ally,battle.foe,this.activeMonster!,battle.enemy,true,dt);
    if (!this.battle) return;
    if (battle.foe.hp<=0) { this.beginVictory(); return; }
    this.processAttack(battle.foe,battle.ally,battle.enemy,this.activeMonster!,false,dt);
    if (!this.battle) return;
    if (battle.foe.hp<=0) { this.beginVictory(); return; }
    this.maybeUseHeldFood();
    if (battle.ally.hp<=0) {
      save.party[battle.allyIndex].hp=0;
      const next=save.party.findIndex(m=>m.hp>0);
      if (next>=0) {battle.allyIndex=next;battle.ally.hp=save.party[next].hp;battle.ally.charge=0;battle.ally.attackTimer=1.3;
        battle.ally.itemPoseTime=0;battle.pendingAutoSupport=true;battle.autoItemDelay=0;
        battle.command='return';battle.waypoint=undefined;battle.moveTime=0;
        this.notify(SPECIES[save.party[next].species].name+' entrou para ajudar!');}
      else this.endBattle('loss');
    }
  }

  private beginVictory(): void {
    const battle=this.battle;
    if (!battle||battle.finisher) return;
    battle.foe.hp=0;
    battle.foe.windup=0;
    battle.foe.strikeOrigin=undefined;
    battle.ally.windup=0;
    battle.ally.strikeOrigin=undefined;
    battle.cue=null;
    battle.message='Vitória!';
    battle.messageTime=BATTLE_FINISH_SECONDS;
    battle.finisher={elapsed:0,duration:BATTLE_FINISH_SECONDS,xp:20+battle.enemy.level*5,xpShown:false,
      enemyElement:SPECIES[battle.enemy.species].element,allyElement:SPECIES[this.activeMonster!.species].element,
      foe:{x:battle.foe.x,z:battle.foe.z},
      ally:{x:battle.ally.x,z:battle.ally.z},hero:{...this.player}};
    this.battleMenu=null;
    this.onChange?.();
  }

  private processAttack(source: BattleActor, target: BattleActor, attacker: Monster, defender: Monster, isAlly: boolean, dt: number): void {
    if (!this.battle) return;
    if (source.windup>0) {
      source.windup-=dt;
      if (source.windup<=0) {
        const skill=source.skillWindup;
        const species=SPECIES[attacker.species];
        const hit=!!source.strikeOrigin&&distance(source.strikeOrigin,target)<=source.strikeRadius;
        if (hit) {
          const critical=Math.random()<criticalChance(attacker);
          const damage=attackDamage(attacker,defender,skill,critical,
            this.statusBonus(attacker.uid,'attack'),this.statusBonus(defender.uid,'defense'));
          target.hp=Math.max(0,target.hp-damage);
          target.flash=0.32;
          this.effects.push({kind:skill?'skill':'hit',x:target.x,z:target.z,element:species.element});
          this.effects.push({kind:'damage',x:target.x,z:target.z,amount:damage,critical});
          this.battle.message=(isAlly?'Seu ':'O ')+species.name+' causou '+damage+' de dano'+(critical?' crítico':'')+(skill?' com '+species.skill.name:'')+'!';
        } else {
          this.effects.push({kind:'damage',x:target.x,z:target.z,amount:0,critical:false});
          this.battle.message=isAlly?'Seu golpe errou!':'Esquivou!';
        }
        source.strikeOrigin=undefined;
        source.strikeRadius=0;
        source.recovery=isAlly?0.25:enemyRecovery(attacker,this.statusBonus(attacker.uid,'speed'));
        if(isAlly&&(this.battle.command==='attack'||(this.battle.command==='special'&&skill)))this.battle.command='return';
        this.battle.messageTime=1.7;
        this.onChange?.();
      }
      return;
    }
    if (isAlly&&this.battle.command!=='attack'&&this.battle.command!=='special'&&this.battle.command!=='follow')return;
    if (source.attackTimer<=0&&source.recovery<=0&&distance(source,target)<=attackRadius(attacker)+0.05) {
      source.skillWindup=source.charge>=100&&(!isAlly||this.battle.command==='special');
      if (source.skillWindup) source.charge=0;
      source.strikeOrigin={x:source.x,z:source.z};
      source.strikeRadius=attackRadius(attacker,source.skillWindup)+(source.skillWindup?0:0.22);
      source.windup=source.skillWindup?(isAlly?0.72:1.02):(isAlly?0.32:0.58);
      const speedBonus=this.statusBonus(attacker.uid,'speed');
      source.attackTimer=(isAlly?attackInterval(attacker,speedBonus):enemyAttackInterval(attacker,speedBonus))+
        (source.skillWindup?0.45:0);
      if (source.skillWindup) this.battle.message='⚠ '+SPECIES[attacker.species].name+' prepara '+SPECIES[attacker.species].skill.name+'!';
      this.battle.messageTime=1.2;
      this.onChange?.();
    }
  }

  captureChance(): number {
    if (!this.battle||this.battle.finisher||this.battle.captureSequence) return 0;
    return captureChance(this.battle.enemy,this.battle.foe.hp);
  }

  capture(cardElement?:Element): void {
    if (!this.battle||!this.save||this.mode!=='battle'||this.battle.intro>0||this.battle.finisher||this.battle.captureSequence) return;
    if (!this.battle.wildId) {this.notify('Monstros de guardiões não podem ser capturados.');return;}
    const species=SPECIES[this.battle.enemy.species],element=species.element;
    if(cardElement&&cardElement!==element){this.notify('Use uma carta de '+ELEMENT_LABEL[element]+' para capturar '+species.name+'.');return;}
    if (this.save.cards[element]<=0) {this.notify('Você precisa de uma carta de '+ELEMENT_LABEL[element]+'.');return;}
    const chance=this.captureChance();
    if (chance===0) {this.notify('Enfraqueça '+species.name+' até metade da vida para capturar.');return;}
    this.save.cards[element]--;
    this.battleMenu=null;
    this.jump=null;
    this.setMove(0,0);
    const success=Math.random()*100<chance;
    let destination:'equipe'|'coleção'|undefined;
    if (success) {
      const captured=createMonster(species.id,this.battle.enemy.level,'captured-'+Date.now());
      captured.hp=Math.max(1,Math.floor(maxHp(captured)*0.6));
      if (this.save.party.length<3){this.save.party.push(captured);destination='equipe';}
      else{this.save.collection.push(captured);destination='coleção';}
    }
    this.battle.foe.windup=0;
    this.battle.foe.strikeOrigin=undefined;
    this.battle.ally.windup=0;
    this.battle.ally.strikeOrigin=undefined;
    this.battle.cue=null;
    this.battle.captureSequence={elapsed:0,duration:success?CAPTURE_FINISH_SECONDS:CAPTURE_FAIL_SECONDS,announced:false,
      success,element,speciesName:species.name,destination,
      foe:{x:this.battle.foe.x,z:this.battle.foe.z},
      ally:{x:this.battle.ally.x,z:this.battle.ally.z},hero:{...this.player}};
    this.battle.message=success?'A carta envolveu '+species.name+'!':'A carta tenta capturar '+species.name+'...';
    this.battle.messageTime=this.battle.captureSequence.duration;
    this.persist();
    this.onChange?.();
  }

  flee(): void {
    if (!this.battle||this.mode!=='battle'||this.battle.intro>0||this.battle.finisher||this.battle.captureSequence) return;
    if (this.battle.guardian) {this.notify('Você precisa terminar o desafio do guardião.');return;}
    if (this.save && this.battle.wildId) this.save.wildCooldown[this.battle.wildId]=this.save.elapsed+25;
    this.endBattle('flee');
    this.notify('Você saiu da arena.');
  }

  swapCollection(reserveIndex:number,partyIndex?:number):void {
    if (!this.save || this.mode==='battle') return;
    const reserve=this.save.collection[reserveIndex];
    if (!reserve) return;
    if (this.save.party.length<3) {
      this.save.party.push(reserve);
      this.save.collection.splice(reserveIndex,1);
    } else {
      const target=partyIndex===undefined?this.save.party.length-1:partyIndex;
      if (target<0||target>=this.save.party.length) return;
      this.save.collection[reserveIndex]=this.save.party[target];
      this.save.party[target]=reserve;
    }
    this.persist();
    this.onChange?.();
  }

  private endBattle(result:'victory'|'capture'|'loss'|'flee'):void {
    const battle=this.battle,save=this.save;
    if (!battle||!save) return;
    save.party[battle.allyIndex].hp=Math.max(0,battle.ally.hp);
    if (battle.wildId && result!=='flee') save.wildCooldown[battle.wildId]=save.elapsed+160;
    if (result==='victory') {
      const active=save.party[battle.allyIndex];
      const reward=gainExperience(active,battle.finisher?.xp??20+battle.enemy.level*5);
      save.wins++;
      if (reward.evolved) {
        this.effects.push({kind:'evolve',x:battle.ally.x,z:battle.ally.z,element:SPECIES[active.species].element,species:active.species});
        this.notify('Evolução! '+SPECIES[active.species].name+' alcançou uma nova forma!',5);
      } else this.notify('Vitória! '+SPECIES[active.species].name+' ganhou experiência.');
      if (battle.guardian && !save.seals.includes(battle.guardian)) {
        save.seals.push(battle.guardian);
        save.cards[battle.guardian]+=2;
        this.effects.push({kind:'seal',x:battle.center.x,z:battle.center.z,element:battle.guardian});
        this.notify('Selo de '+ELEMENT_LABEL[battle.guardian]+' obtido! +2 cartas.',5);
        if (save.seals.length===3) {save.completed=true;this.notify('Os três selos foram reunidos! A região está completa e continua aberta para explorar.',8);}
      }
    }
    this.battle=null;
    this.battleMenu=null;
    this.jump=null;
    this.mode='explore';
    if (result==='loss') this.rescue();
    this.persist();
    this.onChange?.();
  }

  private rescue(): void {
    if (!this.save) return;
    this.save.player={x:48,z:48};
    this.save.party.forEach(monster=>monster.hp=maxHp(monster));
    this.mode='explore';
    this.notify('Sua equipe desmaiou. A guardiã levou vocês ao vilarejo e cuidou de todos.',6);
    this.persist();
  }

  togglePause(): void {
    if (this.mode==='dialog'||this.mode==='title') return;
    if (this.battle&&this.battle.intro>0)return;
    if (this.battleMenu) {this.closeBattleMenu();return;}
    if (this.mode==='pause') this.mode=this.previousMode;
    else {this.previousMode=this.mode;this.mode='pause';this.persist();}
    this.onChange?.();
  }

  getGroundHeight(x:number,z:number):number {
    const tile=this.world && tileAt(this.world,Math.floor(x),Math.floor(z));
    return tile ? tile.height*HEIGHT_STEP : 0;
  }
}
