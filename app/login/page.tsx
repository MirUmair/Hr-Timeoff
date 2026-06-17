import { LoginPanel } from "@/app/login/login-panel";
import { listDemoAccounts } from "@/lib/auth/demoSession";
import { getCurrentSession } from "@/lib/auth/serverSession";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

function getSafeNextPath(nextPath?: string): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const nextPath = getSafeNextPath(params.next);
  const session = await getCurrentSession();

  return (
    <LoginPanel
      accounts={listDemoAccounts()}
      currentSession={
        session
          ? {
              name: session.name,
              role: session.role,
              title: session.title,
            }
          : null
      }
      error={params.error}
      nextPath={nextPath}
    />
  );
}
