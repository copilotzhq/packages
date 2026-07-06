import React, { useMemo, useState } from "react";
import { AlertCircle, Check, Save } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

export function JsonPanel({
  minHeight = 280,
  onSave,
  title = "JSON",
  value,
}: {
  minHeight?: number;
  onSave?: (value: Record<string, unknown>) => Promise<void> | void;
  title?: string;
  value: unknown;
}) {
  const initialJson = useMemo(() => JSON.stringify(value ?? null, null, 2), [value]);
  const [draft, setDraft] = useState(initialJson);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setDraft(initialJson);
  }, [initialJson]);

  const handleSave = async () => {
    if (!onSave) return;
    setMessage(null);
    setIsSaving(true);
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      await onSave(parsed);
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid JSON");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {message === "Saved"
                ? <Check className="size-3 text-emerald-600" />
                : <AlertCircle className="size-3 text-destructive" />}
              {message}
            </span>
          )}
          {onSave && (
            <Button
              disabled={isSaving}
              onClick={() => void handleSave()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Save className="size-3" />
              Save
            </Button>
          )}
        </div>
      </div>
      <Textarea
        className="rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
        spellCheck={false}
        style={{ minHeight }}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        readOnly={!onSave}
      />
    </div>
  );
}
