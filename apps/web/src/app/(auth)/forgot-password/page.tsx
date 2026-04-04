"use client";

import { useState } from "react";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="space-y-1 p-8 pb-0">
          <CardTitle className="text-2xl font-semibold">
            Check your email
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            We sent a password reset link to {email}
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
        <CardTitle className="text-2xl font-semibold">
          Reset your password
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Enter your email to receive a reset link
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
            {loading ? "Sending..." : "Send reset link"}
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
