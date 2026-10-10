import React from "react";
import { X } from "lucide-react";
import type { ChatConfig } from "../../types/chatTypes";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface SpaceCreateFormProps {
  labels?: ChatConfig["labels"];
  inputRef?: React.Ref<HTMLInputElement>;
  name: string;
  onNameChange: (name: string) => void;
  working: boolean;
  onCreate: () => void;
  onCancel: () => void;
}

export function SpaceCreateForm({
  labels,
  inputRef,
  name,
  onNameChange,
  working,
  onCreate,
  onCancel,
}: SpaceCreateFormProps) {
  return (
    <div className="flex min-w-0 gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
      <Input
        ref={inputRef}
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        aria-label={labels?.spaceNamePlaceholder || "Space name"}
        placeholder={labels?.spaceNamePlaceholder || "Space name"}
        className="h-9 min-w-0 flex-1"
        disabled={working}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCreate();
          }
          if (event.key === "Escape") onCancel();
        }}
      />
      <Button
        type="button"
        size="sm"
        className="h-9"
        disabled={!name.trim() || working}
        onClick={onCreate}
      >
        {labels?.createSpaceConfirm || "Create"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label={labels?.cancel || "Cancel"}
        disabled={working}
        onClick={onCancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
