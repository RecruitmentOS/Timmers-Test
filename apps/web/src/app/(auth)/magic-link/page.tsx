"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Handle callback with token
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setVerifying(true);
      authClient
        .magicLink.verify({ query: { token } })
        .then(() => {
          router.push("/portal");
        })
        .catch((err: any) => {
          setError(err.message || "Invalid or expired magic link");
          setVerifying(false);
        });
    }
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authClient.signIn.magicLink({ email });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="space-y-1 p-8 pb-0">
          <CardTitle className="text-2xl font-semibold">Verifying...</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Please wait while we verify your magic link
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="space-y-1 p-8 pb-0">
          <CardTitle className="text-2xl font-semibold">
            Check your email
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            We sent an access link to {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-6">
          <Link
            href="/login"
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm shadow-sm">
      <CardHeader className="space-y-1 p-8 pb-0">
        <CardTitle className="text-2xl font-semibold">Magic link</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Enter your email to receive an access link
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs text-gray-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Sending..." : "Send magic link"}
          </Button>
          <div className="text-center text-sm">
            <Link
              href="/login"
              className="text-indigo-600 hover:text-indigo-700"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MagicLinkContent />
    </Suspense>
  );
}
