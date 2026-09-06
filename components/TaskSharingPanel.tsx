"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTaskSharingAction } from "@/lib/actions/taskSharing";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import PageActionDialog from "@/components/ui/PageActionDialog";

export default function TaskSharingPanel({taskId,title,brandName,initialBrief,initialDate,shared,publicItems}:{taskId:string;title:string;brandName:string;initialBrief:string;initialDate:string;shared:boolean;publicItems:React.ReactNode}) {
  const [brief,setBrief]=useState(initialBrief),[date,setDate]=useState(initialDate),[preview,setPreview]=useState(false),[error,setError]=useState("");
  const [pending,startTransition]=useTransition(); const router=useRouter();
  function save(enabled:boolean) { startTransition(async()=>{const form=new FormData(); form.set("taskId",taskId);form.set("enabled",enabled?"1":"0");form.set("brief",brief);form.set("requestedDate",date); const result=await setTaskSharingAction(form);if(!result.ok)setError(result.error);else {setError("");setPreview(false);router.refresh();}}); }
  return <PageActionDialog open={preview} onOpenChange={setPreview} title="Müşteri önizlemesi ve paylaşım"
    triggerLabel={<>Müşteri paylaşımı <span className={shared ? "text-brand-600 dark:text-brand-300" : "text-muted"}>· {shared ? "Açık" : "Kapalı"}</span></>}
    description={`${brandName} müşterisi aşağıdaki başlığı, briefi, müşteri tarihini ve paylaşılan konuşma/teslimleri görür. İç notlar, puanlar, atamalar ve iç teslim tarihi gizlidir.`}>
    <div className="space-y-3 break-words"><h3 className="font-semibold">{title}</h3><label className="grid gap-1 text-xs">Müşteriye gösterilecek brief<textarea className={controlClass()} value={brief} maxLength={5000} rows={3} onChange={e=>setBrief(e.target.value)}/></label><label className="grid gap-1 text-xs">Müşteri tarihi (isteğe bağlı)<input type="date" className={controlClass()} value={date} onChange={e=>setDate(e.target.value)}/></label>{publicItems}<button type="button" disabled={pending} className={buttonClass({className:"max-w-full text-left"})} onClick={()=>save(true)}>{pending?"Kaydediliyor…":shared?"Önizlemeyi onayla ve güncelle":"Önizlemeyi onayla ve müşteriyle paylaş"}</button></div>
    {shared&&<button type="button" disabled={pending} className="mt-3 text-xs font-semibold text-red-600" onClick={()=>save(false)}>Müşteri erişimini geri al</button>}
    {error&&<p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </PageActionDialog>;
}
