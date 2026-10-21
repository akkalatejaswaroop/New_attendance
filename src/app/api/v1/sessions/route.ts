import { z } from "zod";
import { requireRole, apiError } from "@/lib/auth";
import { query } from "@/lib/db";

const schema = z.object({
  year: z.number().int().min(1).max(4),
  section: z.string().trim().min(1).max(20),
  dept: z.string().trim().min(1).max(80).default("CSE-AIML"),
  subject_code: z.string().trim().min(1).max(40),
  classroom_id: z.string().uuid(),
  opens_at: z.string().datetime(),
  closes_at: z.string().datetime()
}).refine(x => new Date(x.closes_at) > new Date(x.opens_at), "closes_at must follow opens_at");

export async function POST(request: Request) {
  try {
    const user = await requireRole(["hod","faculty"]);
    const body = schema.parse(await request.json());
    if (user.role === "faculty") {
      const assigned = await query(
        `SELECT 1 FROM public.campus_class_assignments
         WHERE faculty_user_id=$1 AND year=$2 AND section=$3 AND dept=$4
           AND subject_code=$5 AND active=true LIMIT 1`,
        [user.id,body.year,body.section,body.dept,body.subject_code]
      );
      if (!assigned.rowCount) return Response.json({error:"Not assigned to this class"}, {status:403});
    }
    const result = await query(
      `INSERT INTO public.campus_sessions
       (created_by,year,section,dept,subject_code,classroom_id,opens_at,closes_at,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open')
       RETURNING id,year,section,dept,subject_code,classroom_id,opens_at,closes_at,status`,
      [user.id,body.year,body.section,body.dept,body.subject_code,body.classroom_id,body.opens_at,body.closes_at]
    );
    return Response.json({ session:result.rows[0] }, {status:201});
  } catch (error) { return apiError(error); }
}
