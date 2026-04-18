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
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          {invalid && (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Invalid email or password. The prefilled demo user only works on local dev; production
              needs a row in <code className="rounded bg-red-100 px-1">users</code> (seed or SQL).
            </p>
          )}
          <form action="/api/auth/login" method="post" className="grid gap-3">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue="admin@transport.local" required />
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" defaultValue="Admin@123" required />
            <Button type="submit">Login</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
