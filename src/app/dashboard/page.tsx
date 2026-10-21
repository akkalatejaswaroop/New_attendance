import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/change-password");
  return <main>
    <span className="pill">{user.role.toUpperCase()}</span>
    <h1>Welcome to CampusAttend</h1>
    <p>Signed in as {user.email}</p>
    {user.role === "hod" && <section className="cards"><article className="card"><h2>Student roster</h2><p>Import and validate student data through the HOD-only API.</p></article><article className="card"><h2>Reports</h2><p>Attendance reporting and audited corrections are next in the build.</p></article></section>}
    {user.role === "faculty" && <section className="card"><h2>Faculty workspace</h2><p>Session creation and QR display APIs are available for integration with the classroom UI.</p></section>}
    {user.role === "student" && <section className="card"><h2>Student workspace</h2><p>Attendance history API is available. The mobile QR scanner and location permission flow need device integration.</p></section>}
    <form action="/api/v1/auth/logout" method="post" style={{ marginTop: 24 }}><button type="submit" style={{ background: "#172033" }}>Sign out</button></form>
  </main>;
}
