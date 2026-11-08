import type { Summary } from "./Finance";
const labels: Record<string,string> = {stock:"Actions",etf:"ETF",crypto:"Crypto",stablecoin:"Stablecoins",savings:"Épargne",cash:"Liquidités"};
export function PortfolioAllocation({ portfolioId, summary }: { portfolioId: string; summary: Summary }) {
  const allocation = summary.portfolio_allocations_eur?.[portfolioId];
  return <details>
    <summary>Répartition de ce portefeuille</summary>
    {!allocation ? <p>Aucune répartition disponible dans cette synthèse.</p> : <section aria-label="Répartition du portefeuille sélectionné">
      <p>Valeurs en EUR au <time dateTime={summary.at}>{new Date(summary.at).toLocaleString("fr-FR")}</time>.</p>
      {allocation.missing_valuation ? <p>Répartition partielle : seules les valeurs connues sont incluses. Les positions ou liquidités sans cours ou taux ne sont pas remplacées par zéro.</p> : <p>Répartition des valeurs connues de tous les comptes de ce portefeuille.</p>}
      {allocation.uses_prior_date_observations && <p>Cette répartition utilise des cours ou taux d’une date antérieure à la synthèse. Consultez leurs sources dans le détail des comptes.</p>}
      <p>Valeur connue : <span title={`Valeur exacte : ${allocation.known_value_eur.exact}`}>{allocation.known_value_eur.approximate ? "≈ " : ""}{allocation.known_value_eur.display.replace(".",",")} EUR</span></p>
      <ul className="resource-list" aria-label="Catégories valorisées de ce portefeuille">
        {Object.entries(allocation.by_kind_eur).sort(([a],[b])=>a.localeCompare(b)).map(([kind,value])=><li key={kind}>
          {labels[kind] || kind} : <span title={`Valeur exacte : ${value.exact}`}>{value.approximate ? "≈ " : ""}{value.display.replace(".",",")} EUR</span>
        </li>)}
      </ul>
      {Object.keys(allocation.by_kind_eur).length===0 && <p>{allocation.missing_valuation ? "Aucune catégorie valorisable dans ce portefeuille." : "Aucune valeur à répartir dans ce portefeuille."}</p>}
      <p className="help">Montants de valeur, pas des gains. L’épargne reste distincte des liquidités de courtage ; aucun ratio n’est calculé à partir d’une valeur incomplète.</p>
    </section>}
  </details>;
}
