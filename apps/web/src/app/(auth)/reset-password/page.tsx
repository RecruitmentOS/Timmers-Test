"use client";

import React, { useState, Suspense } from "react";
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

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="space-y-1 p-8 pb-0">
          <CardTitle className="text-2xl font-semibold">Invalid link</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Invalid or missing reset token
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-6">
          <Link
            href="/forgot-password"
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            Request a new reset link
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await authClient.resetPassword({ token: token!, newPassword });
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Token expired or invalid");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="space-y-1 p-8 pb-0">
          <CardTitle className="text-2xl font-semibold">
            Password reset successfully
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Redirecting you to sign in...
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
          Set new password
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Enter your new password below
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
            <Label htmlFor="newPassword" className="text-xs text-gray-700">
              New password
            </Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-xs text-gray-700"
            >
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Resetting..." : "Reset password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
