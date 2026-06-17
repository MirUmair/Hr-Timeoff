import { AuthBadge } from "@/app/auth-badge";
import { EmployeeView } from "@/app/employee-view";
import { QueryProvider } from "@/app/query-provider";
import { requireEmployeeSession } from "@/lib/auth/serverSession";
import { listBalances, listTimeOffRequests } from "@/lib/hcm/mockDb";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requireEmployeeSession();
  const employeeIds = session.employeeIds;
  const initialBalances = listBalances({ employeeIds });
  const initialRequests = listTimeOffRequests(session.userId);

  return (
    <>
      <AuthBadge session={session} />
      <QueryProvider>
        <EmployeeView
          employeeIds={employeeIds}
          initialBalances={initialBalances}
          initialRequests={initialRequests}
        />
      </QueryProvider>
    </>
  );
}
