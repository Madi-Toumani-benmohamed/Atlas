import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, resourceError } from "./api";
import { ApiError } from "./auth";
import { HistoryChart } from "./HistoryChart";
import type { HistoryPoint } from "./HistoryChart";
export function PortfolioHistory({ portfolioId, expired }: { portfolioId: string; expired: () => void }) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError(""); setPoints([]);
    try {
      const params = new URLSearchParams({ portfolio_id: portfolioId,
        from: new Date(String(fields.get("from"))).toISOString(),
        to: new Date(String(fields.get("to"))).toISOString() });
      const result = await api<{ items: HistoryPoint[]; portfolio_id: string; metric: string }>(`history?${params}`);
      if (result.portfolio_id !== portfolioId || result.metric !== "valuation") throw Error("Unexpected history scope");
      if (mounted.current) setPoints(result.items);
    } catch (err) {
      if (mounted.current) setError(err instanceof ApiError && err.status === 400
        ? "Choisissez des dates valides, sans date future et sur une période d’au plus 366 jours."
        : resourceError(err));
      if (mounted.current && err instanceof ApiError && err.status === 401) expired();
    } finally { if (mounted.current) setBusy(false); }
  }
  return <details className="portfolio-disclosure">
    <summary>Évolution de la valeur du portefeuille</summary>
    <p>Valeur en EUR aux dates demandées, flux et transferts inclus. Une hausse de valeur ne représente pas nécessairement un gain. Ce graphique ne mesure pas un rendement personnel.</p>
    <p>Choisissez une période d’au plus 366 jours. Saisie dans le fuseau du navigateur, points quotidiens en UTC. Les données manquantes interrompent le tracé.</p>
    <form onSubmit={e => void load(e)}>
      <fieldset disabled={busy}>
        <label htmlFor="portfolio-history-from">Début de la période du portefeuille</label>
        <input id="portfolio-history-from" name="from" type="datetime-local" required />
        <label htmlFor="portfolio-history-to">Fin de la période du portefeuille</label>
        <input id="portfolio-history-to" name="to" type="datetime-local" required />
        <button className="secondary">Charger la valeur historique du portefeuille</button>
      </fieldset>
    </form>
    {busy && <p role="status">Chargement des valeurs du portefeuille…</p>}
    {error && <p role="alert">{error}</p>}
    {points.length > 0 && <>
      <HistoryChart points={points} />
      <div className="history-points" role="list" tabIndex={0} aria-label="Valeurs historiques de ce portefeuille">
        {points.map(p => <div role="listitem" key={p.at}>
          <time dateTime={p.at}>{p.at}</time>
          <span title={p.value_eur ? `Valeur exacte : ${p.value_eur.exact}` : undefined}>
            {p.value_eur ? `${p.value_eur.approximate ? "≈ " : ""}${p.value_eur.display.replace(".", ",")} EUR` : "Non calculable"}
            {p.missing ? " · Données manquantes" : p.uses_prior_date_observations ? " · Observation d’une date antérieure" : ""}
          </span>
        </div>)}
      </div>
    </>}
  </details>;
}
