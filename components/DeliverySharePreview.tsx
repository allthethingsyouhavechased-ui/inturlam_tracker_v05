"use client";
import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";

export default function DeliverySharePreview({children}:{children:React.ReactNode}) {
  const formRef=useRef<HTMLFormElement|null>(null),confirmed=useRef(false), fingerprint=useRef("");
  const [draft,setDraft]=useState<{note:string;url:string;files:string[]}|null>(null);
  return <div onSubmitCapture={event=>{
    const form=event.target as HTMLFormElement;const data=new FormData(form);
    if(data.get("guestVisible")!=="1")return;
    const current=JSON.stringify([...data.entries()].map(([key,value])=>[key,typeof value==="string"?value:[value.name,value.size,value.lastModified]]));
    if(confirmed.current && fingerprint.current===current){confirmed.current=false;return;}
    confirmed.current=false;fingerprint.current=current;
    event.preventDefault();event.stopPropagation();formRef.current=form;
    setDraft({note:String(data.get("note")??""),url:String(data.get("externalUrl")??""),files:data.getAll("images").filter((f):f is File=>f instanceof File&&f.size>0).map(f=>f.name)});
  }}>{children}{draft&&<section aria-label="Teslim müşteri önizlemesi" className="mt-3 space-y-2 rounded-lg border border-brand-500 bg-surface-subtle p-4"><h3 className="text-sm font-semibold">Müşteriye gönderilecek teslim</h3><p className="whitespace-pre-wrap break-words text-sm">{draft.note||"Teslim notu yok."}</p>{draft.url&&<p className="break-all text-xs">{draft.url}</p>}{draft.files.map((name,i)=><p className="break-all text-xs" key={i}>{name}</p>)}<p className="text-xs text-muted">Bu sürümün notu, bağlantısı ve seçilen görselleri müşteriye açılacak.</p><div className="flex flex-wrap gap-2"><button type="button" className={buttonClass({size:"sm"})} onClick={()=>{confirmed.current=true;setDraft(null);formRef.current?.requestSubmit();}}>Onayla ve teslim et</button><button type="button" className={buttonClass({variant:"secondary",size:"sm"})} onClick={()=>setDraft(null)}>Düzenlemeye dön</button></div></section>}</div>;
}
