import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { all, api, resourceError } from "./api";
import type { Account, Asset, Portfolio } from "./api";
import { ApiError } from "./auth";
import { MarketStatus } from "./MarketStatus";
import { Reconciliation } from "./Reconciliation";
import { HistoryChart } from "./HistoryChart";
import { PurchasePreview } from "./PurchasePreview";
import { QuoteHistory } from "./QuoteHistory";
import type { HistoryPoint } from "./HistoryChart";

type Value = { exact: string; display: string; approximate: boolean };
type Observation = {
  id: string;
  asset_id?: string;
  currency: string;
  value: string;
  observed_at: string;
  source: string;
  source_type: string;
  value_number?: Value;
};
type Position = {
  account_id: string;
  portfolio_id: string;
  asset_id: string;
  name: string;
  kind: string;
  currency: string;
  quantity: Value;
  cost: Value | null;
  average_cost: Value | null;
  realized: Value | null;
  unrealized: Value | null;
  value_eur: Value | null;
  quote: Observation | null;
  fx_observations: Observation[];
  quality: string;
  market_changes_percent: Record<string, Value | null>;
};
export type Summary = {
  recorded_income_eur: Value | null;
  recorded_fees_eur: Value | null;
  at: string;
  total_value_eur: Value | null;
  known_value_eur: Value;
  result_eur: Value | null;
  external_flows_eur: Value | null;
  partial_history: boolean;
  missing_valuation: boolean;
  positions: Position[];
  consolidated_assets: Position[];
  cash: {
    account_id: string;
    name: string;
    currency: string;
    amount: Value;
    value_eur: Value | null;
    fx_observation: Observation | null;
  }[];
  allocation_eur: Record<string, Value>;
  operation_count: number;
  uses_prior_date_observations: boolean;
  portfolio_values_eur: Record<string, Value | null>;
  account_values_eur: Record<string, Value | null>;
  daily_market_movers: Position[];
};
type Operation = Record<string, string | boolean> & {
  id: string;
  kind: string;
  account_id: string;
  occurred_at: string;
  active: boolean;
};
type Preview = {
  id: string;
  can_confirm: boolean;
  confirmed: boolean;
  validation_error: string;
  rows: {
    line: number;
    external_id: string;
    event: Record<string, string>;
    error?: string;
    duplicate: boolean;
  }[];
};
const kinds: Record<string, string> = {
  deposit: "Dépôt",
  withdrawal: "Retrait",
  buy: "Achat",
  sell: "Vente",
  transfer: "Transfert interne",
  fee: "Frais",
  dividend: "Dividende",
  staking: "Récompense de staking",
  interest: "Intérêts crédités",
  opening_cash: "Solde d’ouverture",
  opening_position: "Position d’ouverture",
};
const fields = [
  "kind",
  "account_id",
  "target_account_id",
  "asset_id",
  "occurred_at",
  "quantity",
  "price",
  "amount",
  "fees",
  "cost",
  "price_source",
  "price_observed_at",
  "fx_to_eur",
  "fx_source",
  "fx_observed_at",
  "exchange_rate",
  "note",
];
function display(v: Value | null | undefined, unit = "") {
  return v
    ? `${v.approximate ? "≈ " : ""}${v.display.replace(".", ",")}${unit ? ` ${unit}` : ""}`
    : "Non calculable";
}
function importIssue(code: string) {
  const messages: Record<string, string> = {
    asset_mapping_required: "Associez le symbole ou l’ISIN du CSV à un actif de votre catalogue.",
    broker_eur_only: "Cette version nécessite des montants en EUR, sans conversion de devise.",
    broker_tax_requires_review: "Retenue fiscale présente : vérification et saisie manuelle requises.",
    broker_rounded_trade_requires_review: "Le total diffère du produit quantité × prix et des frais. Vérifiez l’arrondi avant saisie manuelle.",
    broker_invalid_sign: "Le signe du montant ou de la quantité est incohérent avec cette opération.",
    unsupported_broker_account: "Ce type de compte de l’export n’est pas pris en charge.",
    unsupported_operation:
      "Opération non prise en charge ; les swaps nécessitent une correction manuelle.",
    external_id_conflict:
      "Cet identifiant externe existe déjà avec des données différentes.",
    duplicate_external_id_in_file:
      "Cet identifiant externe est répété dans le fichier.",
    external_id_required: "Identifiant externe manquant ou invalide.",
    resource_not_available:
      "Compte ou actif non disponible pour cet utilisateur.",
    account_archived: "Le compte ou son portefeuille est archivé.",
    asset_archived: "L’actif est archivé.",
    invalid_date: "Date invalide ou future.",
    invalid_decimal: "Nombre décimal invalide.",
    staking_price_required: "Cours daté à réception requis pour le staking.",
    inconsistent_total:
      "Le total ne correspond pas à la quantité, au prix et aux frais.",
  };
  if (code.includes("insufficient_cash"))
    return "Liquidités insuffisantes dans l’historique ; aucun découvert n’est autorisé.";
  if (code.includes("insufficient_quantity"))
    return "Quantité insuffisante dans l’historique ; aucune vente à découvert n’est autorisée.";
  return (
    messages[code] ||
    "Données incohérentes. Vérifiez les champs, les dates et les valeurs d’ouverture."
  );
}
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function fromISO(raw: unknown) {
  return typeof raw === "string" && raw
    ? localDate(new Date(raw))
    : localDate();
}
function stamp(value: FormDataEntryValue | null) {
  return value ? new Date(String(value)).toISOString() : "";
}
function Numeral({ v, unit }: { v: Value | null | undefined; unit?: string }) {
  return (
    <span title={v ? `Valeur exacte : ${v.exact}` : undefined}>
      {display(v, unit)}
    </span>
  );
}

export function Finance({
  view,
  expired,
  onBusy,
}: {
  view: "overview" | "activity" | "imports";
  expired: () => void;
  onBusy: (value: boolean) => void;
}) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]),
    [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null),
    [operations, setOperations] = useState<Operation[]>([]),
    [prices, setPrices] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [kind, setKind] = useState("deposit"),
    [byTotal, setByTotal] = useState(true),
    [transferAsset, setTransferAsset] = useState(false),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [editing, setEditing] = useState(""),
    [voiding, setVoiding] = useState(false),
    [generation, setGeneration] = useState(0);
  const [importReport, setImportReport] = useState("");
  const [marketRevision, setMarketRevision] = useState(0);
  const [importFormat, setImportFormat] = useState("atlas-csv-v1");
  const [importAccount, setImportAccount] = useState("");
  const [brokerSymbols, setBrokerSymbols] = useState<Record<string,string>>({});
  const [preview, setPreview] = useState<Preview | null>(null),
    [csv, setCSV] = useState(""),
    [filter, setFilter] = useState(""),
    [showAll, setShowAll] = useState(false);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const retry = useRef<{ body: string; key: string } | null>(null);
  const section = useRef<HTMLHeadingElement>(null);
  const defaultDate = useRef(localDate());
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  function report(err: unknown) {
    setError(resourceError(err));
    if (err instanceof ApiError && err.status === 401) expired();
  }
  async function load() {
    const [p, a, s, o, q] = await Promise.all([
      all<Portfolio>("portfolios"),
      all<Asset>("assets"),
      api<Summary>("summary"),
      api<{ items: Operation[] }>("operations"),
      api<{ items: Observation[] }>("prices"),
    ]);
    const groups = await Promise.all(
      p.map((item) => all<Account>(`portfolios/${item.id}/accounts`)),
    );
    setPortfolios(p);
    setAssets(a);
    setAccounts(groups.flat());
    setSummary(s);
    setOperations(o.items);
    setPrices(q.items);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .catch((err) => {
        if (active) report(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    section.current?.focus();
  }, [view]);
  async function act(
    fn: () => Promise<void>,
    saved = "Enregistrement confirmé.",
  ) {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    setError("");
    setNotice("");
    let committed = false;
    try {
      await fn();
      committed = true;
      setNotice(saved);
      await load();
    } catch (err) {
      if (committed)
        setNotice(
          `${saved} L’actualisation a échoué ; rechargez la page avant une nouvelle saisie.`,
        );
      report(err);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  function key(payload: unknown) {
    const body = JSON.stringify(payload);
    if (!retry.current || retry.current.body !== body)
      retry.current = { body, key: crypto.randomUUID() };
    return retry.current.key;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const e: Record<string, string> = { kind };
    for (const field of fields) {
      if (field === "kind") continue;
      const raw = data.get(field);
      if (raw !== null && String(raw).trim() !== "")
        e[field] = field.endsWith("_at") ? stamp(raw) : String(raw).trim();
    }
    for (const field of [
      "quantity",
      "price",
      "amount",
      "fees",
      "cost",
      "fx_to_eur",
      "exchange_rate",
    ])
      if (e[field]) e[field] = e[field].replace(",", ".");
    const payload = editing
      ? voiding
        ? { void: true, reason: String(data.get("reason")) }
        : { replacement: e, reason: String(data.get("reason")) }
      : e;
    await act(async () => {
      await api(
        editing ? `operations/${editing}/corrections` : "operations",
        "POST",
        payload,
        key(payload),
      );
      retry.current = null;
      setDraft({});
      setEditing("");
      setVoiding(false);
      setKind("deposit");
      setGeneration((v) => v + 1);
    });
  }
  function choose(operation: Operation, correct: boolean) {
    const next: Record<string, string> = {};
    for (const field of fields)
      if (typeof operation[field] === "string")
        next[field] = String(operation[field]);
    setDraft(next);
    setKind(next.kind);
    setByTotal(!!next.amount && !next.quantity);
    setTransferAsset(!!next.asset_id && next.kind === "transfer");
    setEditing(correct ? operation.id : "");
    setVoiding(false);
    setGeneration((v) => v + 1);
    retry.current = null;
    setNotice(
      correct
        ? "Correction : l’original sera conservé dans l’audit."
        : "Copie préparée. Vérifiez-la avant de l’enregistrer.",
    );
    document.getElementById("operation-kind")?.focus();
  }
  const activeAccounts = accounts.filter(
    (a) =>
      !a.archived && !portfolios.find((p) => p.id === a.portfolio_id)?.archived,
  );
  const assetRequired =
    ["buy", "sell", "staking", "opening_position"].includes(kind) ||
    (kind === "transfer" && transferAsset);
  const amountRequired =
    [
      "deposit",
      "withdrawal",
      "fee",
      "dividend",
      "interest",
      "opening_cash",
    ].includes(kind) ||
    (kind === "transfer" && !transferAsset) ||
    (kind === "buy" && byTotal);
  const quantityRequired = assetRequired && !(kind === "buy" && byTotal);
  function numberInput(name: string, label: string, required = false) {
    return (
      <>
        <label htmlFor={`op-${name}`}>{label}</label>
        <input
          id={`op-${name}`}
          name={name}
          inputMode="decimal"
          required={required}
          pattern={
            name === "quantity"
              ? "([0-9]+([.,][0-9]{1,18})?|[0-9]+/[1-9][0-9]*)"
              : "[0-9]+([.,][0-9]{1,18})?"
          }
          maxLength={name === "quantity" ? 8192 : 56}
          defaultValue={draft[name] || ""}
        />
      </>
    );
  }
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || id;
  if (loading) return <p role="status">Chargement de l’espace financier…</p>;
  return (
    <section className="financial-space" aria-busy={busy}>
      <h2 ref={section} tabIndex={-1}>
        {view === "overview"
          ? "Vue d’ensemble"
          : view === "activity"
            ? "Activité et saisie"
            : "Import CSV"}
      </h2>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="message" role="status">
          {notice}
        </p>
      )}
      {view === "overview" && summary && (
        <>
          {summary.uses_prior_date_observations && (
            <p className="message">
              Certaines valeurs utilisent des observations d’une date
              antérieure. Consultez leur provenance ; elles ne sont pas
              présentées comme des cours actuels.
            </p>
          )}
          {!summary.operation_count && (
            <p className="empty">
              Commencez par créer un portefeuille et un compte, puis saisissez
              un dépôt ou une ouverture explicite dans Activité.
            </p>
          )}
          <div className="financial-hero">
            <p>
              Valeur totale en EUR ·{" "}
              {new Date(summary.at).toLocaleString("fr-FR")}
            </p>
            <strong>
              <Numeral v={summary.total_value_eur} unit="€" />
            </strong>
            {summary.missing_valuation && (
              <p>
                Valorisation partielle :{" "}
                <Numeral v={summary.known_value_eur} unit="€" /> connus.
                Certains cours ou taux manquent.
              </p>
            )}
            <p>
              Résultat depuis le début, apports externes déduits :{" "}
              <Numeral v={summary.result_eur} unit="€" />
            </p>
            {summary.partial_history && (
              <p>
                Historique d’ouverture incomplet : la performance globale est
                masquée.
              </p>
            )}
          </div>
          <details className="panel">
            <summary>Comprendre les apports, revenus et frais</summary>
            <p>
              Apports externes nets :{" "}
              <Numeral v={summary.external_flows_eur} unit="€" />
            </p>
            <p>
              Revenus enregistrés (dividendes, intérêts, staking) :{" "}
              <Numeral v={summary.recorded_income_eur} unit="€" />
            </p>
            <p>
              Frais enregistrés :{" "}
              <Numeral v={summary.recorded_fees_eur} unit="€" />. Ils sont déjà
              pris en compte dans les coûts et liquidités : ne les déduisez pas
              une seconde fois.
            </p>
            <p>
              Le PRU est le coût moyen économique, frais inclus, pas un calcul
              fiscal. Le latent concerne les quantités encore détenues ; le
              réalisé concerne les ventes enregistrées.
            </p>
          </details>
          <div className="workspace-grid">
            <section className="panel">
              <h3>Liquidités et épargne</h3>
              <ul className="resource-list">
                {summary.cash.map((a) => (
                  <li key={a.account_id}>
                    <strong>{a.name}</strong>
                    <p>
                      Compte, actifs compris :{" "}
                      <Numeral
                        v={summary.account_values_eur[a.account_id]}
                        unit="€"
                      />
                    </p>
                    <p>
                      Liquidités : <Numeral v={a.amount} unit={a.currency} />
                    </p>
                    <small>
                      Valeur en EUR : <Numeral v={a.value_eur} unit="€" />
                    </small>
                    {a.fx_observation && (
                      <p>
                        Taux : 1 {a.currency} ={" "}
                        <Numeral v={a.fx_observation.value_number} unit="EUR" />{" "}
                        · {a.fx_observation.source} · reçu le{" "}
                        {new Date(a.fx_observation.observed_at).toLocaleString(
                          "fr-FR",
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h3>Répartition de la valeur connue</h3>
              {Object.entries(summary.allocation_eur).map(
                ([category, value]) => (
                  <p key={category}>
                    {
                      (
                        {
                          stock: "Actions",
                          etf: "ETF",
                          crypto: "Crypto",
                          stablecoin: "Stablecoins",
                          savings: "Épargne",
                          cash: "Liquidités",
                        } as Record<string, string>
                      )[category]
                    }{" "}
                    : <Numeral v={value} unit="€" />
                  </p>
                ),
              )}
              <h4>Portefeuilles consolidés</h4>
              {portfolios.map((p) => (
                <p key={p.id}>
                  {p.name} :{" "}
                  <Numeral v={summary.portfolio_values_eur[p.id]} unit="€" />
                </p>
              ))}
              <p>
                Les valeurs manquantes sont exclues de cette répartition, jamais
                remplacées par zéro.
              </p>
            </section>
          </div>
          <section className="panel">
            <h3>{showAll ? "Mes actifs" : "Mes 10 actifs principaux"}</h3>
            <ul className="resource-list">
              {summary.consolidated_assets.slice(0, showAll ? undefined : 10).map((p) => (
                <li key={`${p.account_id}-${p.asset_id}`}>
                  <h4>
                    {p.name}
                    {p.account_id ? ` · ${accountName(p.account_id)}` : ""}
                  </h4>
                  <p>
                    Quantité : <Numeral v={p.quantity} /> · Valeur :{" "}
                    <Numeral v={p.value_eur} unit="€" />
                  </p>
                  <p>
                    PRU économique :{" "}
                    <Numeral v={p.average_cost} unit={p.currency} /> · Coût
                    restant : <Numeral v={p.cost} unit={p.currency} />
                  </p>
                  <p>
                    Résultat latent :{" "}
                    <Numeral v={p.unrealized} unit={p.currency} /> · Réalisé :{" "}
                    <Numeral v={p.realized} unit={p.currency} />
                  </p>
                  <p>
                    Variation du cours sur un jour :{" "}
                    <Numeral v={p.market_changes_percent.day} unit="%" /> —
                    distincte de votre rendement personnel.
                  </p>
                  <details>
                    <summary>Source du cours et autres périodes</summary>
                    {p.quote ? (
                      <p>
                        Saisie manuelle · {p.quote.source} ·{" "}
                        {new Date(p.quote.observed_at).toLocaleString("fr-FR")}{" "}
                        · {p.quote.value} {p.quote.currency}. Ce cours n’est pas
                        présenté comme temps réel.
                      </p>
                    ) : (
                      <p>Cours manquant.</p>
                    )}
                    {p.fx_observations.map((fx, index) => (
                      <p key={`${fx.id}-${index}`}>
                        Conversion : {fx.source} · reçu le{" "}
                        {new Date(fx.observed_at).toLocaleString("fr-FR")}
                      </p>
                    ))}
                    <p>
                      Semaine :{" "}
                      <Numeral v={p.market_changes_percent.week} unit="%" /> ·
                      Mois :{" "}
                      <Numeral v={p.market_changes_percent.month} unit="%" /> ·
                      Année :{" "}
                      <Numeral v={p.market_changes_percent.year} unit="%" />
                    </p>
                  </details>
                  <QuoteHistory key={p.asset_id} assetId={p.asset_id} observations={prices} />
                </li>
              ))}
            </ul>
            <button className="secondary" onClick={() => setShowAll(!showAll)}>
              {showAll
                ? "Afficher les 10 premières"
                : "Voir toutes les positions"}
            </button>
          </section>
          <section className="panel">
            <h3>Variations des cours sur un jour</h3>
            <p>
              Classement distinct du rendement personnel. Seulement lorsque les
              deux dates sont couvertes.
            </p>
            {summary.daily_market_movers.length === 0 ? (
              <p>Historique de cours insuffisant pour ce classement.</p>
            ) : (
              <div className="workspace-grid">
                <div>
                  <h4>Plus fortes variations</h4>
                  {summary.daily_market_movers.slice(0, 3).map((p) => (
                    <p key={`${p.account_id}-${p.asset_id}`}>
                      {p.name} :{" "}
                      <Numeral v={p.market_changes_percent.day} unit="%" />
                    </p>
                  ))}
                </div>
                <div>
                  <h4>Plus faibles variations</h4>
                  {summary.daily_market_movers
                    .slice(-3)
                    .reverse()
                    .map((p) => (
                      <p key={`${p.account_id}-${p.asset_id}`}>
                        {p.name} :{" "}
                        <Numeral v={p.market_changes_percent.day} unit="%" />
                      </p>
                    ))}
                </div>
              </div>
            )}
          </section>
          <section className="panel">
            <h3>Historique daté</h3>
            <p>
              Choisissez explicitement une période d’au plus un an. Les valeurs
              absentes restent absentes ; aucun historique n’est interpolé.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void act(async () => {
                  const result = await api<{ items: typeof points }>(
                    `history?from=${encodeURIComponent(stamp(d.get("from")))}&to=${encodeURIComponent(stamp(d.get("to")))}`,
                  );
                  setPoints(result.items);
                }, "Historique chargé.");
              }}
            >
              <fieldset disabled={busy}>
                <label htmlFor="history-from">Début</label>
                <input
                  id="history-from"
                  type="datetime-local"
                  name="from"
                  required
                />
                <label htmlFor="history-to">Fin</label>
                <input
                  id="history-to"
                  type="datetime-local"
                  name="to"
                  required
                />
                <button className="secondary">Charger l’historique</button>
              </fieldset>
            </form>
            {points.length > 0 && <HistoryChart points={points} />}
            <div
              className="history-points"
              role="list"
              aria-label="Valorisations quotidiennes"
            >
              {points.map((p) => (
                <div role="listitem" key={p.at}>
                  <time dateTime={p.at}>
                    {new Date(p.at).toLocaleDateString("fr-FR", {
                      timeZone: "UTC",
                    })}
                  </time>
                  <span>
                    <Numeral v={p.value_eur} unit="€" />
                    {p.missing
                      ? " · Données manquantes"
                      : p.uses_prior_date_observations
                        ? " · Dernière observation d’une date antérieure"
                        : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      {view === "activity" && (
        <>
          <div className="workspace-grid">
            <section className="panel">
              <h3>
                {editing
                  ? "Corriger une opération"
                  : "Enregistrer une opération"}
              </h3>
              {!activeAccounts.length ? (
                <p>Créez d’abord un compte actif dans Portefeuilles.</p>
              ) : (
                <form key={generation} onSubmit={(e) => void submit(e)}>
                  {editing && (
                    <>
                      <label htmlFor="correction-reason">
                        Motif de correction
                      </label>
                      <input
                        id="correction-reason"
                        name="reason"
                        required
                        maxLength={500}
                      />
                      <label className="archive-filter">
                        <input
                          type="checkbox"
                          checked={voiding}
                          onChange={(e) => setVoiding(e.target.checked)}
                        />
                        Annuler sans remplacement
                      </label>
                    </>
                  )}
                  <fieldset disabled={busy || voiding}>
                    <label htmlFor="operation-kind">Type d’opération</label>
                    <select
                      id="operation-kind"
                      value={kind}
                      onChange={(e) => {
                        setKind(e.target.value);
                        setDraft({});
                        setGeneration((v) => v + 1);
                      }}
                    >
                      {Object.entries(kinds).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="operation-account">Compte</label>
                    <select
                      id="operation-account"
                      name="account_id"
                      required
                      defaultValue={draft.account_id || ""}
                    >
                      <option value="">Choisir un compte</option>
                      {activeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.currency}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="operation-date">
                      Date et heure (fuseau du navigateur)
                    </label>
                    <input
                      id="operation-date"
                      name="occurred_at"
                      type="datetime-local"
                      required
                      defaultValue={
                        draft.occurred_at
                          ? fromISO(draft.occurred_at)
                          : defaultDate.current
                      }
                    />
                    {kind === "buy" && (
                      <label className="archive-filter">
                        <input
                          type="checkbox"
                          checked={byTotal}
                          onChange={(e) => setByTotal(e.target.checked)}
                        />
                        Saisir le montant total, frais inclus
                      </label>
                    )}
                    {kind === "transfer" && (
                      <>
                        <label htmlFor="transfer-target">
                          Compte destinataire
                        </label>
                        <select
                          id="transfer-target"
                          name="target_account_id"
                          required
                          defaultValue={draft.target_account_id || ""}
                        >
                          <option value="">Choisir un compte</option>
                          {activeAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} · {a.currency}
                            </option>
                          ))}
                        </select>
                        <label className="archive-filter">
                          <input
                            type="checkbox"
                            checked={transferAsset}
                            onChange={(e) => setTransferAsset(e.target.checked)}
                          />
                          Transférer un actif plutôt que des liquidités
                        </label>
                      </>
                    )}
                    {assetRequired && (
                      <>
                        <label htmlFor="operation-asset">Actif</label>
                        <select
                          id="operation-asset"
                          name="asset_id"
                          required
                          defaultValue={draft.asset_id || ""}
                        >
                          <option value="">Choisir un actif</option>
                          {assets
                            .filter((a) => !a.archived)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} · {a.symbol}
                              </option>
                            ))}
                        </select>
                      </>
                    )}
                    {quantityRequired &&
                      numberInput("quantity", "Quantité", true)}
                    {["buy", "sell", "staking"].includes(kind) &&
                      numberInput(
                        "price",
                        "Prix unitaire dans la devise du compte",
                        true,
                      )}
                    {amountRequired &&
                      numberInput(
                        "amount",
                        kind === "buy"
                          ? "Montant total, frais inclus"
                          : "Montant dans la devise du compte",
                        true,
                      )}
                    {(["buy", "sell"].includes(kind) ||
                      (kind === "transfer" && !transferAsset)) &&
                      numberInput("fees", "Frais (facultatifs)")}
                    {kind === "opening_position" && (
                      <>
                        {numberInput(
                          "cost",
                          "Coût d’acquisition total connu (facultatif)",
                        )}
                        <p>
                          Sans coût déclaré, le PRU et le résultat sont masqués.
                          Aucun coût nul n’est inventé.
                        </p>
                      </>
                    )}
                    {kind === "staking" && (
                      <>
                        <label htmlFor="staking-source">
                          Source du cours à réception
                        </label>
                        <input
                          id="staking-source"
                          name="price_source"
                          required
                          maxLength={120}
                          defaultValue={draft.price_source || ""}
                        />
                        <label htmlFor="staking-date">
                          Date du cours à réception
                        </label>
                        <input
                          id="staking-date"
                          name="price_observed_at"
                          type="datetime-local"
                          required
                          defaultValue={
                            draft.price_observed_at || draft.occurred_at
                              ? fromISO(
                                  draft.price_observed_at || draft.occurred_at,
                                )
                              : defaultDate.current
                          }
                        />
                      </>
                    )}
                    <details>
                      <summary>Taux de change observés (si nécessaire)</summary>
                      {numberInput(
                        "fx_to_eur",
                        "Taux de la devise du compte vers EUR, daté du jour de l’opération",
                      )}
                      {kind === "transfer" &&
                        numberInput(
                          "exchange_rate",
                          "Taux vers la devise du compte destinataire (obligatoire si différente)",
                        )}
                      <label htmlFor="fx-source">Source du taux</label>
                      <input
                        id="fx-source"
                        name="fx_source"
                        maxLength={120}
                        defaultValue={draft.fx_source || ""}
                      />
                      <label htmlFor="fx-date">
                        Date d’observation du taux
                      </label>
                      <input
                        id="fx-date"
                        name="fx_observed_at"
                        type="datetime-local"
                        defaultValue={
                          draft.fx_observed_at
                            ? fromISO(draft.fx_observed_at)
                            : ""
                        }
                      />
                    </details>
                    <label htmlFor="operation-note">Note (facultative)</label>
                    <input
                      id="operation-note"
                      name="note"
                      maxLength={1000}
                      defaultValue={draft.note || ""}
                    />
                  </fieldset>
                  <p className="help">
                    Les ouvertures sont explicites. Aucun découvert, aucune
                    vente à découvert ni aucun swap automatique.
                  </p>
                  {kind === "buy" && !voiding && (
                    <PurchasePreview byTotal={byTotal} accounts={activeAccounts} assets={assets} />
                  )}
                  <button className="primary full" disabled={busy}>
                    {editing
                      ? voiding
                        ? "Confirmer l’annulation"
                        : "Enregistrer la correction"
                      : "Enregistrer l’opération"}
                  </button>
                  {editing && (
                    <button
                      className="text-button full"
                      type="button"
                      onClick={() => {
                        setEditing("");
                        setDraft({});
                        setVoiding(false);
                        setKind("deposit");
                        setGeneration((v) => v + 1);
                      }}
                    >
                      Abandonner la correction
                    </button>
                  )}
                </form>
              )}
            </section>
            <section className="panel">
              <h3>Cours et taux datés</h3>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    try { await api("market/fx/refresh", "POST", {}); } finally { setMarketRevision(value=>value+1); }
                  }, "Taux de référence BCE reçus. Les taux de transaction restent distincts.")
                }
              >
                Actualiser les taux gratuits de la BCE
              </button>
              <p>
                Source :{" "}
                <a
                  href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Banque centrale européenne
                </a>
                . Taux de référence, pas des taux d’exécution. Les cours
                d’actifs restent manuels tant qu’aucune couverture pilote n’est
                validée.
              </p>
              <MarketStatus revision={marketRevision} disabled={busy} expired={expired} />
              <h4>Saisie manuelle</h4>
              <p>
                Un taux sans actif représente une unité de la devise saisie en
                EUR. Aucune cotation n’est inventée.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const d = new FormData(form);
                  void act(async () => {
                    await api("prices", "POST", {
                      asset_id: String(d.get("asset_id")),
                      currency: String(d.get("currency")).toUpperCase(),
                      value: String(d.get("value")).replace(",", "."),
                      observed_at: stamp(d.get("observed_at")),
                      source: String(d.get("source")),
                    });
                    form.reset();
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <label htmlFor="quote-asset">Actif ou taux de change</label>
                  <select id="quote-asset" name="asset_id">
                    <option value="">Taux vers EUR</option>
                    {assets
                      .filter((a) => !a.archived)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                  <label htmlFor="quote-currency">
                    Devise du cours / devise source du taux
                  </label>
                  <input
                    id="quote-currency"
                    name="currency"
                    required
                    pattern="[A-Za-z]{3}"
                    maxLength={3}
                    defaultValue="EUR"
                  />
                  <label htmlFor="quote-value">Cours / taux positif</label>
                  <input
                    id="quote-value"
                    name="value"
                    inputMode="decimal"
                    required
                    pattern="[0-9]+([.,][0-9]{1,18})?"
                  />
                  <label htmlFor="quote-date">Date d’observation</label>
                  <input
                    id="quote-date"
                    name="observed_at"
                    type="datetime-local"
                    required
                    defaultValue={localDate()}
                  />
                  <label htmlFor="quote-source">
                    Source de la valeur saisie
                  </label>
                  <input
                    id="quote-source"
                    name="source"
                    required
                    maxLength={120}
                  />
                  <button className="primary full">
                    Enregistrer le cours ou taux
                  </button>
                </fieldset>
              </form>
              <p>
                {prices.length} observation(s) conservée(s), datées et
                identifiées comme saisies manuelles.
              </p>
            </section>
          </div>
          <section className="panel">
            <h3>Journal et audit</h3>
            <label htmlFor="operation-filter">Filtrer par compte</label>
            <select
              id="operation-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Tous mes comptes</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <ul className="resource-list">
              {operations
                .filter((o) => !filter || o.account_id === filter)
                .slice()
                .reverse()
                .map((o) => (
                  <li key={o.id}>
                    <h4>
                      {kinds[o.kind] || o.kind} · {accountName(o.account_id)}
                      {!o.active ? " · Remplacée ou annulée" : ""}
                    </h4>
                    <p>
                      {new Date(o.occurred_at).toLocaleString("fr-FR")} ·{" "}
                      {o.amount ? `Montant : ${o.amount}` : ""}
                      {o.quantity ? ` Quantité : ${o.quantity}` : ""}
                      {o.price ? ` Prix : ${o.price}` : ""}
                    </p>
                    {o.reason && <p>Motif : {String(o.reason)}</p>}
                    {o.note && <p>{String(o.note)}</p>}
                    <div className="inline-actions">
                      <button
                        className="secondary"
                        onClick={() => choose(o, false)}
                        disabled={busy}
                      >
                        Dupliquer
                      </button>
                      {o.active && (
                        <button
                          className="secondary"
                          onClick={() => choose(o, true)}
                          disabled={busy}
                        >
                          Corriger ou annuler
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
            {!operations.length && <p>Aucune opération enregistrée.</p>}
          </section>
        </>
      )}
      {view === "imports" && (
        <section className="panel">
          <h3>Importer des transactions CSV</h3>
          {importReport && <p role="status">{importReport}</p>}
          <label htmlFor="import-format">Format du fichier</label>
          <select id="import-format" value={importFormat} disabled={busy} onChange={e => {setImportFormat(e.target.value);setPreview(null);setImportReport("");}}>
            <option value="atlas-csv-v1">Atlas CSV v1</option>
            <option value="coinbase-transactions-v1">Coinbase · historique avec ID</option>
            <option value="trade-republic-transactions-v1">Trade Republic · export transactions 23 colonnes</option>
          </select>
          {importFormat === "atlas-csv-v1" ? <p>
            Colonnes external_id, kind, account_id, occurred_at, puis les champs financiers nécessaires.
            Exemple de dépôt : <code>external_id,kind,account_id,occurred_at,amount</code>.
            Identifiants des comptes dans l’export JSON. UTF-8, virgules, 500 lignes par lot.
          </p> : <>
            <p>Transactions en EUR uniquement. Achats, ventes et {importFormat.startsWith("coinbase") ? "récompenses de staking" : "intérêts et dividendes sans retenue fiscale"}.
            Les transferts, conversions, taxes et écarts d’arrondi nécessitent une vérification manuelle ; aucune ligne n’est ignorée.
            Déclarez les liquidités et positions d’ouverture avant l’import si nécessaire.</p>
            <label htmlFor="import-account">Compte destinataire de l’import</label>
            <select id="import-account" value={importAccount} disabled={busy} onChange={e=>{setImportAccount(e.target.value);setPreview(null);}}>
              <option value="">Choisir un compte EUR</option>
              {accounts.filter(a=>!a.archived && a.currency==="EUR").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <p>Associez explicitement chaque symbole Coinbase ou ISIN Trade Republic à votre actif. Laissez vide les actifs absents du fichier.</p>
            {assets.filter(a=>!a.archived).map(a=><div key={a.id}>
              <label htmlFor={`broker-symbol-${a.id}`}>Identifiant dans le CSV pour {a.name}</label>
              <input id={`broker-symbol-${a.id}`} disabled={busy} value={brokerSymbols[a.id] || ""} onChange={e=>{setBrokerSymbols({...brokerSymbols,[a.id]:e.target.value});setPreview(null);}} />
            </div>)}
          </>}
          <label htmlFor="csv-file">Charger un CSV</label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 900000) {
                  setError("Fichier trop volumineux. Fractionnez le lot.");
                  return;
                }
                void file.text().then((text) => {
                  setCSV(text);
                  setPreview(null);
                });
              }
            }}
          />
          <label htmlFor="csv-content">Contenu à prévisualiser</label>
          <textarea
            id="csv-content"
            value={csv}
            onChange={(e) => {
              setCSV(e.target.value);
              setPreview(null);
            }}
            rows={8}
          />
          <button
            className="secondary"
            disabled={busy || !csv || (importFormat !== "atlas-csv-v1" && !importAccount)}
            onClick={() =>
              void act(async () => {
                const mappings: Record<string,string> = {};
                for (const [id, symbol] of Object.entries(brokerSymbols)) {
                  if (!symbol) continue;
                  if (mappings[symbol]) throw Error("Un identifiant CSV est associé à plusieurs actifs.");
                  mappings[symbol] = id;
                }
                setPreview(
                  await api<Preview>("imports/preview", "POST", {
                    format: importFormat,
                    csv,
                    ...(importFormat !== "atlas-csv-v1" ? {account_id:importAccount, assets:mappings} : {}),
                  }),
                );
              }, "Prévisualisation prête. Aucune opération écrite.")
            }
          >
            Prévisualiser
          </button>
          {preview && (
            <>
              <p>
                {preview.confirmed
                  ? "Ce fichier est déjà confirmé."
                  : preview.can_confirm
                    ? "Lot cohérent, prêt à confirmer."
                    : "Le lot comporte des anomalies et ne peut pas être confirmé."}
              </p>
              {preview.validation_error && (
                <p role="alert">
                  Validation : {importIssue(preview.validation_error)}
                </p>
              )}
              <ul className="resource-list">
                {preview.rows.map((row) => (
                  <li key={row.line}>
                    Ligne {row.line} · {row.external_id} ·{" "}
                    {kinds[row.event.kind] || row.event.kind} ·{" "}
                    {row.error
                      ? `Anomalie : ${importIssue(row.error)}`
                      : row.duplicate
                        ? "Déjà importée"
                        : "Nouvelle opération"}
                    <p>{accounts.find(a=>a.id===row.event.account_id)?.name || "Compte inconnu"}
                      {row.event.asset_id ? ` · ${assets.find(a=>a.id===row.event.asset_id)?.name || "Actif inconnu"}` : ""}
                      {` · ${row.event.occurred_at}`}</p>
                    <p>{row.event.quantity ? `Quantité : ${row.event.quantity} · ` : ""}
                      {row.event.price ? `Prix : ${row.event.price} · ` : ""}
                      {row.event.amount ? `Montant : ${row.event.amount} · ` : ""}
                      {`Frais : ${row.event.fees || "0"} (devise du compte)`}</p>
                  </li>
                ))}
              </ul>
              <button
                className="primary"
                disabled={busy || !preview.can_confirm || preview.confirmed}
                onClick={() =>
                  void act(async () => {
                    const report = await api<{
                      accepted: number;
                      duplicates: number;
                    }>(`imports/${preview.id}/confirm`, "POST", {});
                    setPreview({ ...preview, confirmed: true });
                    setImportReport(
                      `${report.accepted} opération(s) acceptée(s), ${report.duplicates || 0} doublon(s).`,
                    );
                  }, "Import confirmé. Aucune ligne rejetée n’a été appliquée.")
                }
              >
                Confirmer tout le lot
              </button>
            </>
          )}
        </section>
      )}
      {view === "imports" && <Reconciliation accounts={accounts} assets={assets} disabled={busy} run={work => void act(work, "Rapprochement calculé. Aucune opération modifiée.")} />}
    </section>
  );
}
