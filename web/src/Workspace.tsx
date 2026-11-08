import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { all, api, resourceError } from "./api";
import type { Account, Asset, Portfolio } from "./api";
import { ApiError } from "./auth";
import { Finance } from "./Finance";
import { PortfolioAllocation } from "./PortfolioAllocation";
import { PortfolioHistory } from "./PortfolioHistory";
import { AccountHoldings } from "./AccountHoldings";
import type { Summary } from "./Finance";
import type { User } from "./auth";

type Props = {
  user: User;
  logout: ReactNode;
  feedback: ReactNode;
  expired: () => void;
};
function NameEditor({
  item,
  save,
  disabled,
}: {
  item: Portfolio;
  save: (value: { name?: string; archived?: boolean }) => void;
  disabled: boolean;
}) {
  return (
    <div className="resource-actions">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({ name: String(new FormData(e.currentTarget).get("name")) });
        }}
      >
        <label className="sr-only" htmlFor={`rename-${item.id}`}>
          Renommer {item.name}
        </label>
        <input
          id={`rename-${item.id}`}
          name="name"
          aria-label={`Renommer ${item.name}`}
          defaultValue={item.name}
          maxLength={120}
          required
          disabled={disabled}
        />
        <button className="secondary" disabled={disabled}>
          Renommer
        </button>
      </form>
      <button
        className="text-button"
        disabled={disabled}
        onClick={() => save({ archived: !item.archived })}
      >
        {item.archived ? "Restaurer" : "Archiver"} {item.name}
      </button>
    </div>
  );
}
export function Workspace({ user, logout, feedback, expired }: Props) {
  const [tab, setTab] = useState<
    "overview" | "portfolios" | "assets" | "activity" | "imports"
  >("overview");
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [archived, setArchived] = useState(false);
  const [catalogSummary, setCatalogSummary] = useState<Summary | null>(null);
  const [kind, setKind] = useState("brokerage");
  const [assetKind, setAssetKind] = useState("stock");
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, []);
  function report(err: unknown) {
    setError(resourceError(err));
    if (err instanceof ApiError && err.status === 401) expired();
  }
  useEffect(() => {
    let active = true;
    Promise.all([all<Portfolio>("portfolios"), all<Asset>("assets")])
      .then(([p, a]) => {
        if (active) {
          setPortfolios(p);
          setAssets(a);
        }
      })
      .catch((err) => {
        if (active) report(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Component is remounted when the authenticated owner changes.
  }, []);
  useEffect(() => {
    let active = true;
    setAccounts([]);
    if (!selected) return;
    setLoading(true);
    setError("");
    all<Account>(`portfolios/${selected}/accounts`)
      .then((items) => {
        if (active) setAccounts(items);
      })
      .catch((err) => {
        if (active) report(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice("Modification enregistrée.");
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  }
  function form(
    event: FormEvent<HTMLFormElement>,
    fn: (data: FormData) => Promise<void>,
  ) {
    event.preventDefault();
    const target = event.currentTarget;
    const data = new FormData(target);
    void action(async () => {
      await fn(data);
      target.reset();
      setKind("brokerage");
      setAssetKind("stock");
    });
  }
  function value(data: FormData, key: string) {
    return String(data.get(key) || "").trim();
  }
  useEffect(() => {
    if (tab !== "portfolios" && tab !== "assets") return;
    let active = true;
    setCatalogSummary(null);
    api<Summary>("summary")
      .then((data) => {
        if (active) setCatalogSummary(data);
      })
      .catch((err) => {
        if (active) report(err);
      });
    return () => {
      active = false;
    };
  }, [tab, portfolios, assets, accounts]);
  function money(
    v:
      | { display: string; exact: string; approximate: boolean }
      | null
      | undefined,
  ) {
    return v
      ? `${v.approximate ? "≈ " : ""}${v.display.replace(".", ",")} €`
      : "Non calculable";
  }
  const current = portfolios.find((p) => p.id === selected);
  const equity = assetKind === "stock" || assetKind === "etf";
  return (
    <main className="workspace">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">VOTRE OBSERVATOIRE</p>
          <h1 ref={title} tabIndex={-1}>
            Bienvenue dans Atlas
          </h1>
          <p>
            Connecté en tant que <strong className="email">{user.email}</strong>
          </p>
        </div>
        <div className="session-actions">
          <fieldset disabled={busy}>{logout}</fieldset>
        </div>
      </div>
      <nav className="workspace-nav" aria-label="Espace personnel">
        <button
          disabled={busy}
          className={tab === "overview" ? "primary" : "secondary"}
          aria-current={tab === "overview" ? "page" : undefined}
          onClick={() => setTab("overview")}
        >
          Accueil
        </button>
        <button
          disabled={busy}
          className={tab === "portfolios" ? "primary" : "secondary"}
          aria-current={tab === "portfolios" ? "page" : undefined}
          onClick={() => setTab("portfolios")}
        >
          Portefeuilles
        </button>
        <button
          disabled={busy}
          className={tab === "assets" ? "primary" : "secondary"}
          aria-current={tab === "assets" ? "page" : undefined}
          onClick={() => setTab("assets")}
        >
          Actifs
        </button>
        <button
          disabled={busy}
          className={tab === "activity" ? "primary" : "secondary"}
          aria-current={tab === "activity" ? "page" : undefined}
          onClick={() => setTab("activity")}
        >
          Activité
        </button>
        <button
          disabled={busy}
          className={tab === "imports" ? "primary" : "secondary"}
          aria-current={tab === "imports" ? "page" : undefined}
          onClick={() => setTab("imports")}
        >
          Imports
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const data = await api<unknown>("financial-export");
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "atlas-portfolio.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
          }
        >
          Exporter mes données
        </button>
      </nav>
      {feedback}
      {error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="message">
          {notice}
        </p>
      )}
      <p className="data-quality">
        Les calculs utilisent vos opérations explicites. Les cours et taux
        manquants sont signalés ; les observations manuelles restent datées et
        identifiées.
      </p>
      <label className="archive-filter">
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        Afficher les archives
      </label>
      {loading && <p role="status">Chargement des données…</p>}
      {tab === "overview" || tab === "activity" || tab === "imports" ? (
        <Finance key={tab} view={tab} expired={expired} onBusy={setBusy} />
      ) : tab === "portfolios" ? (
        <div className="workspace-grid">
          <section className="panel" aria-labelledby="portfolios-title">
            <h2 id="portfolios-title">Mes portefeuilles</h2>
            <form
              onSubmit={(e) =>
                form(e, async (d) => {
                  const p = await api<Portfolio>("portfolios", "POST", {
                    name: value(d, "name"),
                  });
                  setPortfolios((old) => [...old, p]);
                  setSelected(p.id);
                })
              }
            >
              <fieldset disabled={busy}>
                <label htmlFor="portfolio-name">Nom du portefeuille</label>
                <input
                  id="portfolio-name"
                  name="name"
                  required
                  maxLength={120}
                />
                <button className="primary full">Créer le portefeuille</button>
              </fieldset>
            </form>
            {!loading && !portfolios.length && (
              <p>
                Aucun portefeuille. Créez votre premier regroupement de comptes.
              </p>
            )}
            <ul className="resource-list">
              {portfolios
                .filter((p) => archived || !p.archived)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      className="resource-select"
                      aria-pressed={selected === p.id}
                      onClick={() => setSelected(p.id)}
                    >
                      {p.name}
                      {p.archived ? " · Archivé" : ""}
                    </button>
                    <p>
                      Valeur consolidée :{" "}
                      {money(catalogSummary?.portfolio_values_eur[p.id])}
                    </p>
                    <NameEditor
                      item={p}
                      disabled={busy}
                      save={(changes) =>
                        void action(async () => {
                          const next = await api<Portfolio>(
                            `portfolios/${p.id}`,
                            "PATCH",
                            changes,
                          );
                          setPortfolios((old) =>
                            old.map((item) => (item.id === p.id ? next : item)),
                          );
                        })
                      }
                    />
                  </li>
                ))}
            </ul>
          </section>
          <section className="panel" aria-labelledby="accounts-title">
            <h2 id="accounts-title">
              {current ? `Comptes · ${current.name}` : "Mes comptes"}
            </h2>
            {!current ? (
              <p>Sélectionnez un portefeuille pour gérer ses comptes.</p>
            ) : (
              <>
                {catalogSummary && <PortfolioAllocation portfolioId={current.id} summary={catalogSummary} />}
                <PortfolioHistory key={current.id} portfolioId={current.id} expired={expired} />
                {current.archived ? (
                  <p>
                    Ce portefeuille est archivé. Restaurez-le pour ajouter un
                    compte.
                  </p>
                ) : (
                  <form
                    onSubmit={(e) =>
                      form(e, async (d) => {
                        const a = await api<Account>(
                          `portfolios/${selected}/accounts`,
                          "POST",
                          {
                            name: value(d, "name"),
                            kind,
                            currency: value(d, "currency").toUpperCase(),
                            provider: value(d, "provider"),
                            savings_product:
                              kind === "savings"
                                ? value(d, "savings_product")
                                : "",
                          },
                        );
                        setAccounts((old) => [...old, a]);
                      })
                    }
                  >
                    <fieldset disabled={busy}>
                      <label htmlFor="account-name">Nom du compte</label>
                      <input
                        id="account-name"
                        name="name"
                        required
                        maxLength={120}
                      />
                      <label htmlFor="account-kind">Type de compte</label>
                      <select
                        id="account-kind"
                        value={kind}
                        onChange={(e) => setKind(e.target.value)}
                      >
                        <option value="brokerage">Bourse</option>
                        <option value="crypto">Crypto</option>
                        <option value="savings">Épargne</option>
                      </select>
                      {kind === "savings" && (
                        <>
                          <label htmlFor="savings-product">
                            Produit d’épargne
                          </label>
                          <select id="savings-product" name="savings_product">
                            <option value="livret_a">Livret A</option>
                            <option value="pel">PEL</option>
                            <option value="other">Autre épargne</option>
                          </select>
                        </>
                      )}
                      <label htmlFor="account-currency">Devise du compte</label>
                      <input
                        id="account-currency"
                        name="currency"
                        required
                        pattern="[A-Za-z]{3}"
                        maxLength={3}
                        defaultValue="EUR"
                      />
                      <label htmlFor="account-provider">
                        Établissement (facultatif)
                      </label>
                      <input
                        id="account-provider"
                        name="provider"
                        maxLength={120}
                      />
                      <button className="primary full">
                        Ajouter le compte
                      </button>
                    </fieldset>
                  </form>
                )}
                {!loading && !accounts.length && (
                  <p>Aucun compte dans ce portefeuille.</p>
                )}
                <ul className="resource-list">
                  {accounts
                    .filter((a) => archived || !a.archived)
                    .map((a) => (
                      <li key={a.id}>
                        <h3>
                          {a.name}
                          {a.archived ? " · Archivé" : ""}
                        </h3>
                        <p>
                          Valeur du compte, liquidités et actifs :{" "}
                          {money(catalogSummary?.account_values_eur[a.id])}
                        </p>
                        {catalogSummary && (
                          <details>
                            <summary>
                              Positions et résultats de ce compte
                            </summary>
                            <AccountHoldings account={a} assets={assets} summary={catalogSummary} />
                          </details>
                        )}
                        <p>
                          {a.kind === "savings"
                            ? "Épargne"
                            : a.kind === "crypto"
                              ? "Crypto"
                              : "Bourse"}{" "}
                          · {a.currency}
                          {a.provider ? ` · ${a.provider}` : ""}
                        </p>
                        <NameEditor
                          item={a}
                          disabled={busy}
                          save={(changes) =>
                            void action(async () => {
                              const next = await api<Account>(
                                `portfolios/${a.portfolio_id}/accounts/${a.id}`,
                                "PATCH",
                                changes,
                              );
                              setAccounts((old) =>
                                old.map((item) =>
                                  item.id === a.id ? next : item,
                                ),
                              );
                            })
                          }
                        />
                      </li>
                    ))}
                </ul>
              </>
            )}
          </section>
        </div>
      ) : (
        <section className="panel" aria-labelledby="assets-title">
          <h2 id="assets-title">Mon référentiel d’actifs</h2>
          <p>
            Les identifiants sont saisis manuellement. Aucun fournisseur de
            cours ni aucune détention ne sont déduits du ticker.
          </p>
          <form
            className="asset-form"
            onSubmit={(e) =>
              form(e, async (d) => {
                const a = await api<Asset>("assets", "POST", {
                  name: value(d, "name"),
                  kind: assetKind,
                  symbol: value(d, "symbol"),
                  namespace: equity
                    ? value(d, "namespace").toUpperCase()
                    : value(d, "namespace"),
                  reference: equity
                    ? value(d, "reference").toUpperCase()
                    : value(d, "reference"),
                  currency: value(d, "currency").toUpperCase(),
                });
                setAssets((old) => [...old, a]);
              })
            }
          >
            <fieldset disabled={busy}>
              <label htmlFor="asset-name">Nom de l’actif</label>
              <input id="asset-name" name="name" required maxLength={120} />
              <label htmlFor="asset-kind">Classe d’actif</label>
              <select
                id="asset-kind"
                value={assetKind}
                onChange={(e) => setAssetKind(e.target.value)}
              >
                <option value="stock">Action</option>
                <option value="etf">ETF</option>
                <option value="crypto">Crypto</option>
                <option value="stablecoin">Stablecoin</option>
              </select>
              <label htmlFor="asset-symbol">Symbole</label>
              <input id="asset-symbol" name="symbol" required maxLength={30} />
              <label htmlFor="asset-namespace">
                {equity ? "Place de cotation (MIC)" : "Réseau / namespace"}
              </label>
              <input
                id="asset-namespace"
                name="namespace"
                required
                maxLength={equity ? 4 : 80}
              />
              <label htmlFor="asset-reference">
                {equity ? "ISIN" : "Identifiant natif ou adresse du contrat"}
              </label>
              <input
                id="asset-reference"
                name="reference"
                required
                maxLength={equity ? 12 : 160}
              />
              <label htmlFor="asset-currency">Devise de référence</label>
              <input
                id="asset-currency"
                name="currency"
                required
                defaultValue="EUR"
                pattern="[A-Za-z]{3}"
                maxLength={3}
              />
              <button className="primary full">Ajouter l’actif</button>
            </fieldset>
          </form>
          {!assets.length && <p>Aucun actif enregistré.</p>}
          <ul className="resource-list">
            {assets
              .filter((a) => archived || !a.archived)
              .map((a) => (
                <li key={a.id}>
                  <h3>
                    {a.name} · {a.symbol}
                    {a.archived ? " · Archivé" : ""}
                  </h3>
                  <p>
                    {a.namespace} · {a.reference} · {a.currency}
                  </p>
                  {catalogSummary && (
                    <details>
                      <summary>Détail des positions et résultats</summary>
                      {catalogSummary.positions
                        .filter((p) => p.asset_id === a.id)
                        .map((p) => (
                          <p key={p.account_id}>
                            {catalogSummary.cash.find(
                              (c) => c.account_id === p.account_id,
                            )?.name || p.account_id}{" "}
                            · Quantité {p.quantity.display.replace(".", ",")} ·
                            Valeur {money(p.value_eur)} · PRU{" "}
                            {p.average_cost?.display.replace(".", ",") ||
                              "Non calculable"}{" "}
                            {p.currency} · Latent{" "}
                            {p.unrealized?.display.replace(".", ",") ||
                              "Non calculable"}{" "}
                            {p.currency} · Réalisé{" "}
                            {p.realized?.display.replace(".", ",") ||
                              "Non calculable"}{" "}
                            {p.currency}
                          </p>
                        ))}
                    </details>
                  )}
                  <NameEditor
                    item={a}
                    disabled={busy}
                    save={(changes) =>
                      void action(async () => {
                        const next = await api<Asset>(
                          `assets/${a.id}`,
                          "PATCH",
                          changes,
                        );
                        setAssets((old) =>
                          old.map((item) => (item.id === a.id ? next : item)),
                        );
                      })
                    }
                  />
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}
