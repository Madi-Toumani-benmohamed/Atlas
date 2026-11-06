import { ApiError } from "./auth";

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    ...(body === undefined
      ? {}
      : {
          headers: {
            "Content-Type": "application/json",
            ...(key ? { "Idempotency-Key": key } : {}),
          },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    let code: string | undefined;
    try {
      const data = await response.json();
      if (typeof data.error === "string") code = data.error;
    } catch {
      /* Empty errors remain generic. */
    }
    throw new ApiError(response.status, code);
  }
  return response.json() as Promise<T>;
}
export async function all<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let cursor = "";
  do {
    const result = await api<{ items: T[]; next_cursor: string }>(
      `${path}?limit=100&cursor=${encodeURIComponent(cursor)}`,
    );
    if (
      !Array.isArray(result.items) ||
      typeof result.next_cursor !== "string" ||
      (result.next_cursor !== "" && result.next_cursor === cursor)
    )
      throw new Error("Invalid page");
    items.push(...result.items);
    cursor = result.next_cursor;
  } while (cursor);
  return items;
}
export function resourceError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) {
      const code = error.code || "";
      if (code.includes("insufficient_cash"))
        return "Liquidités insuffisantes à une date de l’historique. Ajoutez ou corrigez le dépôt ou le solde d’ouverture explicite.";
      if (code.includes("insufficient_quantity"))
        return "Quantité insuffisante à une date de l’historique. La vente à découvert est interdite.";
      if (code.includes("staking_price"))
        return "Le staking exige un cours positif, sa source et sa date à réception.";
      if (code.includes("unsupported_operation"))
        return "Cette opération n’est pas prise en charge. Les swaps doivent être corrigés manuellement.";
      if (code.includes("inconsistent_total"))
        return "Le total ne correspond pas à la quantité, au prix et aux frais.";
      return "Les données ou leur chronologie sont incohérentes. Vérifiez dates, montants, devises et identifiants.";
    }
    if (error.status === 401)
      return "Votre session a expiré. Reconnectez-vous.";
    if (error.status === 400)
      return "Vérifiez les champs et les identifiants saisis.";
    if (error.status === 403)
      return "L’origine de cette action n’est pas autorisée.";
    if (error.status === 404) return "Cette ressource n’est pas disponible.";
    if (error.status === 409)
      return "Un identifiant existe déjà ou le portefeuille est archivé.";
  }
  return "Le service est indisponible. Vos données n’ont pas pu être confirmées.";
}
export type Portfolio = {
  id: string;
  name: string;
  archived: boolean;
  created_at: string;
};
export type Account = Portfolio & {
  portfolio_id: string;
  kind: string;
  currency: string;
  provider: string;
  savings_product: string;
};
export type Asset = Portfolio & {
  kind: string;
  symbol: string;
  namespace: string;
  reference: string;
  currency: string;
};
