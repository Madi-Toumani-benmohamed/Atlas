import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { createAuthClient, errorMessage } from "./auth";
import type { User } from "./auth";
import "./styles.css";
import { Workspace } from "./Workspace";

const auth = createAuthClient();
type Mode = "login" | "register";
type Theme = "dark" | "light" | "system";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("atlas-theme");
      return saved === "dark" || saved === "light" ? saved : "system";
    } catch {
      return "system";
    }
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const initial = useRef(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("atlas-theme", theme);
    } catch {
      /* Private browsing may disallow storage. */
    }
  }, [theme]);
  useEffect(() => {
    void restore();
  }, []);
  useEffect(() => {
    document.title = `Atlas Portfolio — ${user ? "Votre espace" : mode === "login" ? "Connexion" : "Inscription"}`;
    if (initial.current) {
      initial.current = false;
      return;
    }
    heading.current?.focus();
  }, [user, mode, checking]);

  async function restore() {
    setChecking(true);
    setError("");
    try {
      setUser(await auth.me());
    } catch (err) {
      setError(errorMessage(err, "session"));
    } finally {
      setChecking(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    const bytes = new TextEncoder().encode(password).length;
    if (bytes < 12 || bytes > 72) {
      setError(
        "Le mot de passe doit contenir de 12 à 72 octets. Un caractère accentué peut compter pour plusieurs octets.",
      );
      return;
    }
    setBusy(true);
    try {
      const value = { email: email.trim(), password };
      if (mode === "register") {
        await auth.register(value);
        setPassword("");
        setMode("login");
        setNotice(
          "Demande reçue. Si l’adresse peut être inscrite, vous pouvez maintenant vous connecter avec vos identifiants.",
        );
      } else {
        await auth.login(value);
        setPassword("");
        const current = await auth.me();
        if (!current) {
          setError(
            "La session n’a pas pu être confirmée. Vérifiez que les cookies sont autorisés et que le site utilise HTTPS.",
          );
        } else {
          setUser(current);
        }
      }
    } catch (err) {
      setError(errorMessage(err, mode));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await auth.logout();
      setUser(null);
      setPassword("");
      setMode("login");
      setNotice("Vous êtes déconnecté.");
    } catch (err) {
      setError(errorMessage(err, "logout"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Atlas Portfolio, accueil">
          <span className="mark" aria-hidden="true">
            ✧
          </span>{" "}
          ATLAS <span className="brand-detail">Portfolio</span>
        </a>
        <label className="theme">
          Thème{" "}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="system">Automatique</option>
            <option value="dark">Sombre</option>
            <option value="light">Clair</option>
          </select>
        </label>
      </header>
      {user && !checking ? (
        <Workspace
          key={user.id}
          user={user}
          expired={() => {
            setUser(null);
            setNotice("Votre session a expiré. Reconnectez-vous.");
          }}
          feedback={
            <>
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
            </>
          }
          logout={
            <button
              className="secondary full"
              onClick={() => void logout()}
              disabled={busy}
            >
              {busy ? "Déconnexion…" : "Se déconnecter"}
            </button>
          }
        />
      ) : (
        <main>
          <section className="intro" aria-labelledby="intro-title">
            <p className="eyebrow">VOTRE OBSERVATOIRE PERSONNEL</p>
            <h1 id="intro-title">
              Vos investissements.
              <br />
              <span>Une vision claire.</span>
            </h1>
            <p>
              Un espace personnel pour suivre vos investissements, en gardant la
              maîtrise de vos données.
            </p>
            <div className="principles">
              <span>Auto-hébergé</span>
              <span>Open source</span>
              <span>Sans abonnement</span>
            </div>
            <p className="development">
              Atlas est en développement. Les portefeuilles, comptes et actifs
              peuvent être organisés. Les calculs financiers sont en cours de
              développement.
            </p>
          </section>
          <section
            className="panel"
            aria-labelledby="panel-title"
            aria-busy={busy || checking}
          >
            <p className="eyebrow">
              {user ? "ESPACE PERSONNEL" : "ACCÈS À ATLAS"}
            </p>
            <h2 id="panel-title" ref={heading} tabIndex={-1}>
              {checking
                ? "Vérification de la session"
                : user
                  ? "Bienvenue dans Atlas"
                  : mode === "login"
                    ? "Se connecter"
                    : "Créer un compte"}
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
            {checking ? (
              <p role="status">Connexion au service…</p>
            ) : user ? (
              <>
                <p>
                  Connecté en tant que{" "}
                  <strong className="email">{user.email}</strong>.
                </p>
                <div className="empty">
                  <h3>Votre espace prend forme</h3>
                  <p>
                    La création de portefeuilles et de comptes n’est pas encore
                    disponible. Aucune valorisation n’est affichée à ce stade.
                  </p>
                </div>
                <button
                  className="secondary full"
                  onClick={() => void logout()}
                  disabled={busy}
                >
                  {busy ? "Déconnexion…" : "Se déconnecter"}
                </button>
              </>
            ) : (
              <>
                <p>
                  {mode === "login"
                    ? "Retrouvez votre espace personnel."
                    : "L’inscription doit être autorisée par l’exploitant de cette instance."}
                </p>
                <form onSubmit={(e) => void submit(e)}>
                  <fieldset disabled={busy}>
                    <label htmlFor="email">Adresse e-mail</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <label htmlFor="password">Mot de passe</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                      aria-describedby="password-help"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="help" id="password-help">
                      12 à 72 octets. Les caractères accentués peuvent compter
                      pour plusieurs octets.
                    </p>
                    <button className="primary full" type="submit">
                      {busy
                        ? "Veuillez patienter…"
                        : mode === "login"
                          ? "Se connecter"
                          : "Demander l’inscription"}
                    </button>
                  </fieldset>
                </form>
                <button
                  className="text-button full"
                  disabled={busy}
                  onClick={() => {
                    setMode(mode === "login" ? "register" : "login");
                    setPassword("");
                    setError("");
                    setNotice("");
                  }}
                >
                  {mode === "login"
                    ? "Créer un compte"
                    : "J’ai déjà un compte — me connecter"}
                </button>
                {error && (
                  <button
                    className="secondary full"
                    disabled={busy}
                    onClick={() => void restore()}
                  >
                    Revérifier ma session
                  </button>
                )}
                <p className="help">
                  La récupération de mot de passe n’est pas encore disponible.
                </p>
              </>
            )}
          </section>
        </main>
      )}
      <footer>
        <a href="/licenses/NOTICE.txt">Licences et attributions</a>
        Atlas Portfolio <span>Clarté · Confidentialité · Maîtrise</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
