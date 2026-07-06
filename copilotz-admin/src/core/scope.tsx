import React, { createContext, useContext } from "react";
import type { AdminRuntimeContext } from "./types";

const AdminContext = createContext<AdminRuntimeContext | null>(null);

export function AdminProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AdminRuntimeContext;
}) {
  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminRuntimeContext {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used inside CopilotzAdmin");
  }
  return context;
}
