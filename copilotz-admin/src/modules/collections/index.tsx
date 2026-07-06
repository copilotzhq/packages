import React from "react";
import { Database, Plus, Trash2 } from "lucide-react";
import type { AdminCollectionItem } from "../../api/types";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";
import { Button } from "../../components/ui/button";
import {
  EmptyState,
  FilterBar,
  JsonPanel,
  PageHeader,
  ResourceTable,
} from "../../components/patterns";

export function collectionsModule(): AdminModule {
  return {
    group: "data",
    icon: Database,
    id: "collections",
    label: "Collections",
    navItems: [{
      group: "data",
      icon: Database,
      id: "collections",
      label: "Collections",
      order: 20,
      routeId: "collections",
    }],
    routes: [
      {
        id: "collections",
        title: "Collections",
        render: (context) => <CollectionsPage context={context} />,
      },
      {
        id: "collections.detail",
        title: "Collection Item",
        render: (context) => <CollectionDetailPage context={context} />,
      },
    ],
  };
}

function CollectionsPage({ context }: { context: AdminRuntimeContext }) {
  const [collections, setCollections] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [items, setItems] = React.useState<AdminCollectionItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void context.client.listCollections().then((names) => {
      if (!active) return;
      setCollections(names);
      setSelected((current) => current ?? names[0] ?? null);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Failed to load collections");
    });
    return () => {
      active = false;
    };
  }, [context.client, context.refreshKey]);

  React.useEffect(() => {
    if (!selected) return;
    let active = true;
    setError(null);
    void context.client.listCollectionItems(selected, {
      limit: 50,
      namespace: context.scope.namespace || undefined,
      search: search || undefined,
    }).then((next) => {
      if (active) setItems(next);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Failed to load collection items");
    });
    return () => {
      active = false;
    };
  }, [context.client, context.refreshKey, context.scope.namespace, search, selected]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Collections"
        description="Schema-aware collection browsing with advanced JSON fallback for records that do not have custom editors."
        actions={
          selected && (
            <Button
              onClick={() =>
                context.navigate("collections.detail", { collection: selected })}
              size="sm"
              type="button"
            >
              <Plus className="size-3" />
              New
            </Button>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Collections
          </div>
          <div className="max-h-[620px] overflow-auto p-1">
            {collections.map((collection) => (
              <button
                className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm ${
                  selected === collection ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                }`}
                key={collection}
                onClick={() => setSelected(collection)}
                type="button"
              >
                {collection}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <FilterBar
            onSearchChange={setSearch}
            searchPlaceholder={`Search ${selected ?? "collection"}...`}
            searchValue={search}
          />
          {error ? (
            <EmptyState title="Unable to load collection" description={error} />
          ) : selected ? (
            <ResourceTable
              rows={items}
              getRowKey={(item, index) => `${getItemId(item)}:${index}`}
              onRowClick={(item) =>
                context.navigate("collections.detail", {
                  collection: selected,
                  itemId: getItemId(item),
                })}
              empty={
                <EmptyState
                  icon={Database}
                  title={`No ${selected} records`}
                  description="Create a record or adjust the current filters."
                />
              }
              columns={[
                {
                  id: "id",
                  header: "ID",
                  render: (item) => (
                    <div className="max-w-sm truncate font-mono text-xs">
                      {getItemId(item)}
                    </div>
                  ),
                },
                {
                  id: "preview",
                  header: "Preview",
                  render: (item) => (
                    <div className="max-w-xl truncate text-sm">
                      {getItemPreview(item)}
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState title="No collections" />
          )}
        </div>
      </div>
    </div>
  );
}

function CollectionDetailPage({ context }: { context: AdminRuntimeContext }) {
  const collection = context.route.params?.collection;
  const itemId = context.route.params?.itemId ?? null;
  const [item, setItem] = React.useState<AdminCollectionItem | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const isNew = !itemId;

  React.useEffect(() => {
    if (!collection || !itemId) {
      setItem(null);
      return;
    }
    let active = true;
    setError(null);
    void context.client.getCollectionItem(collection, itemId, {
      namespace: context.scope.namespace || undefined,
    }).then((next) => {
      if (active) setItem(next);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Failed to load item");
    });
    return () => {
      active = false;
    };
  }, [collection, context.client, context.refreshKey, context.scope.namespace, itemId]);

  if (!collection) return <EmptyState title="Collection not selected" />;
  if (error) return <EmptyState title="Unable to load item" description={error} />;

  const Editor = context.collectionEditors[collection];
  const save = async (value: Record<string, unknown>) => {
    if (isNew) {
      const created = await context.client.createCollectionItem(collection, value, {
        namespace: context.scope.namespace || undefined,
      });
      setItem(created);
      context.navigate("collections.detail", {
        collection,
        itemId: getItemId(created),
      });
      return;
    }
    if (!itemId) return;
    const updated = await context.client.updateCollectionItem(collection, itemId, value, {
      namespace: context.scope.namespace || undefined,
    });
    setItem(updated);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNew ? `New ${collection}` : `${collection} / ${itemId}`}
        description="Schema-aware editors can override this view. Advanced JSON remains available as a fallback."
        actions={
          <div className="flex items-center gap-2">
            {!isNew && itemId && (
              <Button
                onClick={() => {
                  void context.client.deleteCollectionItem(collection, itemId, {
                    namespace: context.scope.namespace || undefined,
                  }).then(() => context.navigate("collections"));
                }}
                size="sm"
                type="button"
                variant="destructive"
              >
                <Trash2 className="size-3" />
                Delete
              </Button>
            )}
            <Button
              onClick={() => context.navigate("collections")}
              size="sm"
              type="button"
              variant="outline"
            >
              Back
            </Button>
          </div>
        }
      />
      {Editor
        ? (
          <Editor
            collection={collection}
            context={context}
            isNew={isNew}
            itemId={itemId}
            value={item}
            onSaved={setItem}
            onDeleted={() => context.navigate("collections")}
          />
        )
        : (
          <JsonPanel
            title="Advanced JSON"
            value={item ?? { id: "" }}
            onSave={save}
            minHeight={520}
          />
        )}
    </div>
  );
}

function getItemId(item: AdminCollectionItem): string {
  return String(item.id ?? item._id ?? "");
}

function getItemPreview(item: AdminCollectionItem): string {
  const name = item.name ?? item.title ?? item.displayName ?? item.label;
  if (typeof name === "string") return name;
  const keys = Object.keys(item).filter((key) => key !== "id" && key !== "_id");
  if (keys.length === 0) return "(empty)";
  return keys.slice(0, 4).map((key) =>
    `${key}: ${JSON.stringify(item[key])?.slice(0, 48)}`
  ).join(", ");
}
