import { randomBytes, createHash } from "node:crypto";
import { requireRole, apiError } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(_request: Request, context: { params: { id:string } }) {
  try {
    const user = await requireRole(["hod","faculty"]);
    const session = await query<{id:string;created_by:string;status:string;closes_at:Date}>(
      "SELECT id,created_by,status,closes_at FROM public.campus_sessions WHERE id=$1", [context.params.id]
    );
    const s = session.rows[0];
    if (!s || s.status !== "open" || new Date(s.closes_at).getTime() <= Date.now()) {
      return Response.json({error:"Session is not open"}, {status:409});
    }
    if (user.role === "faculty" && s.created_by !== user.id) {
      return Response.json({error:"Only the session owner can rotate its QR"}, {status:403});
    }
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Math.min(Date.now()+45_000,new Date(s.closes_at).getTime()));
    await query(
      `INSERT INTO public.campus_qr_tokens(session_id,token_hash,expires_at,created_by)
       VALUES($1,$2,$3,$4)`, [s.id,tokenHash,expiresAt,user.id]
    );
    return Response.json({ token, expires_at:expiresAt.toISOString() });
  } catch (error) { return apiError(error); }
}
