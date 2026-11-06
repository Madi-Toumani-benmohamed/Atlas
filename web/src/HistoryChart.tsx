type Value = { exact: string; display: string; approximate: boolean };
export type HistoryPoint = {
  at: string;
  value_eur: Value | null;
  missing: boolean;
  uses_prior_date_observations: boolean;
};
function cents(text: string) {
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const n = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  return negative ? -n : n;
}
// Monetary inputs stay exact BigInts; Number is used only for bounded SVG coordinates.
export function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const known = points.flatMap((p) =>
    p.value_eur ? [{ point: p, n: cents(p.value_eur.display) }] : [],
  );
  if (!known.length)
    return <p>Aucune valorisation complète sur cette période.</p>;
  const min = known.reduce((a, b) => (a.n < b.n ? a : b)),
    max = known.reduce((a, b) => (a.n > b.n ? a : b));
  const range = max.n - min.n || 1n;
  const coordinates = points.map((p, i) =>
    p.value_eur
      ? {
          x: 60 + (points.length === 1 ? 440 : (i * 880) / (points.length - 1)),
          y:
            240 -
            Number(((cents(p.value_eur.display) - min.n) * 19000n) / range) /
              100,
          p,
        }
      : null,
  );
  const segments: string[][] = [];
  let segment: string[] = [];
  for (const c of coordinates) {
    if (c) segment.push(`${c.x},${c.y}`);
    else if (segment.length) {
      segments.push(segment);
      segment = [];
    }
  }
  if (segment.length) segments.push(segment);
  return (
    <figure className="history-chart">
      <p>
        Valeurs de {min.point.value_eur!.display.replace(".", ",")} € à{" "}
        {max.point.value_eur!.display.replace(".", ",")} €
      </p>
      <svg
        viewBox="0 0 1000 300"
        role="img"
        aria-label="Valeur du portefeuille en euros aux dates connues ; les jours incomplets interrompent le tracé"
      >
        <line x1="60" y1="240" x2="940" y2="240" className="chart-axis" />
        {segments.map((part, i) => (
          <polyline key={i} points={part.join(" ")} className="chart-line" />
        ))}
        {coordinates.map(
          (c, i) =>
            c && (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={c.p.uses_prior_date_observations ? 5 : 3}
                className={
                  c.p.uses_prior_date_observations ? "chart-old" : "chart-point"
                }
              >
                <title>
                  {new Date(c.p.at).toLocaleDateString("fr-FR", {
                    timeZone: "UTC",
                  })}{" "}
                  : {c.p.value_eur!.display} EUR
                  {c.p.uses_prior_date_observations
                    ? " · Observation antérieure"
                    : ""}
                </title>
              </circle>
            ),
        )}
      </svg>
      <figcaption>
        {new Date(points[0].at).toLocaleDateString("fr-FR", {
          timeZone: "UTC",
        })}{" "}
        →{" "}
        {new Date(points[points.length - 1].at).toLocaleDateString("fr-FR", {
          timeZone: "UTC",
        })}
        . Points pleins : observations du jour ; points creux : dernière
        observation d’une date antérieure. Les valeurs exactes et les dates sont
        consultables dans la liste ci-dessous.
      </figcaption>
    </figure>
  );
}
