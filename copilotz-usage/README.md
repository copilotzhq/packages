# Copilotz Usage

Reusable LLM and tool analytics for Admin or application dashboards. The UI consumes a `UsageDataSource`; authentication and tenant policy belong to the host.

```tsx
import { UsageAnalytics, UsageSummary } from "@copilotz/usage";
import { createUsageClient } from "@copilotz/usage/client";
import "@copilotz/usage/styles.css";

// Keep the source stable across renders.
const source = createUsageClient({ baseUrl: "/api/admin/usage" });

<UsageAnalytics source={source} onOpenThread={openThread} />;
// A compact view can use the summary returned by source.analytics().
<UsageSummary metrics={analytics.summary} kind="llm" />;
```

The client export reuses Copilotz's canonical browser client. Hosts install
`createUsageHttpAdapter()` inside the same authentication and authorization
boundary as their other endpoints. Admin includes the styles automatically;
standalone consumers import the stylesheet above. Add a `dark` class to an
ancestor to select the dark palette.

The full view includes UTC ranges and buckets, provider/model and tool filters,
weighted cache reuse, measurement coverage, sortable breakdowns, and paginated
attempts. Requests are cancelled and stale responses ignored when selections
change. Refresh is explicit.

Unknown measurements display as unreported, never as zero. Cache reuse divides
reported cache-read tokens by input tokens from attempts that report both;
coverage shows how many attempts contribute to that calculation. Tool execution
outcomes include deferred asks. Duration remains unreported when execution
records do not contain timing. No cost estimate is inferred from token counts.

Run `npm -w copilotz-usage test` from the packages workspace.
