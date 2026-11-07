import { useState } from "react";

type Observation = {
  id: string;
  asset_id?: string;
  value: string;
  currency: string;
  observed_at: string;
  source: string;
};

// The private API orders observations by date, creation time, then ID.
// Reverse a copy to preserve that order, including equal-date observations.
export function QuoteHistory({ assetId, observations }: {
  assetId: string;
  observations: Observation[];
}) {
  const [limit, setLimit] = useState(5);
  const history = observations.filter(p => p.asset_id === assetId).reverse();
  return (
    <details>
      <summary>Historique des cours enregistrés ({history.length})</summary>
      <p>
        Observations saisies, de la plus récente à la plus ancienne. Chaque cours
        conserve sa devise ; aucune conversion ni interpolation n’est appliquée.
        Cet historique décrit le cours, pas votre rendement personnel.
      </p>
      {history.length === 0 ? <p>Aucun cours enregistré pour cet actif.</p> : (
        <>
          <ul className="resource-list" aria-label="Cours enregistrés pour cet actif">
            {history.slice(0, limit).map(p => (
              <li key={p.id}>
                <p>Cours : {p.value} {p.currency}</p>
                <p>Date d’observation : <time dateTime={p.observed_at}>{p.observed_at}</time></p>
                <p>Source : {p.source}</p>
              </li>
            ))}
          </ul>
          <p>{Math.min(limit, history.length)} cours affichés sur {history.length}.</p>
          {limit < history.length && (
            <button className="secondary" onClick={() => setLimit(n => n + 5)}>
              Afficher davantage de cours
            </button>
          )}
        </>
      )}
    </details>
  );
}
