import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "./api";
import type { Account, Asset } from "./api";

type Amount = { exact: string; display: string; approximate: boolean };
type Row = {
  kind: string;
  asset_id?: string;
  asset_name?: string;
  origin: string;
  expected: Amount;
  actual: Amount;
  delta: Amount;
  matches: boolean;
};
type Report = {
  format: string;
  account_id: string;
  currency: string;
  as_of: string;
  calculated_at: string;
  partial_history: boolean;
  complete_positions: boolean;
  cash_checked: boolean;
  differences: number;
  rows: Row[];
};
function amount(value: Amount) {
  const [integer, fraction] = value.display.split(".");
  const display = `${integer === "-0" ? "-0" : new Intl.NumberFormat("fr-FR").format(BigInt(integer))}${fraction ? `,${fraction}` : ""}`;
  return `${display}${value.approximate ? ` (exact : ${value.exact})` : ""}`;
}
export function Reconciliation({
  accounts,
  assets,
  disabled,
  run,
}: {
  accounts: Account[];
  assets: Asset[];
  disabled: boolean;
  run: (work: () => Promise<void>) => void;
}) {
  const [account, setAccount] = useState("");
  const [csv, setCSV] = useState("");
  const [result, setResult] = useState<Report | null>(null);
  const [fileError, setFileError] = useState("");
  const fileGeneration = useRef(0);
  const currency = accounts.find((a) => a.id === account)?.currency || "";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = new Date(String(data.get("as_of")));
    run(async () => {
      setResult(null);
      setResult(
        await api<Report>("reconciliations/preview", "POST", {
          format: "atlas-balances-v1",
          account_id: account,
          currency,
          as_of: date.toISOString(),
          csv,
          complete_positions: data.get("complete_positions") === "on",
        }),
      );
    });
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `atlas-reconciliation-${result.as_of.slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel" aria-labelledby="reconciliation-heading">
      <h3 id="reconciliation-heading">Rapprocher un relevé</h3>
      <p>
        Comparez les liquidités et quantités du relevé au journal Atlas corrigé,
        rejoué à la date choisie. Aucun cours ni taux de change n’est
        nécessaire. Ce contrôle ne modifie aucune opération.
      </p>
      <form onSubmit={submit} onChange={() => setResult(null)}>
        <fieldset disabled={disabled}>
          <legend>Référence du relevé</legend>
          <label htmlFor="reconciliation-account">Compte du relevé</label>
          <select
            id="reconciliation-account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            required
          >
            <option value="">Choisir un compte</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.currency}
                {a.archived ? " · Archivé" : ""}
              </option>
            ))}
          </select>
          <label htmlFor="reconciliation-currency">Devise du relevé</label>
          <input id="reconciliation-currency" value={currency} readOnly />
          <p>
            Utilisez un relevé exprimé dans la devise de ce compte. Ce contrôle
            ne convertit pas les devises.
          </p>
          <label htmlFor="reconciliation-date">Date et heure du relevé</label>
          <input
            id="reconciliation-date"
            name="as_of"
            type="datetime-local"
            required
          />
          <p>
            Fuseau de saisie : {timezone}. Le rapport rappelle l’instant exact
            comparé.
          </p>
          <p>
            CSV Atlas soldes v1 : <code>kind,asset_id,value</code>. Liquidités :{" "}
            <code>cash,,MONTANT</code> ; position :{" "}
            <code>position,ID_ACTIF,QUANTITÉ</code>. Point décimal, UTF-8, 500
            lignes maximum.
          </p>
          <details>
            <summary>Identifiants de mes actifs pour le relevé</summary>
            <ul className="resource-list">
              {assets.map((a) => (
                <li key={a.id}>
                  {a.name} · {a.symbol} · <code>{a.id}</code>
                </li>
              ))}
            </ul>
          </details>
          <label htmlFor="reconciliation-file">
            Charger un relevé CSV de soldes
          </label>
          <input
            id="reconciliation-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const generation = ++fileGeneration.current;
              setResult(null);
              setCSV("");
              setFileError("");
              if (file.size > 100000) {
                setFileError("Relevé trop volumineux. Maximum : 100 Ko.");
                return;
              }
              void file
                .text()
                .then((text) => {
                  if (generation === fileGeneration.current) {
                    setCSV(text);
                    setResult(null);
                  }
                })
                .catch(() => {
                  if (generation === fileGeneration.current)
                    setFileError(
                      "Impossible de lire ce fichier. Réessayez ou collez son contenu.",
                    );
                });
            }}
          />
          {fileError && <p role="alert">{fileError}</p>}
          <label htmlFor="reconciliation-csv">
            Soldes et positions du relevé
          </label>
          <textarea
            id="reconciliation-csv"
            value={csv}
            onChange={(e) => {
              fileGeneration.current++;
              setCSV(e.target.value);
              setFileError("");
            }}
            rows={6}
            required
          />
          <label className="archive-filter">
            <input name="complete_positions" type="checkbox" /> Le relevé
            contient toutes les positions de ce compte
          </label>
          <p>
            Si cette case est cochée, un actif absent du relevé est comparé à
            une quantité déclarée nulle. Sinon, seuls les éléments fournis sont
            contrôlés. Les liquidités ne sont vérifiées que si une ligne cash
            est présente.
          </p>
          <button
            className="secondary"
            type="submit"
            disabled={!csv || !account || !!fileError}
          >
            Comparer au journal
          </button>
        </fieldset>
      </form>
      {result && (
        <section aria-labelledby="reconciliation-result-heading">
          <h4 id="reconciliation-result-heading">Résultat du rapprochement</h4>
          <p role="status">
            {result.differences
              ? `${result.differences} écart(s) détecté(s).`
              : "Aucun écart sur les éléments contrôlés."}{" "}
            Aucune opération modifiée.
          </p>
          <p>
            Instant du relevé : {new Date(result.as_of).toLocaleString("fr-FR")}{" "}
            · {result.as_of}. Calculé le{" "}
            {new Date(result.calculated_at).toLocaleString("fr-FR")}.
          </p>
          <p>
            {result.complete_positions
              ? "Toutes les positions déclarées contrôlées."
              : "Contrôle partiel : positions omises non contrôlées."}{" "}
            {result.cash_checked
              ? "Liquidités contrôlées."
              : "Liquidités non contrôlées."}
          </p>
          {result.partial_history && (
            <p>
              Le journal contient une ouverture déclarée ou un historique
              partiel. Ce rapprochement ne certifie pas la complétude des
              performances.
            </p>
          )}
          <ul className="resource-list">
            {result.rows.map((row) => (
              <li key={`${row.kind}:${row.asset_id || "cash"}`}>
                <h5>
                  {row.kind === "cash"
                    ? `Liquidités · ${result.currency}`
                    : row.asset_name}{" "}
                  · {row.matches ? "Concordant" : "Écart"}
                </h5>
                {row.origin === "declared_absent" && (
                  <p>Absent du relevé déclaré complet : référence nulle.</p>
                )}
                <p>
                  Relevé : {amount(row.expected)} · Atlas : {amount(row.actual)}
                </p>
                <p>
                  Écart (Atlas − relevé) : {amount(row.delta)}{" "}
                  {row.kind === "cash" ? result.currency : "unité(s)"}
                </p>
                {!row.matches && (
                  <small>
                    Écart exact : {row.delta.exact}. Vérifiez les ouvertures,
                    opérations et dates dans Activité.
                  </small>
                )}
              </li>
            ))}
          </ul>
          <button className="secondary" type="button" onClick={download}>
            Exporter le rapport de rapprochement
          </button>
        </section>
      )}
    </section>
  );
}
