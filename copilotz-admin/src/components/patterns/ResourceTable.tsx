import React from "react";
import { cn } from "../../lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { EmptyState } from "./EmptyState";

export interface ResourceTableColumn<T> {
  id: string;
  header: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  render: (row: T) => React.ReactNode;
}

export function ResourceTable<T>({
  columns,
  empty,
  getRowKey,
  onRowClick,
  rows,
}: {
  columns: Array<ResourceTableColumn<T>>;
  empty?: React.ReactNode;
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  rows: T[];
}) {
  if (rows.length === 0) {
    return (
      <>
        {empty ?? (
          <EmptyState
            title="No records"
            description="Records will appear here when data is available."
          />
        )}
      </>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                className={cn(
                  column.align === "right" && "text-right",
                  column.className,
                )}
                key={column.id}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              className={onRowClick ? "cursor-pointer" : undefined}
              key={getRowKey(row, index)}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <TableCell
                  className={cn(
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                  key={column.id}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
