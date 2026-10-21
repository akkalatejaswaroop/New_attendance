import { z } from "zod";
import { requireRole, apiError } from "@/lib/auth";
import { pool } from "@/lib/db";

const studentSchema = z.object({
  roll_no: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  year: z.number().int().min(1).max(4),
  section: z.string().trim().min(1).max(20),
  dept: z.string().trim().min(1).max(80).default("CSE-AIML"),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(24).optional().nullable()
});
const schema = z.object({ rows: z.array(studentSchema).min(1).max(500) });

export async function POST(request: Request) {
  let client;
  try {
    const actor = await requireRole(["hod"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error:"Invalid student rows", details:parsed.error.flatten() }, { status:400 });
    const rows = parsed.data.rows;
    const rolls = rows.map(r=>r.roll_no.toLowerCase());
    const emails = rows.map(r=>r.email.toLowerCase());
    if (new Set(rolls).size !== rolls.length || new Set(emails).size !== emails.length) {
      return Response.json({ error:"Duplicate roll number or email within uploaded file" }, { status:400 });
    }
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.actor_user_id', $1, true)", [actor.id]);
    const imported = [];
    for (const row of rows) {
      const exists = await client.query(
        "SELECT 1 FROM public.students WHERE lower(roll_no)=lower($1) LIMIT 1", [row.roll_no]
      );
      if (exists.rowCount) throw new Error(`Roll number already exists: ${row.roll_no}`);
      const student = await client.query(
        `INSERT INTO public.students (roll_no,name,year,section,dept,phone,status)
         VALUES ($1,$2,$3,$4,$5,$6,'active') RETURNING id,roll_no,name,year,section,dept`,
        [row.roll_no,row.name,row.year,row.section,row.dept,row.phone || null]
      );
      await client.query(
        `INSERT INTO public.campus_student_contacts (student_id,email,phone)
         VALUES ($1,$2,$3)`, [student.rows[0].id,row.email,row.phone || null]
      );
      imported.push(student.rows[0]);
    }
    await client.query(
      `INSERT INTO public.campus_audit_logs (actor_user_id, action, entity_type, metadata)
       VALUES (current_setting('app.actor_user_id', true)::uuid, 'students.import', 'student',
               jsonb_build_object('count',$1::int))`, [imported.length]
    );
    await client.query("COMMIT");
    return Response.json({ imported:imported.length, students:imported }, { status:201 });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(()=>{});
    return apiError(error);
  } finally { client?.release(); }
}
