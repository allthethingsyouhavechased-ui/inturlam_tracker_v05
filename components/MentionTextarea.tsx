"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import {
  listMentionablePeopleAction,
  type MentionablePerson,
} from "@/lib/actions/mentions";

// `lib/mentions.ts` yorum metnindeki `@Ad Soyad`ı TAM İSME göre eşliyor ve en
// uzun isim önce kazanıyor. Yani yazarken bir harf eksik/yanlış olursa bildirim
// SESSİZCE gitmiyor — hata da vermiyor. Bu bileşen tam da o sessiz başarısızlığı
// kapatıyor: kullanıcı ismi yazmıyor, listeden seçiyor.
//
// Kişi listesi ilk `@` yazılana kadar hiç okunmuyor (bkz. lib/actions/mentions.ts).

/** İmlecin hemen solundaki yazılmakta olan `@...` parçasını bulur. */
function activeMentionToken(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  // `@`den önce ya satır başı ya boşluk olmalı: "mail@adres" tetiklememeli.
  const prev = at > 0 ? before[at - 1] : " ";
  if (!/\s|[([]/.test(prev)) return null;
  const query = before.slice(at + 1);
  // İsimler boşluk içerdiği için tek boşluğa izin veriyoruz ("Yunus E"), ama
  // satır sonu ya da ikinci bir boşluk öneriyi kapatır.
  if (/\n/.test(query) || query.split(" ").length > 2) return null;
  return { start: at, query };
}

function matches(person: MentionablePerson, query: string): boolean {
  if (!query) return true;
  return person.name.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"));
}

export interface MentionTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value" | "defaultValue"> {
  /** Metnin sahibi ÇAĞIRAN. Form sıfırlaması, taslak saklama gibi işler orada. */
  value: string;
  onValueChange: (next: string) => void;
}

export default function MentionTextarea({
  value,
  onValueChange,
  className,
  onKeyDown,
  ...props
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [people, setPeople] = useState<MentionablePerson[] | null>(null);
  const requestedRef = useRef(false);
  const [token, setToken] = useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const suggestions = token && people ? people.filter((person) => matches(person, token.query)).slice(0, 6) : [];
  const open = token !== null && suggestions.length > 0;

  const loadPeople = useCallback(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    listMentionablePeopleAction()
      .then(setPeople)
      .catch(() => {
        // Öneri gelmezse kutu düz bir textarea gibi çalışmaya devam etsin —
        // yorum yazmak öneri listesine bağlı olmamalı.
        requestedRef.current = false;
      });
  }, []);

  function syncToken(target: HTMLTextAreaElement) {
    const next = activeMentionToken(target.value, target.selectionStart ?? target.value.length);
    setToken(next);
    setHighlight(0);
    if (next) loadPeople();
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onValueChange(event.target.value);
    syncToken(event.target);
  }

  function insert(person: MentionablePerson) {
    const textarea = ref.current;
    if (!textarea || !token) return;
    const caret = textarea.selectionStart ?? value.length;
    const next = `${value.slice(0, token.start)}@${person.name} ${value.slice(caret)}`;
    const nextCaret = token.start + person.name.length + 2;
    onValueChange(next);
    setToken(null);
    // Değer React state'inden geliyor; imleci bir sonraki boyamada geri koy.
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((index) => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insert(suggestions[highlight]);
        return;
      }
      if (event.key === "Escape") {
        // Yalnızca öneriyi kapat — pencereyi/formu kapatmasın.
        event.preventDefault();
        event.stopPropagation();
        setToken(null);
        return;
      }
    }
    onKeyDown?.(event);
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.parentElement?.contains(event.target as Node)) setToken(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="relative">
      <textarea
        {...props}
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={(event) => syncToken(event.currentTarget)}
        className={className}
        // ARIA 1.2 düzenlenebilir combobox deseni: `aria-expanded` yalnızca
        // combobox rolünde geçerli, textarea'nın örtük rolü (textbox) desteklemiyor.
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? "mention-suggestions" : undefined}
        aria-activedescendant={open ? `mention-option-${highlight}` : undefined}
      />
      {open && (
        <ul
          id="mention-suggestions"
          role="listbox"
          aria-label="Kişi önerileri"
          className="absolute bottom-full left-0 z-20 mb-1 w-full max-w-xs overflow-hidden rounded-xl border border-border-default bg-surface-elevated py-1 shadow-md"
        >
          {suggestions.map((person, index) => (
            <li key={person.id}>
              <button
                type="button"
                id={`mention-option-${index}`}
                role="option"
                aria-selected={index === highlight}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => insert(person)}
                onMouseEnter={() => setHighlight(index)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${
                  index === highlight
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-950/55 dark:text-brand-200"
                    : "text-secondary"
                }`}
              >
                <span className="text-muted">@</span>
                <span className="min-w-0 truncate">{person.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
