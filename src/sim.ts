export function rebound(ballX:number,paddleX:number,paddleWidth:number,paddleVelocity=0){const n=Math.max(-1,Math.min(1,(ballX-paddleX)/(paddleWidth/2)));const max=Math.PI*0.36;const angle=n*max+Math.max(-.12,Math.min(.12,paddleVelocity/2200));return{x:Math.sin(angle),y:-Math.cos(angle)}}
export function antiStall(v:{x:number;y:number},staleSeconds:number){if(staleSeconds<8&&Math.abs(v.y)>.22)return v;const sy=v.y>=0?1:-1;const sx=v.x>=0?1:-1;const y=Math.max(.32,Math.abs(v.y));const x=Math.sqrt(1-y*y);return{x:x*sx,y:y*sy}}
export class RNG{constructor(public state:number){}next(){this.state=(this.state*1664525+1013904223)>>>0;return this.state/4294967296}pick<T>(a:T[]){return a[Math.floor(this.next()*a.length)]}}
export function finalBallLost(active:number){return active<=1}
export function damageShield(shield:number,amount:number,lastHit:number,now:number){return now-lastHit<900?shield:Math.max(0,shield-amount)}
