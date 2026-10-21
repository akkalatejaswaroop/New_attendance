import { query } from "@/lib/db";
export async function GET() {
  try {
    await query("SELECT 1");
    return Response.json({ status: "ok", database: "reachable" });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
