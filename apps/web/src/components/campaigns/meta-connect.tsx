"use client";

import { useState } from "react";
import {
  useMetaStatus,
  useConnectMeta,
  useDisconnectMeta,
} from "@/hooks/use-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export function MetaConnect() {
  const { data: status, isLoading } = useMetaStatus();
  const connectMutation = useConnectMeta();
  const disconnectMutation = useDisconnectMeta();

  const [adAccountId, setAdAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const isConnected = !!status;

  const handleConnect = async () => {
    if (!adAccountId || !accessToken) return;
    await connectMutation.mutateAsync({ adAccountId, accessToken });
    setAdAccountId("");
    setAccessToken("");
  };

  const handleDisconnect = async () => {
    await disconnectMutation.mutateAsync();
  };

  // Token expiry warning
  let expiryWarning: React.ReactNode = null;
  if (status?.tokenExpiresAt) {
    const expiresAt = new Date(status.tokenExpiresAt);
    const daysUntilExpiry = Math.ceil(
      (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 3) {
      expiryWarning = (
        <div className="flex items-center gap-2 bg-red-50 text-red-800 text-sm p-3 rounded mt-3">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>
            Token verloopt over {daysUntilExpiry} dag
            {daysUntilExpiry !== 1 ? "en" : ""}. Vernieuw het token zo snel
            mogelijk.
          </span>
        </div>
      );
    } else if (daysUntilExpiry <= 14) {
      expiryWarning = (
        <div className="flex items-center gap-2 bg-yellow-50 text-yellow-800 text-sm p-3 rounded mt-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Token verloopt over {daysUntilExpiry} dagen. Plan een vernieuwing
            in.
          </span>
        </div>
      );
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Laden...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta Ads koppeling</CardTitle>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>
                Verbonden met advertentie-account:{" "}
                <code className="bg-slate-100 px-1 rounded text-xs">
                  {status!.metaAdAccountId}
                </code>
              </span>
            </div>
            {expiryWarning}
            <Button
              variant="destructive"
              size="sm"
              className="mt-4"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? "Ontkoppelen..." : "Ontkoppelen"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="meta-account">Meta Ad Account ID</Label>
              <Input
                id="meta-account"
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
                placeholder="act_123456789"
              />
            </div>
            <div>
              <Label htmlFor="meta-token">Access Token</Label>
              <Input
                id="meta-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Token van Meta Business Manager"
              />
            </div>
            <Button
              onClick={handleConnect}
              disabled={
                !adAccountId ||
                !accessToken ||
                connectMutation.isPending
              }
            >
              {connectMutation.isPending ? "Verbinden..." : "Verbinden"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
