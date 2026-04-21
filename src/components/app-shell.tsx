import { ReactNode } from "react";
import Link from "next/link";
import { EnterpriseNav } from "@/components/enterprise/enterprise-nav";
import { EnterpriseBreadcrumbs } from "@/components/enterprise/enterprise-breadcrumbs";
import { ThemeToggleButton } from "@/components/enterprise/theme-toggle-button";
import { WebOnly } from "@/components/enterprise/web-only";
import { APP_MODULES, clearSessionCookie, getSession, type AppModule } from "@/lib/auth";
import { enterpriseContainer } from "@/lib/ui-core";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen bg-[#efefef]">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#1f2331]">
        <div className={`${enterpriseContainer} space-y-2 py-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white">Jai Bhavani Travels Tracking System</h1>
            </div>
            <WebOnly>
              <div className="flex items-center gap-3 text-sm">
                <ThemeToggleButton />
                {session ? (
                  <>
                    <span className="text-slate-300">{session.fullName}</span>
                    <form action={logout}>
                      <Button
                        type="submit"
                        size="sm"
                        className="border border-amber-600/50 bg-amber-400 font-semibold !text-slate-900 shadow-sm hover:bg-amber-300 hover:!text-slate-950 dark:bg-amber-400 dark:!text-slate-900 dark:hover:bg-amber-300"
                      >
                        Logout
                      </Button>
                    </form>
                  </>
                ) : (
                  <Link href="/login" className="text-xs text-slate-200 hover:text-yellow-300">
                    Sign in
                  </Link>
                )}
              </div>
            </WebOnly>
          </div>
          <EnterpriseNav
            allowedModules={allowedModules}
            userFullName={session?.fullName}
            userRole={session?.role}
          />
          <EnterpriseBreadcrumbs />
        </div>
      </header>
      <main className={`${enterpriseContainer} py-6`}>{children}</main>
    </div>
  );
}
