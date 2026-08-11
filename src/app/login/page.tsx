import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  searchParams: { error?: string };
};

export default function LoginPage({ searchParams }: Props) {
  const invalid = searchParams.error === "invalid";

  return (
    <div className="premium-app flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_68%_20%,rgba(217,185,102,.1),transparent_28rem)]" aria-hidden />
      <Card className="relative w-full max-w-md border-[#d9b966]/20 px-2 py-6 shadow-[0_35px_100px_rgba(0,0,0,.5)] sm:px-5">
        <CardHeader className="items-center text-center">
          <Image src="/brand/jai-bhavani-logo-horizontal.webp" alt="Jai Bhavani Travels" width={230} height={64} className="mb-5 h-auto w-[220px] object-contain mix-blend-screen" priority />
          <p className="text-[9px] font-bold tracking-[0.24em] text-[#b99a55] uppercase">Operations Control</p>
          <CardTitle className="font-display text-4xl">Welcome back</CardTitle>
          <p className="text-xs text-[#7f8d9e]">Sign in to continue to the transport control center.</p>
        </CardHeader>
        <CardContent>
          {invalid && (
            <p className="mb-3 rounded-lg border border-red-400/20 bg-red-400/[0.08] px-3 py-2 text-sm text-red-200">
              Invalid email or password.
            </p>
          )}
          <form action="/api/auth/login" method="post" className="grid gap-3">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
            <Button type="submit" size="lg" className="mt-2 w-full">Enter Control Center</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
