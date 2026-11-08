import { useEffect, useRef, useState } from "react";
import { api, resourceError } from "./api";
import { ApiError } from "./auth";
import type { Summary } from "./Finance";
type Value=Summary["positions"][number]["quantity"];
type Selection={account:string;asset:string;date:string};
export function SaleAvailability({ disabled, expired }: {disabled:boolean;expired:()=>void}) {
 const root=useRef<HTMLDivElement>(null), mounted=useRef(true), scope=useRef(""), version=useRef(0);
 const [selection,setSelection]=useState<Selection>({account:"",asset:"",date:""});
 const [result,setResult]=useState<{scope:string;at:string;quantity:Value|null}|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 useEffect(()=>{
  mounted.current=true;
  const form=root.current?.closest("form");
  if(!form)return;
  const update=()=>{
   const data=new FormData(form);
   const next={account:String(data.get("account_id")||""),asset:String(data.get("asset_id")||""),date:String(data.get("occurred_at")||"")};
   const key=JSON.stringify(next);
   if(key!==scope.current){scope.current=key;version.current++;setSelection(next);setResult(null);setError("");setLoading(false);}
  };
  update();form.addEventListener("input",update);form.addEventListener("change",update);
  return()=>{mounted.current=false;version.current++;form.removeEventListener("input",update);form.removeEventListener("change",update);};
 },[]);
 async function check(){
  if(disabled||loading||!selection.account||!selection.asset||!selection.date)return;
  const requestedScope=scope.current, token=++version.current;
  setLoading(true);setError("");setResult(null);
  try{
   const at=new Date(selection.date).toISOString();
   const summary=await api<Summary>(`summary?${new URLSearchParams({at})}`);
   if(!mounted.current||version.current!==token)return;
   if(!summary.cash.some(c=>c.account_id===selection.account)){setError("Compte indisponible dans cette synthèse.");return;}
   const position=summary.positions.find(p=>p.account_id===selection.account&&p.asset_id===selection.asset);
   setResult({scope:requestedScope,at:summary.at,quantity:position?.quantity||null});
  }catch(err){
   if(mounted.current&&version.current===token)setError((err instanceof RangeError||(err instanceof ApiError&&err.status===400))?"La date doit être valide et ne peut pas être future.":resourceError(err));
   if(mounted.current&&err instanceof ApiError&&err.status===401)expired();
  }finally{if(mounted.current&&version.current===token)setLoading(false);}
 }
 function useExact(){
  if(disabled||!result?.quantity||result.quantity.exact==="0"||result.scope!==scope.current)return;
  const input=root.current?.closest("form")?.querySelector<HTMLInputElement>('input[name="quantity"]');
  if(input){input.value=result.quantity.exact;input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();}
 }
 return <div ref={root} className="sale-availability" role="region" aria-label="Disponibilité de la vente">
  <h4>Quantité à la date saisie</h4>
  <p>Lecture après les opérations déjà enregistrées à cet instant. Une vente antidatée reste soumise à la cohérence des opérations postérieures.</p>
  <button type="button" className="secondary" disabled={disabled||loading||!selection.account||!selection.asset||!selection.date} onClick={()=>void check()}>Vérifier la quantité à cette date</button>
  {loading&&<p role="status">Vérification de la quantité…</p>}
  {error&&<p role="alert">{error}</p>}
  {!loading&&!error&&!result&&<p>Choisissez le compte, l’actif et la date, puis vérifiez la quantité.</p>}
  {result&&<>
   <p>Situation au <time dateTime={result.at}>{result.at}</time>.</p>
   {result.quantity?<>
    <p>Quantité détenue : {result.quantity.approximate?"≈ ":""}{result.quantity.display.replace(".",",")}</p>
    <details><summary>Quantité détenue exacte</summary><p>{result.quantity.exact}</p></details>
    <button type="button" className="secondary" disabled={disabled||result.quantity.exact==="0"} onClick={useExact}>Utiliser la quantité exacte</button>
   </>:<p>Aucune position de cet actif dans ce compte à cette date.</p>}
  </>}
  <p className="help">Cette vérification n’enregistre pas de vente et ne réserve pas les titres. Vérifiez les champs avant de confirmer l’opération.</p>
 </div>;
}
