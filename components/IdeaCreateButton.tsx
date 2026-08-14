"use client";

import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

export const OPEN_IDEA_DIALOG_EVENT = "idea-bank:open-create-dialog";

export default function IdeaCreateButton() {
  return (
    <Button
      type="button"
      aria-haspopup="dialog"
      onClick={() => window.dispatchEvent(new Event(OPEN_IDEA_DIALOG_EVENT))}
    >
      <Icon name="plus" className="size-4" />
      Yeni fikir
    </Button>
  );
}
