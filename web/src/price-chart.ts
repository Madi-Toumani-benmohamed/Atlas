import type { QuoteObservation } from "./QuoteHistory";
export const PRICE_CHART_LIMIT=1000;
export type PricePoint=QuoteObservation&{x:number;y:number};
export type PricePlot={state:"ready";points:PricePoint[];currency:string;from:string;to:string;min:string;max:string}|{state:"empty"}|{state:"invalid";code:"selection"|"time"|"range"|"observation"|"limit"};
function instant(text:string):bigint|null {
 const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(text);
 if(!match)return null;
 const milliseconds=Date.parse(match[1]+match[3]);
 if(!Number.isFinite(milliseconds))return null;
 return BigInt(milliseconds)*1000000n+BigInt((match[2]||"").padEnd(9,"0"));
}
function price(text:string):bigint|null {
 if(!/^(0|[1-9][0-9]{0,35})(\.[0-9]{1,18})?$/.test(text))return null;
 const [whole,part=""]=text.split(".");
 const n=BigInt(whole+part.padEnd(18,"0"));return n>0n?n:null;
}
// Financial values and instants stay exact. Number is used only for bounded SVG coordinates.
export function pricePlot(observations:QuoteObservation[],assetId:string,currency:string,from:string,to:string,asOf:string|undefined):PricePlot {
 if(!assetId||!/^[A-Z]{3}$/.test(currency))return{state:"invalid",code:"selection"};
 const start=instant(from),end=instant(to),now=asOf?instant(asOf):null;
 if(start===null||end===null||now===null)return{state:"invalid",code:"time"};
 if(end<start||end>now||end-start>366n*24n*60n*60n*1000000000n)return{state:"invalid",code:"range"};
 const known:{observation:QuoteObservation;at:bigint;n:bigint}[]=[];
 for(const observation of observations){
  if(observation.asset_id!==assetId||observation.currency!==currency)continue;
  const at=instant(observation.observed_at);
  if(at===null)return{state:"invalid",code:"observation"};
  if(at<start||at>end)continue;
  const n=price(observation.value);
  if(n===null)return{state:"invalid",code:"observation"};
  known.push({observation,at,n});
  if(known.length>PRICE_CHART_LIMIT)return{state:"invalid",code:"limit"};
 }
 if(!known.length)return{state:"empty"};
 const min=known.reduce((a,b)=>a.n<b.n?a:b),max=known.reduce((a,b)=>a.n>b.n?a:b);
 const span=end-start,range=max.n-min.n;
 return{state:"ready",currency,from,to,min:min.observation.value,max:max.observation.value,points:known.map(p=>({...p.observation,
  x:span===0n?500:60+Number((p.at-start)*88000n/span)/100,
  y:range===0n?145:240-Number((p.n-min.n)*19000n/range)/100,
 }))};
}
