import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "../ui/button";
import { fetchParticipantDetail, updateParticipant } from "../../adminService";
import type { AdminParticipantDetail, ResolvedAdminConfig } from "../../types";

interface ParticipantDetailViewProps {
  participantId: string;
  config: ResolvedAdminConfig;
  onBack: () => void;
}

export const ParticipantDetailView: React.FC<ParticipantDetailViewProps> = ({
  participantId,
  config,
  onBack,
}) => {
  const [data, setData] = useState<AdminParticipantDetail | null>(null);
  const [editJson, setEditJson] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fetchOptions = {
    baseUrl: config.baseUrl,
    getRequestHeaders: config.getRequestHeaders,
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchParticipantDetail(participantId, fetchOptions);
      setData(result);
      setEditJson(JSON.stringify(result, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load participant");
    } finally {
      setIsLoading(false);
    }
  }, [participantId, config.baseUrl, config.getRequestHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const parsed = JSON.parse(editJson) as Record<string, unknown>;
      const updated = await updateParticipant(participantId, parsed, fetchOptions);
      setData(updated);
      setEditJson(JSON.stringify(updated, null, 2));
      setSaveMessage("Saved successfully");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold truncate">{participantId}</h2>
          <p className="text-sm text-muted-foreground">Participant Detail</p>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span className="text-xs text-emerald-600">{saveMessage}</span>
          )}
          <Button size="sm" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-2 h-3 w-3" />
            )}
            Save
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <textarea
          className="w-full min-h-[400px] p-4 font-mono text-sm bg-transparent resize-y focus:outline-none"
          value={editJson}
          onChange={(e) => setEditJson(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
};
