"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, sans-serif",
            gap: "1rem",
          }}
        >
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred. Please try again.</p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              cursor: "pointer",
              backgroundColor: "#f9fafb",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
