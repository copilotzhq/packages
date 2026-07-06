import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  fetchCollectionItem,
  createCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
} from "../../adminService";
import type { AdminCollectionItem, ResolvedAdminConfig } from "../../types";

interface CollectionItemDetailViewProps {
  collection: string;
  itemId: string | null;
  config: ResolvedAdminConfig;
  namespace?: string;
  onBack: () => void;
  onDeleted?: () => void;
}

export const CollectionItemDetailView: React.FC<CollectionItemDetailViewProps> = ({
  collection,
  itemId,
  config,
  namespace,
  onBack,
  onDeleted,
}) => {
  const isNew = !itemId;
  const [editJson, setEditJson] = useState(isNew ? "{\n  \n}" : "");
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fetchOptions = {
    baseUrl: config.baseUrl,
    getRequestHeaders: config.getRequestHeaders,
  };

  const load = useCallback(async () => {
    if (!itemId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchCollectionItem(collection, itemId, namespace, fetchOptions);
      setEditJson(JSON.stringify(result, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load item");
    } finally {
      setIsLoading(false);
    }
  }, [collection, itemId, namespace, config.baseUrl, config.getRequestHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const parsed = JSON.parse(editJson) as Record<string, unknown>;
      if (isNew) {
        const created = await createCollectionItem(collection, parsed, namespace, fetchOptions);
        setEditJson(JSON.stringify(created, null, 2));
        setSaveMessage("Created successfully");
      } else {
        const updated = await updateCollectionItem(collection, itemId!, parsed, namespace, fetchOptions);
        setEditJson(JSON.stringify(updated, null, 2));
        setSaveMessage("Saved successfully");
      }
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemId) return;
    if (!window.confirm(`Delete this item from ${collection}?`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteCollectionItem(collection, itemId, namespace, fetchOptions);
      onDeleted?.();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
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
          <h2 className="text-xl font-semibold truncate capitalize">
            {isNew ? `New ${collection} item` : `${collection} / ${itemId}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span className="text-xs text-emerald-600">{saveMessage}</span>
          )}
          {!isNew && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-3 w-3" />
              )}
              Delete
            </Button>
          )}
          <Button size="sm" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-2 h-3 w-3" />
            )}
            {isNew ? "Create" : "Save"}
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
