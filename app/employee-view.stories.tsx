import type { Meta, StoryObj } from "@storybook/nextjs";

import { EmployeeView } from "@/app/employee-view";
import { QueryProvider } from "@/app/query-provider";
import { listBalances, listTimeOffRequests, resetMockHcmDb } from "@/lib/hcm/mockDb";
import type { TimeOffRequestsResponse } from "@/lib/types/request";

const employeeIds = ["emp-1001", "emp-2002"];

function buildSeededRequests(empty = false): TimeOffRequestsResponse {
  if (empty) {
    return {
      requests: [],
      generatedAt: "2026-06-16T00:00:00.000Z",
    };
  }

  return listTimeOffRequests();
}

const meta = {
  title: "Time Off/Employee View",
  component: EmployeeView,
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
} satisfies Meta<typeof EmployeeView>;

export default meta;

type Story = StoryObj<typeof meta>;

function buildStoryProps(emptyRequests = false) {
  resetMockHcmDb();

  return {
    employeeIds,
    initialBalances: listBalances({ employeeIds }),
    initialRequests: buildSeededRequests(emptyRequests),
  };
}

export const SeededWorkspace: Story = {
  args: buildStoryProps(),
  render: (args) => <EmployeeView {...args} />,
};

export const EmptyRequestQueue: Story = {
  args: buildStoryProps(true),
  render: (args) => <EmployeeView {...args} />,
};
