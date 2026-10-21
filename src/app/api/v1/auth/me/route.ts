import { currentUser } from "@/lib/auth";
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error:"Authentication required" }, { status:401 });
  return Response.json({ user: { id:user.id, email:user.email, role:user.role } });
}
