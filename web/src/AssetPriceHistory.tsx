import { useState } from "react";
import type { QuoteObservation } from "./QuoteHistory";
import { pricePlot, PRICE_CHART_LIMIT } from "./price-chart";
import type { PricePlot } from "./price-chart";
const errors={selection:"Choisissez la devise des observations à tracer.",time:"Dates ou date de lecture indisponibles. Rechargez les observations si nécessaire.",range:"Choisissez une période d’au plus 366 jours, dont la fin ne dépasse pas la date de lecture des observations.",observation:"Une observation de cette période ne peut pas être représentée. Consultez les données sources.",limit:`Plus de ${PRICE_CHART_LIMIT} observations dans cette vue. Réduisez la période ; aucune observation source n’est supprimée.`};
export function AssetPriceHistory({assetId,assetName,observations,asOf}:{assetId:string;assetName:string;observations:QuoteObservation[];asOf?:string}) {
 const [currency,setCurrency]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState("");
 const [plot,setPlot]=useState<PricePlot|null>(null);
 const currencies=[...new Set(observations.filter(p=>p.asset_id===assetId).map(p=>p.currency))].sort();
 return <details className="asset-chart">
  <summary>Graphique des observations de cours</summary>
  <p>Choisissez une devise et une période. Points aux dates enregistrées uniquement, sans interpolation ni conversion. Ce graphique décrit les prix, pas la valeur ou le rendement de votre position.</p>
  {!currencies.length?<p>Aucune observation disponible pour ce graphique.</p>:<>
   <form onSubmit={e=>{
    e.preventDefault();
    try{setPlot(pricePlot(observations,assetId,currency,new Date(from).toISOString(),new Date(to).toISOString(),asOf));}
    catch{setPlot({state:"invalid",code:"time"});}
   }}>
    <label htmlFor={`price-currency-${assetId}`}>Devise du graphique</label>
    <select id={`price-currency-${assetId}`} required value={currency} onChange={e=>{setCurrency(e.target.value);setPlot(null);}}><option value="">Choisir une devise</option>{currencies.map(c=><option key={c} value={c}>{c}</option>)}</select>
    <label htmlFor={`price-from-${assetId}`}>Début du graphique (fuseau du navigateur)</label>
    <input id={`price-from-${assetId}`} type="datetime-local" required value={from} onChange={e=>{setFrom(e.target.value);setPlot(null);}}/>
    <label htmlFor={`price-to-${assetId}`}>Fin du graphique (fuseau du navigateur)</label>
    <input id={`price-to-${assetId}`} type="datetime-local" required value={to} onChange={e=>{setTo(e.target.value);setPlot(null);}}/>
    <button className="secondary">Tracer les observations</button>
   </form>
   {asOf&&<p>Lecture des observations au <time dateTime={asOf}>{asOf}</time>. Une nouvelle période retire le tracé précédent.</p>}
   {plot?.state==="invalid"&&<p role="alert">{errors[plot.code]}</p>}
   {plot?.state==="empty"&&<p>Aucune observation dans cette devise et cette période.</p>}
   {plot?.state==="ready"&&<>
    <figure className="history-chart">
     <p>Prix de {plot.min.replace(".",",")} à {plot.max.replace(".",",")} {plot.currency}.</p>
     <svg viewBox="0 0 1000 300" role="img" aria-label={`Observations de cours de ${assetName} en ${plot.currency}, aux dates connues, sans interpolation`}>
      <line x1="60" y1="240" x2="940" y2="240" className="chart-axis"/>
      {plot.points.map(p=><circle key={p.id} cx={p.x} cy={p.y} r="4" className="chart-point asset-price-point"><title>{p.observed_at} : {p.value} {p.currency} · {p.source}</title></circle>)}
     </svg>
     <figcaption>{plot.from} → {plot.to}. {plot.points.length} observation(s). Plusieurs sources peuvent coexister au même instant ; les valeurs exactes sont listées ci-dessous.</figcaption>
    </figure>
    <div className="history-points" role="list" tabIndex={0} aria-label="Observations exactes du graphique">
     {plot.points.map(p=><div role="listitem" key={p.id}><time dateTime={p.observed_at}>{p.observed_at}</time><span>{p.value.replace(".",",")} {p.currency} · {p.source}</span></div>)}
    </div>
   </>}
  </>}
 </details>;
}
