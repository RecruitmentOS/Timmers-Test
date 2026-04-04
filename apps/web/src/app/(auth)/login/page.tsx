"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, useSession, organization } from "@/lib/auth-client";
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message || "Failed to sign in");
        setLoading(false);
        return;
      }

      // After login, auto-set active organization if needed (handle pitfall #7)
      try {
        const orgs = await organization.list();
        if (orgs.data && orgs.data.length > 0) {
          await organization.setActive({
            organizationId: orgs.data[0].id,
          });
        }
      } catch {
        // Non-blocking: user may not have any organization yet
      }

      // Role-based redirect per AUTH-04
      const user = result.data?.user as Record<string, unknown> | undefined;
      const role = user?.role as string | undefined;

      if (role === "client_viewer") {
        router.push("/portal");
      } else if (role === "agent") {
        router.push("/agent");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-sm">
      <CardHeader className="space-y-1 p-8 pb-0">
        <CardTitle className="text-2xl font-semibold">
          Sign in to your account
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Enter your email and password to continue
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
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs text-gray-700">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <Link
              href="/forgot-password"
              className="text-indigo-600 hover:text-indigo-700"
            >
              Forgot your password?
            </Link>
            <Link
              href="/register"
              className="text-indigo-600 hover:text-indigo-700"
            >
              Create account
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
