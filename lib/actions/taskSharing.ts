"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/identity";
import { setTaskSharing } from "@/lib/taskSharing";

export async function setTaskSharingAction(form: FormData) {
  const actor=await requireManager();
  try {
    setTaskSharing({taskId:String(form.get("taskId")??""),actorId:actor.person.id,enabled:form.get("enabled")==="1",brief:String(form.get("brief")??"").trim(),requestedDate:String(form.get("requestedDate")??"").trim()||null});
    revalidatePath("/", "layout");
    return {ok:true as const};
  } catch(error) { return {ok:false as const,error:error instanceof Error?error.message:"Paylaşım güncellenemedi."}; }
}
