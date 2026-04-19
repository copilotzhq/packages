import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, Search, Database } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { fetchCollectionItems } from "../../adminService";
import type { AdminCollectionItem, ResolvedAdminConfig } from "../../types";

interface CollectionItemsViewProps {
  collection: string;
  config: ResolvedAdminConfig;
  namespace?: string;
  onItemClick?: (itemId: string) => void;
  onCreateNew?: () => void;
}

export const CollectionItemsView: React.FC<CollectionItemsViewProps> = ({
  collection,
  config,
  namespace,
  onItemClick,
  onCreateNew,
}) => {
  const [items, setItems] = useState<AdminCollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = {
    baseUrl: config.baseUrl,
    getRequestHeaders: config.getRequestHeaders,
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchCollectionItems(
        collection,
        { search: search || undefined, namespace, limit: 50 },
        fetchOptions,
      );
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setIsLoading(false);
    }
  }, [collection, search, namespace, config.baseUrl, config.getRequestHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const getItemId = (item: AdminCollectionItem): string => {
    return String(item.id ?? item._id ?? JSON.stringify(item).slice(0, 40));
  };

  const getItemPreview = (item: AdminCollectionItem): string => {
    const { id, _id, ...rest } = item as Record<string, unknown>;
    const name = item.name ?? item.title ?? item.displayName ?? item.label;
    if (typeof name === "string") return name;
    const keys = Object.keys(rest);
    if (keys.length === 0) return "(empty)";
    return keys.slice(0, 3).map((k) => `${k}: ${JSON.stringify(rest[k])?.slice(0, 30)}`).join(", ");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold capitalize">{collection}</h2>
        {onCreateNew && (
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="mr-2 h-3 w-3" /> New
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={`Search ${collection}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Database className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search ? config.labels.noResults : `No items in ${collection}`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => {
            const itemId = getItemId(item);
            return (
              <div
                key={itemId + idx}
                className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={() => onItemClick?.(itemId)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium font-mono text-sm truncate">{itemId}</p>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {getItemPreview(item)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
