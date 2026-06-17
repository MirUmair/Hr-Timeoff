import { AuthBadge } from "@/app/auth-badge";
import { ManagerView } from "@/app/manager/manager-view";
import { QueryProvider } from "@/app/query-provider";
import { requireManagerSession } from "@/lib/auth/serverSession";
import { listBalances, listTimeOffRequests } from "@/lib/hcm/mockDb";

export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  const session = await requireManagerSession();
  const employeeIds = session.employeeIds;
  const initialBalances = listBalances({ employeeIds });
  const initialRequests = listTimeOffRequests();

  return (
    <>
      <AuthBadge session={session} />
      <QueryProvider>
        <ManagerView
          employeeIds={employeeIds}
          initialBalances={initialBalances}
          initialRequests={initialRequests}
        />
      </QueryProvider>
    </>
  );
}
