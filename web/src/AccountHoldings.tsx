import type { Account, Asset } from "./api";
import type { Summary } from "./Finance";
type Value = Summary["positions"][number]["quantity"];
function Amount({ value, unit = "" }: { value: Value | null | undefined; unit?: string }) {
  return <span title={value ? `Valeur exacte : ${value.exact}` : undefined}>
    {value ? `${value.approximate ? "≈ " : ""}${value.display.replace(".", ",")} ${unit}` : "Non calculable"}
  </span>;
}
export function AccountHoldings({ account, assets, summary }: {
  account: Account; assets: Asset[]; summary: Summary;
}) {
  const cash = summary.cash.find(c => c.account_id === account.id);
  const positions = summary.positions.filter(p => p.account_id === account.id);
  return (
    <section aria-label={`Liquidités et positions de ${account.name}`}>
      <p>Synthèse au <time dateTime={summary.at}>{new Date(summary.at).toLocaleString("fr-FR")}</time>.</p>
      <h4>{account.kind === "savings" ? "Solde d’épargne" : "Liquidités"}</h4>
      {cash ? <>
        <p>Solde enregistré : <Amount value={cash.amount} unit={cash.currency} /></p>
        <p>Valeur des liquidités en EUR : <Amount value={cash.value_eur} unit="EUR" /></p>
        {cash.fx_observation && <p>Conversion : {cash.fx_observation.source} · <time dateTime={cash.fx_observation.observed_at}>{cash.fx_observation.observed_at}</time></p>}
        {!cash.value_eur && <p>Taux de change manquant : la valeur en EUR reste indisponible.</p>}
      </> : <p>Solde indisponible dans cette synthèse.</p>}
      {account.kind === "savings" && <p>Le solde inclut les intérêts effectivement crédités, sans simulation d’intérêts futurs.</p>}
      <h4>Positions de ce compte</h4>
      {positions.length === 0 ? <p>Aucune position enregistrée dans ce compte.</p> : (
        <ul className="resource-list" aria-label={`Positions de ${account.name}`}>
          {positions.map(p => {
            const asset = assets.find(a => a.id === p.asset_id);
            return <li key={p.asset_id}>
              <h5>{p.name}</h5>
              {asset && <p>{asset.symbol} · {asset.namespace} · {asset.reference}</p>}
              <p>Quantité : <Amount value={p.quantity} /></p>
              <p>Valeur de la position en EUR : <Amount value={p.value_eur} unit="EUR" /></p>
              <p>Coût restant : <Amount value={p.cost} unit={p.currency} /></p>
              <p>PRU économique : <Amount value={p.average_cost} unit={p.currency} /></p>
              <p>Résultat latent : <Amount value={p.unrealized} unit={p.currency} /></p>
              <p>Résultat réalisé : <Amount value={p.realized} unit={p.currency} /></p>
              {!p.cost && <p>Coût d’acquisition inconnu : le PRU et les résultats restent non calculables.</p>}
              {p.quality === "closed" ? <p>Position clôturée.</p> : p.quote ? <>
                <p>Dernier cours connu : {p.quote.value} {p.quote.currency} · {p.quote.source} · <time dateTime={p.quote.observed_at}>{p.quote.observed_at}</time>.</p>
                <p>{p.quote.observed_at.slice(0, 10) < summary.at.slice(0, 10) ? "Cours d’une date antérieure à la synthèse. " : ""}Cours daté, sans promesse de temps réel.</p>
              </> : <p>Cours manquant pour cette position.</p>}
              {p.fx_observations.map((fx, i) => <p key={`${fx.id}-${i}`}>Taux de conversion : {fx.source} · <time dateTime={fx.observed_at}>{fx.observed_at}</time>.</p>)}
            </li>;
          })}
        </ul>
      )}
      <p className="help">Valeurs du compte uniquement. Les résultats des positions sont dans la devise du compte ; ils ne constituent pas un rendement global du portefeuille. Une donnée manquante n’est jamais remplacée par zéro.</p>
    </section>
  );
}
