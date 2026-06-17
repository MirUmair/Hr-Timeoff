import type { Meta, StoryObj } from "@storybook/nextjs";

import { ManagerView } from "@/app/manager/manager-view";
import { QueryProvider } from "@/app/query-provider";
import {
  createTimeOffRequest,
  denyTimeOffRequest,
  listBalances,
  listTimeOffRequests,
  resetMockHcmDb,
} from "@/lib/hcm/mockDb";
import type { TimeOffRequestsResponse } from "@/lib/types/request";
import { buildStoryHandlers } from "@/stories/storybook-hcm";

const employeeIds = ["emp-1001", "emp-2002"];

function buildEmptyRequests(): TimeOffRequestsResponse {
  return {
    requests: [],
    generatedAt: "2026-06-16T00:00:00.000Z",
  };
}

const meta = {
  title: "Time Off/Manager View",
  component: ManagerView,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <QueryProvider>
        <Story />
      </QueryProvider>
    ),
  ],
} satisfies Meta<typeof ManagerView>;

export default meta;

type Story = StoryObj<typeof meta>;

function buildStoryProps(emptyRequests = false) {
  resetMockHcmDb();

  return {
    employeeIds,
    initialBalances: listBalances({ employeeIds }),
    initialRequests: emptyRequests ? buildEmptyRequests() : listTimeOffRequests(),
  };
}

function buildDeniedStoryProps() {
  resetMockHcmDb();
  const created = createTimeOffRequest({
    employeeId: "emp-1001",
    leaveType: "personal",
    startDate: "2026-07-18",
    endDate: "2026-07-18",
    requestedAmount: 4,
    reason: "Appointment",
    expectedBalanceVersion: 1,
  });

  if (created.ok) {
    denyTimeOffRequest({
      requestId: created.value.request.id,
      managerId: "mgr-9001",
      expectedRequestVersion: created.value.request.version,
      reason: "Coverage gap.",
    });
  }

  return {
    employeeIds,
    initialBalances: listBalances({ employeeIds }),
    initialRequests: listTimeOffRequests(),
  };
}

export const SeededQueue: Story = {
  args: buildStoryProps(),
  parameters: {
    msw: {
      handlers: buildStoryHandlers(),
    },
  },
  render: (args) => <ManagerView {...args} />,
};

export const EmptyQueue: Story = {
  args: buildStoryProps(true),
  parameters: {
    msw: {
      handlers: buildStoryHandlers(),
    },
  },
  render: (args) => <ManagerView {...args} />,
};

export const DeniedDecisionLogged: Story = {
  args: buildDeniedStoryProps(),
  parameters: {
    msw: {
      handlers: buildStoryHandlers(),
    },
  },
  render: (args) => <ManagerView {...args} />,
};
