import { AssignedUsersPage } from "@/components/workPlanner/AssignedUsersPage";

export const metadata = {
  title: "Assigned Users - Work Planner",
  description: "Manager view for assigned sales representatives, team work plans, and pending expense approvals.",
};

export default function Page() {
  return <AssignedUsersPage />;
}
