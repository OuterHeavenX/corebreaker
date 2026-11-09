import type {Progress,RunState,Settings} from './types';
const KEY='corebreaker.save.v2',BACKUP='corebreaker.save.backup';
export const defaults:Settings={music:.55,sfx:.7,shake:.35,reducedMotion:false,highContrast:false,largeCore:false,touchSensitivity:1,directTouch:false,leftHanded:false,assistSpeed:false,assistWidth:false,assistBullets:false};
export const fresh=():Progress=>({version:2,xp:0,rank:1,rescues:0,campaignBest:0,unlocks:['guardian'],tutorials:[],settings:{...defaults},records:{},selectedShip:'guardian'});
export function validate(x:unknown):x is Progress{if(!x||typeof x!=='object')return false;const p=x as {version?:number;xp?:unknown;rank?:unknown;unlocks?:unknown};return (p.version===1||p.version===2)&&typeof p.xp==='number'&&typeof p.rank==='number'&&Array.isArray(p.unlocks)}
function migrate(p:any):Progress{if(p.version===1){p.version=2;p.records??={};p.selectedShip??='guardian'}return {...fresh(),...p,settings:{...defaults,...p.settings}}}
export function load():Progress{try{const raw=localStorage.getItem(KEY);if(raw){const x=JSON.parse(raw);if(validate(x))return migrate(x);localStorage.setItem('corebreaker.corrupt',raw)}const backup=localStorage.getItem(BACKUP);if(backup){const x=JSON.parse(backup);if(validate(x))return migrate(x)}}catch{}return fresh()}
export function save(p:Progress){try{const old=localStorage.getItem(KEY);if(old)localStorage.setItem(BACKUP,old);localStorage.setItem(KEY,JSON.stringify(p));return true}catch{return false}}
export function newRun(mode:RunState['mode'],ship:RunState['ship'],seed=Date.now()>>>0):RunState{return{mode,stage:1,shield:100,scrap:0,ship,upgrades:{},elements:[],seed,claimed:[]}}
export function exportSave(p:Progress){const b=new Blob([JSON.stringify(p,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='corebreaker-save.json';a.click();URL.revokeObjectURL(a.href)}
export function importSave(text:string):Progress{const x=JSON.parse(text);if(!validate(x))throw new Error('Not a valid Corebreaker save.');const p=migrate(x);save(p);return p}
export function dailySeed(d=new Date()){return Number(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`)>>>0}
