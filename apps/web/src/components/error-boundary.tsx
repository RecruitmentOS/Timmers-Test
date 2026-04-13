"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * React Error Boundary — catches component errors and shows a recovery UI
 * instead of a white screen.
 *
 * Wrap around the main app layout to catch any unhandled rendering errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[50vh] items-center justify-center p-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center max-w-md">
            <h2 className="text-lg font-semibold text-red-900">
              Er ging iets mis
            </h2>
            <p className="mt-2 text-sm text-red-700">
              Probeer de pagina te vernieuwen. Als het probleem aanhoudt, neem
              contact op met support.
            </p>
            <Button
              variant="outline"
              className="mt-4 border-red-300 text-red-800 hover:bg-red-100"
              onClick={() => window.location.reload()}
            >
              Opnieuw laden
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
