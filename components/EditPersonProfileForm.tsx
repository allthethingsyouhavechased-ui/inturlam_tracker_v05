import PersonAvatarPicker from "@/components/PersonAvatarPicker";
import SubmitButton from "@/components/SubmitButton";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { updatePersonProfileAction } from "@/lib/actions/people";
import { DEPARTMENTS, NO_DEPARTMENT_LABEL } from "@/lib/departments";
import type { Person } from "@/lib/types";

export default function EditPersonProfileForm({ person }: { person: Person }) {
  return (
    <Card as="form" action={updatePersonProfileAction} className="space-y-6">
      <input type="hidden" name="personId" value={person.id} />

      <PersonAvatarPicker name={person.name} currentAvatarPath={person.avatar_path} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[13px] font-semibold text-secondary">
          İsim
          <Input name="name" required maxLength={80} defaultValue={person.name} />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-secondary">
          Unvan / rol
          <Input
            name="title"
            maxLength={120}
            defaultValue={person.title ?? ""}
            placeholder="Creative Technologist, Art Director…"
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-[13px] font-semibold text-secondary sm:max-w-xs">
        Departman
        <Select name="department" defaultValue={person.department ?? ""}>
          <option value="">{NO_DEPARTMENT_LABEL} (departman yok)</option>
          {DEPARTMENTS.map((department) => (
            <option key={department.id} value={department.id}>
              {department.label}
            </option>
          ))}
        </Select>
        <span className="text-xs font-normal text-muted">
          Ekip kanbanındaki satırı ve görev/rapor ekranlarındaki departman
          filtresini belirler.
        </span>
      </label>

      <label className="grid gap-1.5 text-[13px] font-semibold text-secondary">
        Kısa tanıtım
        <Textarea
          name="bio"
          rows={5}
          maxLength={1000}
          defaultValue={person.bio ?? ""}
          placeholder="Uzmanlık alanları, sorumluluklar ve ekip içinde bilinmesi faydalı bilgiler…"
        />
        <span className="text-xs font-normal text-muted">En fazla 1000 karakter.</span>
      </label>

      <div className="flex justify-end border-t border-border-subtle pt-4">
        <SubmitButton>Profili kaydet</SubmitButton>
      </div>
    </Card>
  );
}
