"use client";

import { useState, useEffect } from "react";

/**
 * Cookie consent banner — GDPR-01.
 * Checks localStorage for consent choice. If not set, shows a bottom-fixed banner.
 * v1 has no tracking scripts, so this records the consent decision only.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function accept(choice: "accepted" | "necessary") {
    localStorage.setItem("cookie-consent", choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t bg-white shadow-lg">
      <div className="mx-auto max-w-screen-lg px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-slate-700">
          Wij gebruiken cookies voor de werking van het platform.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => accept("necessary")}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Alleen noodzakelijk
          </button>
          <button
            onClick={() => accept("accepted")}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Accepteren
          </button>
        </div>
      </div>
    </div>
  );
}
