import React from "react";
import { Badge } from "../ui/badge";

export function StatusBadge({ status }: { status?: string | null }) {
  const value = status ?? "unknown";
  const variant = value === "failed" || value === "expired"
    ? "destructive"
    : value === "active" || value === "processing"
    ? "default"
    : value === "completed" || value === "archived"
    ? "secondary"
    : "outline";
  return <Badge variant={variant}>{value}</Badge>;
}
