import React from "react";
import type {
  UsageAttempt,
  UsageDataSource,
  UsageFilters,
} from "@copilotz/copilotz/usage/client";
import { date, duration, number } from "../formatting";
import { latestRequest } from "../data/latest";
export function UsageAttempts(
  { source, filters, onOpenThread, refreshKey }: {
    source: UsageDataSource;
    filters: UsageFilters;
    onOpenThread?: (id: string) => void;
    refreshKey?: unknown;
  },
) {
  const [items, setItems] = React.useState<UsageAttempt[]>([]);
  const [next, setNext] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requests = React.useRef(latestRequest());
  React.useEffect(() => {
    requests.current.cancel();
    setItems([]);
    setNext(null);
    setLoaded(false);
    setLoading(false);
    setError(null);
    return () => requests.current.cancel();
  }, [source, filters, refreshKey]);
  async function load() {
    if (loading) return;
    const request = requests.current.start();
    setLoading(true);
    setError(null);
    try {
      const page = await source.attempts({
        filters,
        after: next ?? undefined,
        limit: 30,
        signal: request.signal,
      });
      if (!request.isCurrent()) return;
      setItems((old) =>
        next
          ? [
            ...old,
            ...page.items.filter((item) =>
              !old.some((existing) => existing.id === item.id)
            ),
          ]
          : page.items
      );
      setNext(page.pageInfo.hasMore ? page.pageInfo.next : null);
      setLoaded(true);
    } catch (cause) {
      if (request.isCurrent()) {
        setError(
          cause instanceof Error ? cause.message : "Unable to load attempts.",
        );
      }
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }
  return (
    <section className="cu-panel">
      <div className="cu-panel-heading">
        <div>
          <h3>
            {filters.kind === "llm"
              ? "Provider attempts"
              : "Individual executions"}
          </h3>
          <p>Inspect outcomes and attribution for this selection.</p>
        </div>
        {!loaded && (
          <button
            className="cu-button"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Loading…" : "Inspect attempts"}
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="cu-error">
          {error}{" "}
          <button className="cu-button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div className="cu-table-scroll">
          <table className="cu-table">
            <thead>
              <tr>
                <th>Time · UTC</th>
                <th>
                  {filters.kind === "llm" ? "Model / connection" : "Tool"}
                </th>
                <th>Outcome</th>
                <th>Agent</th>
                <th>
                  {filters.kind === "llm" ? "Input / output" : "Duration"}
                </th>
                <th>Thread</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{date(item.occurredAt)}</td>
                  <td>
                    {item.model ?? item.resource ?? "Not reported"}
                    {item.connection && <small>{item.connection}</small>}
                  </td>
                  <td>
                    <span className={`cu-status cu-status-${item.status}`}>
                      {item.status ?? "Not reported"}
                    </span>
                  </td>
                  <td>{item.agentId ?? "Not reported"}</td>
                  <td>
                    {filters.kind === "llm"
                      ? `${number(item.inputTokens)} / ${
                        number(item.outputTokens)
                      }`
                      : duration(item.durationMs)}
                  </td>
                  <td>
                    {item.threadId && onOpenThread
                      ? (
                        <button
                          className="cu-row-link"
                          onClick={() => onOpenThread(item.threadId!)}
                        >
                          Open thread ↗
                        </button>
                      )
                      : item.threadId ?? "Not reported"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loaded && items.length === 0 && (
        <p className="cu-empty">No attempts match these filters.</p>
      )}
      {next && (
        <div className="cu-pagination">
          <span>{number(items.length)} loaded</span>
          <button
            className="cu-button"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}
