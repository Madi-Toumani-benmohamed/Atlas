import { useState } from "react";
import type { Account } from "./api";
import type { Operation } from "./Finance";
export function AssetOperations({ assetId, operations, accounts, labels }: {
  assetId: string; operations: Operation[]; accounts: Account[]; labels: Record<string, string>;
}) {
  const [limit, setLimit] = useState(5);
  // The API's registration order is kept; a correction is not moved to its economic date.
  const history = operations.filter(e => e.asset_id === assetId).reverse();
  return <details>
    <summary>Opérations enregistrées pour cet actif ({history.length})</summary>
    <p>Ordre d’enregistrement, de la plus récente à la plus ancienne. Dates et champs sources du journal, sans recalcul. Les écritures remplacées ou annulées sont conservées pour l’audit.</p>
    {history.length === 0 ? <p>Aucune opération enregistrée pour cet actif.</p> : <>
      <ul className="resource-list" aria-label="Historique des opérations de cet actif">
        {history.slice(0, limit).map(e => {
          const account = accounts.find(a => a.id === e.account_id);
          const target = accounts.find(a => a.id === e.target_account_id);
          return <li key={e.id}>
            <h5>{labels[String(e.kind)] || "Opération"} · {account?.name || "Compte indisponible"}</h5>
            <p>Date de l’opération : <time dateTime={e.occurred_at}>{new Date(e.occurred_at).toLocaleString("fr-FR")}</time></p>
            <p>Statut : {e.active ? "Active" : "Remplacée ou annulée"}</p>
            <p>Devise du compte : {account?.currency || "Indisponible"}</p>
            {e.target_account_id && <p>Compte destinataire : {target?.name || "Indisponible"}</p>}
            {Object.entries({ quantity: "Quantité saisie", price: "Prix unitaire saisi", amount: "Montant saisi", fees: "Frais saisis", cost: "Coût d’acquisition saisi" }).map(([field, label]) =>
              typeof e[field] === "string" && e[field] !== "" ? <p key={field}>{label} : {String(e[field]).replace(".", ",")}{field !== "quantity" && account ? ` ${account.currency}` : ""}</p> : null)}
            {e.corrects && <p>Cette écriture corrige un événement antérieur.</p>}
            {e.reason && <p>Motif : {String(e.reason)}</p>}
            {e.note && <p>Note : {String(e.note)}</p>}
          </li>;
        })}
      </ul>
      <p>{Math.min(limit, history.length)} écritures affichées sur {history.length}.</p>
      {limit < history.length && <button className="secondary" onClick={() => setLimit(n => n + 5)}>Afficher davantage d’opérations</button>}
    </>}
  </details>;
}
