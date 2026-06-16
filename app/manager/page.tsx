import { ManagerView } from "@/app/manager/manager-view";
import { QueryProvider } from "@/app/query-provider";
import { listBalances, listTimeOffRequests } from "@/lib/hcm/mockDb";

export const dynamic = "force-dynamic";

const employeeIds = ["emp-1001", "emp-2002"];

export default function ManagerPage() {
  const initialBalances = listBalances({ employeeIds });
  const initialRequests = listTimeOffRequests();

  return (
    <QueryProvider>
      <ManagerView
        employeeIds={employeeIds}
        initialBalances={initialBalances}
        initialRequests={initialRequests}
      />
    </QueryProvider>
  );
}
