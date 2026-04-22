// apps/web/src/components/intake/session-transcript.tsx
"use client";
import type { IntakeMessage } from "@recruitment-os/types";
import { format } from "date-fns";

export function SessionTranscript({ messages }: { messages: IntakeMessage[] }) {
  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-50 overflow-y-auto">
      {messages.map((m) => {
        const isOutbound = m.direction === "outbound";
        return (
          <div key={m.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xs px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                isOutbound
                  ? m.isFromBot
                    ? "bg-blue-100 text-blue-900"
                    : "bg-green-100 text-green-900"
                  : "bg-white text-slate-900 border"
              }`}
            >
              <p>{m.body}</p>
              <p className="text-[10px] mt-1 opacity-60">
                {isOutbound ? (m.isFromBot ? "bot" : "recruiter") : "kandidaat"} · {format(new Date(m.sentAt), "HH:mm")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
