import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/change-password");
  return <DashboardClient initialRole={user.role} initialEmail={user.email} />;
}
