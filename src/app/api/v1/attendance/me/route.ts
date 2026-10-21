import { requireRole, apiError } from "@/lib/auth";
import { query } from "@/lib/db";
export async function GET() {
  try {
    const user = await requireRole(["student"]);
    if (!user.student_id) return Response.json({error:"Student profile is not linked"}, {status:403});
    const result = await query(
      `SELECT a.id,a.status,a.marked_at,s.subject_code,s.year,s.section,s.dept,s.classroom_id
       FROM public.campus_attendance a JOIN public.campus_sessions s ON s.id=a.session_id
       WHERE a.student_id=$1 ORDER BY a.marked_at DESC LIMIT 200`, [user.student_id]
    );
    return Response.json({attendance:result.rows});
  } catch (error) { return apiError(error); }
}
