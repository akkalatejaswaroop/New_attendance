import { requireRole, apiError } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["hod", "faculty", "student"]);
    if (user.role === "student") {
      if (!user.student_id) return Response.json({ sessions: [] });
      const result = await query(`SELECT s.id,s.subject_code,s.year,s.section,s.dept,s.opens_at,s.closes_at,
          c.name AS classroom_name,c.radius_m
        FROM public.campus_sessions s JOIN public.campus_classrooms c ON c.id=s.classroom_id
        JOIN public.students st ON st.id=$1 AND st.year=s.year AND st.section=s.section AND st.dept=s.dept AND st.status='active'
        WHERE s.status='open' AND now() BETWEEN s.opens_at AND s.closes_at
          AND NOT EXISTS (SELECT 1 FROM public.campus_attendance a WHERE a.session_id=s.id AND a.student_id=st.id)
        ORDER BY s.opens_at DESC LIMIT 50`, [user.student_id]);
      return Response.json({ sessions: result.rows });
    }
    if (user.role === "hod") {
      const result = await query(`SELECT s.id,s.subject_code,s.year,s.section,s.dept,s.opens_at,s.closes_at,s.status,c.name AS classroom_name
        FROM public.campus_sessions s JOIN public.campus_classrooms c ON c.id=s.classroom_id
        WHERE s.status='open' ORDER BY s.opens_at DESC LIMIT 100`);
      return Response.json({ sessions: result.rows });
    }
    const result = await query(`SELECT s.id,s.subject_code,s.year,s.section,s.dept,s.opens_at,s.closes_at,s.status,c.name AS classroom_name
      FROM public.campus_sessions s JOIN public.campus_classrooms c ON c.id=s.classroom_id
      WHERE s.status='open' AND (s.created_by=$1 OR EXISTS (
        SELECT 1 FROM public.campus_class_assignments ca WHERE ca.faculty_user_id=$1 AND ca.year=s.year
          AND ca.section=s.section AND ca.dept=s.dept AND ca.subject_code=s.subject_code AND ca.active=true
      )) ORDER BY s.opens_at DESC LIMIT 100`, [user.id]);
    return Response.json({ sessions: result.rows });
  } catch (error) { return apiError(error); }
}
