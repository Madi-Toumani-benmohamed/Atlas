// Informational preview of the approved purchase formulas; the API remains authoritative.
type Rational = { n: bigint; d: bigint };
export type PreviewValue = { exact: string; display: string; approximate: boolean };
export type PurchaseResult =
  | { state: "incomplete" | "invalid"; message: string }
  | { state: "ready"; quantity: PreviewValue; price: PreviewValue; fees: PreviewValue; total: PreviewValue };
function rational(n: bigint, d: bigint): Rational {
  let a = n < 0n ? -n : n, b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
function decimal(text: string): Rational | null {
  if (!/^(0|[1-9][0-9]{0,35})(\.[0-9]{1,18})?$/.test(text)) return null;
  const [whole, part = ""] = text.split(".");
  return rational(BigInt(whole + part), 10n ** BigInt(part.length));
}
function quantity(text: string): Rational | null {
  const d = decimal(text);
  if (d) return d;
  if (text.length <= 8190 && /^[1-9][0-9]*$/.test(text)) return rational(BigInt(text), 1n);
  if (text.length <= 8192 && /^(0|[1-9][0-9]*)\/[1-9][0-9]*$/.test(text)) {
    const [n, d] = text.split("/").map(BigInt);
    return rational(n, d);
  }
  return null;
}
const add = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const multiply = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
function value(a: Rational, scale: number): PreviewValue {
  const power = 10n ** BigInt(scale);
  const scaled = a.n * power;
  const rounded = scaled / a.d + (2n * (scaled % a.d) >= a.d ? 1n : 0n);
  const text = rounded.toString().padStart(scale + 1, "0");
  return {
    exact: a.d === 1n ? String(a.n) : `${a.n}/${a.d}`,
    display: `${text.slice(0, -scale)}.${text.slice(-scale)}`,
    approximate: scaled % a.d !== 0n,
  };
}
export function purchasePreview(fields: Record<string, string>, byTotal: boolean): PurchaseResult {
  const input = (name: string) => (fields[name] || "").trim().replace(",", ".");
  const main = input(byTotal ? "amount" : "quantity"), priceText = input("price");
  if (!main || !priceText) return { state: "incomplete", message: "Renseignez le prix et le montant ou la quantité pour voir le calcul." };
  const price = decimal(priceText), fees = decimal(input("fees") || "0");
  const source = byTotal ? decimal(main) : quantity(main);
  if (!price || !fees || !source || price.n <= 0n || source.n <= 0n)
    return { state: "invalid", message: "Aperçu indisponible : vérifiez les nombres, le prix positif et les frais non négatifs." };
  let q: Rational, total: Rational;
  if (byTotal) {
    total = source;
    const net = add(total, { n: -fees.n, d: fees.d });
    if (net.n <= 0n) return { state: "invalid", message: "Le montant total doit dépasser les frais." };
    q = rational(net.n * price.d, net.d * price.n);
  } else {
    q = source;
    total = add(multiply(q, price), fees);
  }
  return { state: "ready", quantity: value(q, 8), price: value(price, 8), fees: value(fees, 2), total: value(total, 2) };
}
