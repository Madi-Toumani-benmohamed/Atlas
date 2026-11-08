import { AssetPriceHistory } from "./AssetPriceHistory";
import type { Asset } from "./api";
import type { Summary } from "./Finance";
import { QuoteHistory } from "./QuoteHistory";
import type { QuoteObservation } from "./QuoteHistory";
type Value = Summary["positions"][number]["quantity"];
function ValueText({ value, unit }: {value:Value|null;unit:string}) {
 return <span title={value?`Valeur exacte : ${value.exact}`:undefined}>{value?`${value.approximate?"≈ ":""}${value.display.replace(".",",")}${unit?` ${unit}`:""}`:"Non calculable"}</span>;
}
export function AssetPositions({ assetId, summary }: {assetId:string;summary:Summary}) {
 const positions=summary.positions.filter(p=>p.asset_id===assetId);
 return <details className="asset-disclosure">
  <summary>Détail des positions et résultats</summary>
  <p>Positions au <time dateTime={summary.at}>{new Date(summary.at).toLocaleString("fr-FR")}</time>.</p>
  {positions.length===0?<p>Aucune position de cet actif dans cette synthèse.</p>:<ul className="resource-list" aria-label="Positions de cet actif par compte">
   {positions.map(p=>{
    const metrics:[string,Value|null,string][]=[["Quantité",p.quantity,""],["Valeur",p.value_eur,"EUR"],["Coût restant",p.cost,p.currency],["PRU économique",p.average_cost,p.currency],["Résultat latent",p.unrealized,p.currency],["Résultat réalisé",p.realized,p.currency]];
    return <li key={p.account_id}>
     <h4>{summary.cash.find(c=>c.account_id===p.account_id)?.name || "Compte indisponible"}</h4>
     {metrics.map(([label,value,unit])=><p key={label}>{label} : <ValueText value={value} unit={unit}/></p>)}
     {metrics.some(([,v])=>v?.approximate)&&<details className="asset-exact">
      <summary>Valeurs exactes de la position</summary>
      <dl>{metrics.map(([label,value,unit])=><div key={label}><dt>{label}</dt><dd>{value?`${value.exact}${unit?` ${unit}`:""}`:"Non calculable"}</dd></div>)}</dl>
     </details>}
     {p.quality==="closed"&&<p>Position clôturée.</p>}
    </li>;
   })}
  </ul>}
 </details>;
}
export type AssetChanges = Record<string,Record<string,Value|null>>;
export function AssetMarketDetails({ asset, observations, asOf, changes }: {asset:Asset;observations:QuoteObservation[];asOf?:string;changes?:Record<string,Value|null>}) {
 const latest=observations.filter(p=>p.asset_id===asset.id).at(-1);
 return <details className="asset-disclosure">
  <summary>Cours et historique de cet actif</summary>
  {!latest?<p>Dernier cours indisponible : aucune observation enregistrée.</p>:<>
   <p>Dernier cours enregistré : {latest.value.replace(".",",")} {latest.currency}</p>
   <p>Source : {latest.source} · <time dateTime={latest.observed_at}>{latest.observed_at}</time>.</p>
   {asOf&&latest.observed_at.slice(0,10)<asOf.slice(0,10)&&<p>Observation d’une date antérieure à la synthèse.</p>}
   <p>Cours daté dans sa devise d’origine. Il ne représente ni un cours temps réel ni le rendement de votre position.</p>
   {changes?<section aria-label="Variations du cours de cet actif">
    <h4>Variations du cours</h4>
    {asOf&&<p>Calcul au <time dateTime={asOf}>{asOf}</time>.</p>}
    <p>Comparaison des cours dans une même devise aux dates couvertes. Ce ne sont pas les gains de votre position.</p>
    {[["day","Un jour"],["week","Une semaine"],["month","Un mois"],["year","Un an"]].map(([key,label])=><p key={key}>{label} : <ValueText value={changes[key]||null} unit="%"/></p>)}
    <p>Une observation absente à la date comparée, une devise différente ou un dernier cours d’un jour antérieur rendent la variation non calculable.</p>
    {Object.values(changes).some(v=>v?.approximate)&&<details className="asset-exact"><summary>Variations exactes</summary><dl>
      {[["day","Un jour"],["week","Une semaine"],["month","Un mois"],["year","Un an"]].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{changes[key]?`${changes[key]!.exact} %`:"Non calculable"}</dd></div>)}
    </dl></details>}
   </section>:<p>Variations non disponibles dans cette réponse.</p>}
  </>}
  <AssetPriceHistory key={`chart-${asset.id}`} assetId={asset.id} assetName={asset.name} observations={observations} asOf={asOf}/>
  <QuoteHistory key={asset.id} assetId={asset.id} observations={observations}/>
 </details>;
}
