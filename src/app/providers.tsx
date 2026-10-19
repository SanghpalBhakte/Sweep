"use client";

import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { showErrorToast } from "@/lib/toast/toast";

function getUserSafeErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as any).message === "string"
  ) {
    const message = (error as any).message;

    if (message.includes("violates foreign key constraint")) {
      return "That selection is no longer valid. Please choose again.";
    }

    if (message.includes("schema cache")) {
      return "Sweep is temporarily out of sync. Please try again shortly.";
    }

    return message;
  }

  return "Something went wrong. Please try again.";
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            const skipToast = (mutation.options.meta as any)?.skipGlobalErrorToast;
            if (skipToast) return;
            showErrorToast(getUserSafeErrorMessage(error));
          },
        }),
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Toasts use the theme's paper card, not a fixed brown box, and sit just under the top bar */}
      <Toaster
        position="top-center"
        gutter={8}
        containerStyle={{ top: 68 }}
        toastOptions={{
          style: {
            borderRadius: "10px",
            background: "hsl(var(--card))",
            color: "hsl(var(--card-foreground))",
            border: "1px solid hsl(var(--border))",
            boxShadow: "var(--_shadow-popover)",
            fontSize: "14px",
            lineHeight: "1.4",
            padding: "10px 14px",
            maxWidth: "380px",
          },
          success: { iconTheme: { primary: "hsl(var(--success))", secondary: "hsl(var(--card))" } },
          error: { iconTheme: { primary: "hsl(var(--danger))", secondary: "hsl(var(--card))" } },
        }}
      />
    </QueryClientProvider>
  );
}
