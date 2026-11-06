export type User = { id: string; email: string };
export type Credentials = { email: string; password: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, code?: string) {
    super("Identity request failed");
    this.status = status;
    this.code = code;
  }
}

// Same-origin cookies only: session tokens never enter JS storage or headers.
export function createAuthClient(fetcher: typeof fetch = fetch) {
  async function request(path: string, method: string, body?: Credentials) {
    const response = await fetcher(`/api/v1/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (!response.ok) throw new ApiError(response.status);
    return response;
  }
  return {
    async me(): Promise<User | null> {
      try {
        const response = await request("me", "GET");
        const data: unknown = await response.json();
        if (
          !data ||
          typeof data !== "object" ||
          !("id" in data) ||
          !("email" in data) ||
          typeof data.id !== "string" ||
          typeof data.email !== "string"
        )
          throw new Error("Invalid identity response");
        return { id: data.id, email: data.email };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    async login(value: Credentials) {
      await request("auth/login", "POST", value);
    },
    async register(value: Credentials) {
      await request("auth/register", "POST", value);
    },
    async logout() {
      await request("auth/logout", "POST");
    },
  };
}

export function errorMessage(
  error: unknown,
  action: "login" | "register" | "session" | "logout",
): string {
  if (error instanceof ApiError) {
    if (error.status === 429)
      return "Trop de tentatives. Patientez une minute avant de réessayer.";
    if (error.status === 403)
      return action === "register"
        ? "Inscription indisponible. Elle peut être désactivée par l’exploitant ; l’origine du site doit aussi être autorisée."
        : "Requête refusée. L’exploitant doit vérifier l’origine autorisée du site.";
    if (error.status === 401)
      return "Adresse e-mail ou mot de passe incorrect.";
    if (error.status === 400)
      return "Vérifiez l’adresse e-mail et le mot de passe (12 à 72 octets).";
    if (error.status === 404)
      return "Le service de connexion n’est pas activé. Contactez l’exploitant.";
  }
  return "Impossible de joindre le service ou de confirmer sa réponse. Réessayez.";
}
