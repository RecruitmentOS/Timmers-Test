"use client";

import { useEffect, useRef } from "react";
import Shepherd from "shepherd.js";
import type { StepOptions, Tour } from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";
import { useProductTour } from "@/hooks/use-product-tour";

/** Custom styles for the tour overlay and popover */
const TOUR_CLASS = "recruitment-os-tour";

function getTourSteps(): StepOptions[] {
  return [
    {
      id: "welcome",
      title: "Welkom bij Recruitment OS!",
      text: "Laten we je rondleiden door de belangrijkste functies van het platform.",
      buttons: [
        {
          text: "Overslaan",
          action() {
            return (this as unknown as Tour).cancel();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Start rondleiding",
          action() {
            return (this as unknown as Tour).next();
          },
        },
      ],
    },
    {
      id: "dashboard",
      title: "Dashboard",
      text: "Dit is je dashboard met een overzicht van je werk: open vacatures, lopende sollicitaties en taken.",
      attachTo: { element: '[data-tour="tour-dashboard"]', on: "right" },
      buttons: [
        {
          text: "Vorige",
          action() {
            return (this as unknown as Tour).back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Volgende",
          action() {
            return (this as unknown as Tour).next();
          },
        },
      ],
    },
    {
      id: "vacatures",
      title: "Vacatures",
      text: "Hier beheer je al je vacatures. Maak nieuwe vacatures aan, bekijk sollicitaties en volg de voortgang.",
      attachTo: { element: '[data-tour="tour-vacatures"]', on: "right" },
      buttons: [
        {
          text: "Vorige",
          action() {
            return (this as unknown as Tour).back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Volgende",
          action() {
            return (this as unknown as Tour).next();
          },
        },
      ],
    },
    {
      id: "kandidaten",
      title: "Kandidaten",
      text: "Bekijk en zoek al je kandidaten. Filter op kwalificaties, locatie en beschikbaarheid.",
      attachTo: { element: '[data-tour="tour-kandidaten"]', on: "right" },
      buttons: [
        {
          text: "Vorige",
          action() {
            return (this as unknown as Tour).back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Volgende",
          action() {
            return (this as unknown as Tour).next();
          },
        },
      ],
    },
    {
      id: "instellingen",
      title: "Instellingen",
      text: "Configureer je organisatie, team, pipeline-fases, kwalificaties en facturatie.",
      attachTo: { element: '[data-tour="tour-instellingen"]', on: "right" },
      buttons: [
        {
          text: "Vorige",
          action() {
            return (this as unknown as Tour).back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Volgende",
          action() {
            return (this as unknown as Tour).next();
          },
        },
      ],
    },
    {
      id: "done",
      title: "Je bent klaar!",
      text: "Je kent nu de belangrijkste functies. Ga aan de slag en begin met recruiten!",
      buttons: [
        {
          text: "Afronden",
          action() {
            return (this as unknown as Tour).complete();
          },
        },
      ],
    },
  ];
}

/**
 * Product tour component that shows a guided walkthrough for new users.
 * Uses Shepherd.js to highlight key navigation items in the sidebar.
 * Only renders/triggers when the tour has not been completed yet.
 */
export function ProductTour() {
  const { shouldStart, markComplete, onTourStart } = useProductTour();
  const tourRef = useRef<Tour | null>(null);

  useEffect(() => {
    if (!shouldStart) return;

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        scrollTo: true,
        classes: TOUR_CLASS,
      },
    });

    tour.addSteps(getTourSteps());

    tour.on("complete", () => {
      markComplete();
    });

    tour.on("cancel", () => {
      markComplete();
    });

    tourRef.current = tour;
    onTourStart();
    tour.start();

    return () => {
      if (tour.isActive()) {
        tour.cancel();
      }
      tourRef.current = null;
    };
  }, [shouldStart, markComplete, onTourStart]);

  // Inject custom styles for the tour
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .${TOUR_CLASS} .shepherd-content {
        background: white;
        border-radius: 0.75rem;
        box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
      }
      .${TOUR_CLASS} .shepherd-header {
        background: white;
        padding: 1rem 1.25rem 0;
        border-radius: 0.75rem 0.75rem 0 0;
      }
      .${TOUR_CLASS} .shepherd-title {
        color: #0f172a;
        font-weight: 600;
        font-size: 1.125rem;
      }
      .${TOUR_CLASS} .shepherd-text {
        color: #475569;
        padding: 0.75rem 1.25rem;
        font-size: 0.875rem;
        line-height: 1.5;
      }
      .${TOUR_CLASS} .shepherd-footer {
        padding: 0 1.25rem 1rem;
        border-top: none;
      }
      .${TOUR_CLASS} .shepherd-button {
        background: #4f46e5;
        color: white;
        border-radius: 0.5rem;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        border: none;
        cursor: pointer;
        transition: background 150ms;
      }
      .${TOUR_CLASS} .shepherd-button:hover {
        background: #4338ca;
      }
      .${TOUR_CLASS} .shepherd-button-secondary {
        background: transparent;
        color: #64748b;
        border: 1px solid #e2e8f0;
      }
      .${TOUR_CLASS} .shepherd-button-secondary:hover {
        background: #f8fafc;
        color: #334155;
      }
      .${TOUR_CLASS} .shepherd-cancel-icon {
        color: #94a3b8;
      }
      .${TOUR_CLASS} .shepherd-cancel-icon:hover {
        color: #475569;
      }
      .shepherd-modal-overlay-container {
        z-index: 9998;
      }
      .shepherd-element {
        z-index: 9999;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
}
