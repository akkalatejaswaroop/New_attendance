import { createHash } from "node:crypto";
import { z } from "zod";
import { requireRole, apiError } from "@/lib/auth";
import { pool } from "@/lib/db";
import { distanceMeters, validCoordinates } from "@/lib/geo";

const schema = z.object({
  session_id:z.string().uuid(), qr_token:z.string().min(20).max(200),
  lat:z.number(), lng:z.number(), accuracy_m:z.number()
});

export async function POST(request: Request) {
  let client;
  try {
    const user = await requireRole(["student"]);
    if (!user.student_id) return Response.json({error:"Student profile is not linked"}, {status:403});
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || !validCoordinates(parsed.data?.lat,parsed.data?.lng,parsed.data?.accuracy_m)) {
      return Response.json({error:"Invalid attendance request or location accuracy"}, {status:400});
    }
    const b = parsed.data;
    if (b.accuracy_m > 50) return Response.json({error:"Location accuracy is too low; retry outdoors or near a window"}, {status:422});
    client = await pool.connect();
    await client.query("BEGIN");
    const session = await client.query(
      `SELECT s.id,s.year,s.section,s.dept,s.classroom_id,s.opens_at,s.closes_at,s.status,
              c.latitude,c.longitude,c.radius_m
       FROM public.campus_sessions s JOIN public.campus_classrooms c ON c.id=s.classroom_id
       JOIN public.students st ON st.id=$2 AND st.year=s.year AND st.section=s.section AND st.dept=s.dept AND st.status='active'
       WHERE s.id=$1 FOR UPDATE OF s`,
      [b.session_id,user.student_id]
    );
    const s = session.rows[0];
    const now = new Date();
    if (!s || s.status !== "open" || now < new Date(s.opens_at) || now > new Date(s.closes_at)) {
      await client.query("ROLLBACK");
      return Response.json({error:"Session unavailable for this student or outside the attendance window"}, {status:409});
    }
    const tokenHash = createHash("sha256").update(b.qr_token).digest("hex");
    const tokenResult = await client.query(
      `SELECT id FROM public.campus_qr_tokens
       WHERE session_id=$1 AND token_hash=$2 AND expires_at > now()
       FOR SHARE`, [s.id,tokenHash]
    );
    if (!tokenResult.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({error:"QR token expired or already used"}, {status:409});
    }
    const distance = distanceMeters({lat:b.lat,lng:b.lng},{lat:Number(s.latitude),lng:Number(s.longitude)});
    if (distance > Number(s.radius_m)) {
      await client.query("ROLLBACK");
      return Response.json({error:"Outside the configured classroom boundary",distance_m:Math.round(distance)}, {status:403});
    }
    const already = await client.query(
      "SELECT 1 FROM public.campus_attendance WHERE session_id=$1 AND student_id=$2",
      [s.id,user.student_id]
    );
    if (already.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({error:"Attendance already recorded"}, {status:409});
    }
    await client.query(
      `INSERT INTO public.campus_attendance
       (session_id,student_id,status,marked_at,latitude,longitude,accuracy_m,distance_m,verification_method)
       VALUES($1,$2,'present',now(),$3,$4,$5,$6,'qr_gps')`,
      [s.id,user.student_id,b.lat,b.lng,b.accuracy_m,Math.round(distance)]
    );
    await client.query("COMMIT");
    return Response.json({status:"present",distance_m:Math.round(distance),marked_at:now.toISOString()},{status:201});
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(()=>{});
    return apiError(error);
  } finally { client?.release(); }
}
