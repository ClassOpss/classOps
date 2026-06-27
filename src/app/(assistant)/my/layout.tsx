import { requireRole } from "@/lib/auth-guards";
import { signOutAction } from "@/actions/auth";
import { BottomNav } from "@/components/bottom-nav";

// Assistant area. Admin is also allowed (read-only impersonation per spec 7).
export default async function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("assistant", "admin");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-brand-fg">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M3 8l9-4 9 4-9 4-9-4Z M7 11v4c0 1 2.2 2 5 2s5-1 5-2v-4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="font-semibold tracking-tight">ClassOps</p>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5 pb-24">{children}</main>

      <BottomNav
        signOut={
          <form action={signOutAction} className="w-full">
            <button type="submit" className="flex w-full flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium text-faint hover:text-danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              </svg>
              Sign out
            </button>
          </form>
        }
      />
    </div>
  );
}
