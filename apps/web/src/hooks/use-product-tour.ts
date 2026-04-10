"use client";

import { useCallback, useEffect, useState } from "react";

export const TOUR_COMPLETED_KEY = "recruitment-os:onboarding-completed";

/**
 * Hook to manage the product tour lifecycle.
 * Checks localStorage to determine if the tour should auto-start.
 * Returns controls to manually start the tour and check active state.
 */
export function useProductTour() {
  const [shouldStart, setShouldStart] = useState(false);
  const [isActive, setIsActive] = useState(false);

  // Check on mount if tour should auto-trigger
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tourCompleted = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!tourCompleted) {
      // Delay slightly so sidebar DOM is ready for Shepherd to attach
      const timer = setTimeout(() => setShouldStart(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const markComplete = useCallback(() => {
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    setShouldStart(false);
    setIsActive(false);
  }, []);

  const startTour = useCallback(() => {
    setShouldStart(true);
    setIsActive(true);
  }, []);

  const onTourStart = useCallback(() => {
    setIsActive(true);
  }, []);

  return {
    shouldStart,
    isActive,
    startTour,
    markComplete,
    onTourStart,
  };
}
