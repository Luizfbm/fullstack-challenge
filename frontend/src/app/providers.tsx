import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { setApiAccessTokenProvider } from "../services/http-client";
import { queryClient } from "../services/query-client";
import { useAuthStore } from "../stores/auth-store";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  );
}

function AuthBootstrap({ children }: PropsWithChildren) {
  useEffect(() => {
    setApiAccessTokenProvider(() =>
      useAuthStore.getState().getAccessToken(),
    );
    void useAuthStore.getState().initialize();

    return () => setApiAccessTokenProvider(null);
  }, []);

  return children;
}
