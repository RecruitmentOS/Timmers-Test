// apps/web/src/components/intake/takeover-dialog.tsx
"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useIntakeTakeover, useIntakeManualReply } from "@/hooks/use-intake";

export function TakeoverDialog({ sessionId }: { sessionId: string }) {
  const takeover = useIntakeTakeover(sessionId);
  const reply = useIntakeManualReply(sessionId);
  const [text, setText] = React.useState("");
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Neem gesprek over</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Gesprek overnemen</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Bot pauzeert. Typ je antwoord, het wordt als WhatsApp-bericht verstuurd.</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuleren</Button>
          <Button
            disabled={!text.trim() || reply.isPending}
            onClick={async () => {
              await takeover.mutateAsync();
              await reply.mutateAsync(text);
              setText("");
              setOpen(false);
            }}
          >Versturen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
