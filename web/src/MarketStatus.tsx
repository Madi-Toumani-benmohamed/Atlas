import { useEffect, useState } from "react";
import { api, resourceError } from "./api";
import { ApiError } from "./auth";
type Status = {
  provider: {
    source: string;
    state: string;
    last_success_at: string | null;
    reference_date?: string;
    next_request_at: string | null;
    last_error_code?: string;
  };
  synchronization: { last_persisted_at: string | null; reference_date: string };
};
const states: Record<string, string> = {
  never_fetched: "Aucune réponse BCE récupérée depuis le démarrage.",
  refreshing: "Récupération BCE en cours.",
  cached: "Réponse BCE disponible dans le cache partagé.",
  stale: "Le cache BCE a expiré ; une nouvelle récupération est nécessaire.",
  backoff: "Nouvelle tentative BCE temporairement différée.",
  unavailable: "La dernière récupération BCE a échoué.",
};
function date(raw: string) {
  return new Date(raw).toLocaleString("fr-FR");
}
export function MarketStatus({
  revision,
  disabled,
  expired,
}: {
  revision: number;
  disabled: boolean;
  expired: () => void;
}) {
  const [open, setOpen] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setStatus(null);
    void api<Status>("market/status")
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch((err) => {
        if (!active) return;
        setError(resourceError(err));
        if (err instanceof ApiError && err.status === 401) expired();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, attempt, revision, expired]);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>État de la récupération BCE</summary>
      <p>
        Vérifier cet état ne contacte pas la BCE. Les réponses du fournisseur
        sont partagées pour limiter les appels ; vos taux enregistrés restent
        privés.
      </p>
      {loading && <p role="status">Lecture de l’état BCE…</p>}
      {error && <p role="alert">{error}</p>}
      {status && (
        <>
          <p role="status">
            {states[status.provider.state] || "État fournisseur non reconnu."}
          </p>
          {status.provider.last_error_code && (
            <p>
              {status.provider.last_error_code === "ecb_rate_limited"
                ? "Le fournisseur limite les requêtes."
                : "Le fournisseur est indisponible ou sa réponse est invalide."}{" "}
              Les taux déjà enregistrés restent inchangés.
            </p>
          )}
          <p>
            Dernière réponse BCE récupérée :{" "}
            {status.provider.last_success_at
              ? date(status.provider.last_success_at)
              : "aucune depuis le démarrage"}
            .
          </p>
          {status.provider.reference_date && (
            <p>
              Date de référence du cache BCE : {status.provider.reference_date}.
              Une réponse récupérée récemment ne garantit pas un taux du jour.
            </p>
          )}
          {status.provider.next_request_at && (
            <p>
              Prochaine récupération externe possible à partir du{" "}
              {date(status.provider.next_request_at)}.
            </p>
          )}
          <p>
            Derniers nouveaux taux BCE enregistrés dans votre espace :{" "}
            {status.synchronization.last_persisted_at
              ? date(status.synchronization.last_persisted_at)
              : "aucun"}
            .
          </p>
          {status.synchronization.reference_date && (
            <p>
              Date de référence enregistrée :{" "}
              {status.synchronization.reference_date}.
            </p>
          )}
        </>
      )}
      <button
        type="button"
        className="secondary"
        disabled={disabled || loading}
        onClick={() => setAttempt((value) => value + 1)}
      >
        Vérifier l’état BCE
      </button>
    </details>
  );
}
