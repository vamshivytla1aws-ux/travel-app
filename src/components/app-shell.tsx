import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { EnterpriseNav } from "@/components/enterprise/enterprise-nav";
import { EnterpriseBreadcrumbs } from "@/components/enterprise/enterprise-breadcrumbs";
import { AlertsBell } from "@/components/enterprise/alerts-bell";
import { WebOnly } from "@/components/enterprise/web-only";
import { APP_MODULES, clearSessionCookie, getSession, type AppModule } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

async function logout() {
  "use server";
  await clearSessionCookie();
}

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession();
  const allowedModules: AppModule[] = session
    ? session.role === "admin"
      ? [...APP_MODULES]
      : session.moduleAccess
    : ["dashboard"];

  return (
    <div className="premium-app min-h-screen">
      <EnterpriseNav
        allowedModules={allowedModules}
        userFullName={session?.fullName}
        userRole={session?.role}
      />
      <div className="lg:pl-[76px] xl:pl-[248px]">
        <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07111d]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="ml-12 flex min-w-0 items-center gap-3 lg:hidden">
              <Image src="/brand/jbt-mark.webp" alt="JBT" width={34} height={34} className="h-8 w-8 object-contain mix-blend-screen" />
              <span className="truncate text-xs font-semibold tracking-[0.16em] text-[#dcc078] uppercase">Operations</span>
            </div>
            <div className="hidden min-w-0 flex-1 md:block">
              <EnterpriseBreadcrumbs />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <AlertsBell />
              {session ? (
                <div className="hidden items-center gap-3 border-l border-white/10 pl-3 sm:flex">
                  <div className="text-right leading-tight">
                    <p className="max-w-40 truncate text-xs font-semibold text-[#f1ede4]">{session.fullName}</p>
                    <p className="text-[10px] tracking-[0.12em] text-[#8290a1] uppercase">{session.role.replace("_", " ")}</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-[#d9b966]/30 bg-[#d9b966]/10 font-display text-lg font-semibold text-[#e5c879]">
                    {session.fullName.charAt(0).toUpperCase()}
                  </span>
                  <WebOnly>
                    <form action={logout}>
                      <Button type="submit" size="icon" variant="ghost" className="text-[#8f9cac] hover:text-[#e3c477]" title="Logout">
                        <LogOut className="h-4 w-4" />
                        <span className="sr-only">Logout</span>
                      </Button>
                    </form>
                  </WebOnly>
                </div>
              ) : (
                <Link href="/login" className="text-xs font-semibold text-[#dfbd6e] hover:text-[#efd995]">Sign in</Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 md:py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
