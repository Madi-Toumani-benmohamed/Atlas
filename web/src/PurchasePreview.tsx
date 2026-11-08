import { useEffect, useRef, useState } from "react";
import type { Account, Asset } from "./api";
import { purchasePreview } from "./purchase-preview";
import type { PreviewValue } from "./purchase-preview";
function Amount({ value, unit = "" }: { value: PreviewValue; unit?: string }) {
  return <span title={`Valeur exacte : ${value.exact}`}>{value.approximate ? "≈ " : ""}{value.display.replace(".", ",")} {unit}</span>;
}
export function PurchasePreview({ byTotal, accounts, assets }: {
  byTotal: boolean; accounts: Account[]; assets: Asset[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const update = () => setFields(Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v)])));
    update();
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => { form.removeEventListener("input", update); form.removeEventListener("change", update); };
  }, [byTotal]);
  const result = purchasePreview(fields, byTotal);
  const account = accounts.find(a => a.id === fields.account_id);
  const asset = assets.find(a => a.id === fields.asset_id);
  return (
    <div ref={root} className="purchase-preview" role="region" aria-label="Récapitulatif de l’achat">
      <h4>Vérifier l’achat avant enregistrement</h4>
      <p>Compte : {account ? `${account.name} · ${account.currency}` : "À choisir"}</p>
      <p>Actif : {asset ? `${asset.name} · ${asset.namespace} · ${asset.reference}` : "À choisir"}</p>
      {result.state !== "ready" ? <p role="status">{result.message}</p> : (
        <>
          <p>Quantité calculée : <Amount value={result.quantity} /></p>
          <p>Prix unitaire : <Amount value={result.price} unit={account?.currency} /></p>
          <p>Frais : <Amount value={result.fees} unit={account?.currency} /></p>
          <p>Total débité, frais inclus : <Amount value={result.total} unit={account?.currency} /></p>
          {result.quantity.approximate && <details><summary>Quantité exacte</summary><p>{result.quantity.exact}</p></details>}
        </>
      )}
      <p className="help">Aperçu sans enregistrement. Les montants sont dans la devise du compte. Le serveur vérifiera les liquidités et la chronologie à la confirmation.</p>
    </div>
  );
}
