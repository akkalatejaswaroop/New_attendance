import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole, apiError } from "@/lib/auth";
import { pool, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const createStudentSchema = z.object({
  action: z.literal("user.createStudent"),
  roll_no: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  year: z.number().int().min(1).max(4),
  section: z.string().trim().min(1).max(20),
  dept: z.string().trim().min(1).max(80).default("CSE-AIML"),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(24).optional().nullable()
});
const createFacultySchema = z.object({
  action: z.literal("user.createFaculty"),
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  employee_code: z.string().trim().max(40).optional().nullable(),
  department: z.string().trim().min(1).max(80).default("CSE-AIML")
});
const assignmentSchema = z.object({
  action: z.literal("assignment.create"),
  faculty_user_id: z.string().uuid(),
  subject_code: z.string().trim().min(1).max(40),
  year: z.number().int().min(1).max(4),
  section: z.string().trim().min(1).max(20),
  dept: z.string().trim().min(1).max(80).default("CSE-AIML")
});
function createTemporaryPassword() {
  return `Ca!${randomBytes(12).toString("base64url")}7A`;
}

const leaveSchema = z.object({
  action: z.literal("leave.create"),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leave_type: z.enum(["medical", "personal", "official", "other"]),
  reason: z.string().trim().min(5).max(1000)
}).refine(v => v.to_date >= v.from_date, "End date must be on or after start date");

const reviewLeaveSchema = z.object({
  action: z.literal("leave.review"),
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  review_note: z.string().trim().max(500).optional().default("")
});
const timetableSchema = z.object({
  action: z.literal("timetable.create"),
  dept: z.string().trim().min(1).max(80).default("CSE-AIML"),
  year: z.number().int().min(1).max(4),
  section: z.string().trim().min(1).max(20),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  subject_code: z.string().trim().min(1).max(40),
  subject_name: z.string().trim().min(1).max(120),
  faculty_user_id: z.string().uuid().optional().nullable(),
  classroom_id: z.string().uuid().optional().nullable()
}).refine(v => v.end_time > v.start_time, "End time must be after start time");
const fineResolveSchema = z.object({
  action: z.literal("fine.resolve"),
  id: z.string().uuid(),
  status: z.enum(["paid", "waived", "cancelled"]),
  resolution_note: z.string().trim().min(3).max(500)
});
const finePolicySchema = z.object({
  action: z.literal("fine.policy"),
  amount: z.number().min(0).max(10000)
});
const manualAttendanceSchema = z.object({
  action: z.literal("attendance.manual"),
  session_id: z.string().uuid(),
  student_id: z.string().uuid(),
  status: z.enum(["present", "absent", "excused"]),
  reason: z.string().trim().min(5).max(500)
});
const classroomSchema = z.object({
  action: z.literal("classroom.create"),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120),
  building: z.string().trim().max(120).optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_m: z.number().int().min(10).max(500).default(60)
});
const sessionCreateSchema = z.object({
  action: z.literal("session.create"),
  year: z.number().int().min(1).max(4),
  section: z.string().trim().min(1).max(20),
  dept: z.string().trim().min(1).max(80).default("CSE-AIML"),
  subject_code: z.string().trim().min(1).max(40),
  classroom_id: z.string().uuid(),
  opens_at: z.string().datetime(),
  closes_at: z.string().datetime()
}).refine(v => new Date(v.closes_at) > new Date(v.opens_at), "Close time must follow open time");

export async function GET() {
  try {
    const user = await requireRole(["hod", "faculty", "student"]);
    const [profile, attendance, leaves, fines, notifications] = await Promise.all([
      user.role === "student" && user.student_id
        ? query(`SELECT id,roll_no,name,year,section,dept,phone,status FROM public.students WHERE id=$1`, [user.student_id])
        : user.role === "faculty" && user.faculty_id
          ? query(`SELECT id,employee_code,name,email,department,active FROM public.faculty WHERE id=$1`, [user.faculty_id])
          : query(`SELECT count(*)::int AS total_students FROM public.students WHERE status='active'`),
      user.role === "student" && user.student_id
        ? query(`SELECT a.id,a.status,a.marked_at,s.subject_code,s.year,s.section,s.dept,s.opens_at
                 FROM public.campus_attendance a JOIN public.campus_sessions s ON s.id=a.session_id
                 WHERE a.student_id=$1 ORDER BY s.opens_at DESC LIMIT 200`, [user.student_id])
        : user.role === "hod"
          ? query(`SELECT s.id,s.subject_code,s.year,s.section,s.dept,s.opens_at,s.status,
                    count(a.id) FILTER (WHERE a.status='present')::int AS present_count,
                    count(a.id) FILTER (WHERE a.status='absent')::int AS absent_count
                   FROM public.campus_sessions s LEFT JOIN public.campus_attendance a ON a.session_id=s.id
                   GROUP BY s.id ORDER BY s.opens_at DESC LIMIT 100`)
          : query(`SELECT s.id,s.subject_code,s.year,s.section,s.dept,s.opens_at,s.status,
                    count(a.id) FILTER (WHERE a.status='present')::int AS present_count,
                    count(a.id) FILTER (WHERE a.status='absent')::int AS absent_count
                   FROM public.campus_sessions s LEFT JOIN public.campus_attendance a ON a.session_id=s.id
                   WHERE s.created_by=$1 OR EXISTS (
                     SELECT 1 FROM public.campus_class_assignments ca
                     WHERE ca.faculty_user_id=$1 AND ca.year=s.year AND ca.section=s.section
                       AND ca.dept=s.dept AND ca.subject_code=s.subject_code AND ca.active=true
                   ) GROUP BY s.id ORDER BY s.opens_at DESC LIMIT 100`, [user.id]),
      user.role === "student" && user.student_id
        ? query(`SELECT id,from_date,to_date,leave_type,reason,status,review_note,created_at,reviewed_at
                 FROM public.campus_leave_requests WHERE student_id=$1 ORDER BY created_at DESC LIMIT 100`, [user.student_id])
        : user.role === "hod"
          ? query(`SELECT l.id,l.from_date,l.to_date,l.leave_type,l.reason,l.status,l.review_note,l.created_at,
                    s.name AS student_name,s.roll_no,s.year,s.section,s.dept
                   FROM public.campus_leave_requests l JOIN public.students s ON s.id=l.student_id
                   ORDER BY CASE WHEN l.status='pending' THEN 0 ELSE 1 END,l.created_at DESC LIMIT 200`)
          : query(`SELECT l.id,l.from_date,l.to_date,l.leave_type,l.reason,l.status,l.review_note,l.created_at,
                    s.name AS student_name,s.roll_no,s.year,s.section,s.dept
                   FROM public.campus_leave_requests l JOIN public.students s ON s.id=l.student_id
                   JOIN public.campus_class_assignments ca ON ca.faculty_user_id=$1
                     AND ca.year=s.year AND ca.section=s.section AND ca.dept=s.dept AND ca.active=true
                   ORDER BY CASE WHEN l.status='pending' THEN 0 ELSE 1 END,l.created_at DESC LIMIT 200`, [user.id]),
      user.role === "student" && user.student_id
        ? query(`SELECT id,absent_date,amount_paise,reason,status,resolution_note,resolved_at
                 FROM public.campus_fines WHERE student_id=$1 ORDER BY absent_date DESC LIMIT 200`, [user.student_id])
        : user.role === "hod"
          ? query(`SELECT f.id,f.absent_date,f.amount_paise,f.reason,f.status,f.resolution_note,
                    s.name AS student_name,s.roll_no,s.year,s.section,s.dept
                   FROM public.campus_fines f JOIN public.students s ON s.id=f.student_id
                   ORDER BY CASE WHEN f.status='unpaid' THEN 0 ELSE 1 END,f.absent_date DESC LIMIT 500`)
          : query(`SELECT f.id,f.absent_date,f.amount_paise,f.reason,f.status,s.name AS student_name,s.roll_no
                   FROM public.campus_fines f JOIN public.students s ON s.id=f.student_id
                   JOIN public.campus_class_assignments ca ON ca.faculty_user_id=$1
                     AND ca.year=s.year AND ca.section=s.section AND ca.dept=s.dept AND ca.active=true
                   ORDER BY f.absent_date DESC LIMIT 200`, [user.id]),
      query(`SELECT id,title,body,category,read_at,created_at FROM public.campus_notifications
             WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [user.id])
    ]);
    const day = new Date().getDay();
    const timetableResult = user.role === "student" && user.student_id
      ? await query(`SELECT t.id,t.day_of_week,t.start_time,t.end_time,t.subject_code,t.subject_name,t.dept,t.year,t.section,
                      f.name AS faculty_name,c.name AS classroom_name
                     FROM public.campus_timetable t
                     LEFT JOIN public.campus_users u ON u.id=t.faculty_user_id
                     LEFT JOIN public.faculty f ON f.id=u.faculty_id
                     LEFT JOIN public.campus_classrooms c ON c.id=t.classroom_id
                     JOIN public.students s ON s.id=$1 AND s.year=t.year AND s.section=t.section AND s.dept=t.dept
                     WHERE t.active=true AND CURRENT_DATE BETWEEN t.effective_from AND COALESCE(t.effective_until,'infinity'::date)
                     ORDER BY t.day_of_week,t.start_time`, [user.student_id])
      : user.role === "faculty"
        ? await query(`SELECT t.id,t.day_of_week,t.start_time,t.end_time,t.subject_code,t.subject_name,t.dept,t.year,t.section,c.name AS classroom_name
                       FROM public.campus_timetable t LEFT JOIN public.campus_classrooms c ON c.id=t.classroom_id
                       WHERE t.active=true AND t.faculty_user_id=$1
                         AND CURRENT_DATE BETWEEN t.effective_from AND COALESCE(t.effective_until,'infinity'::date)
                       ORDER BY t.day_of_week,t.start_time`, [user.id])
        : await query(`SELECT t.id,t.day_of_week,t.start_time,t.end_time,t.subject_code,t.subject_name,t.dept,t.year,t.section,
                        f.name AS faculty_name,c.name AS classroom_name
                       FROM public.campus_timetable t LEFT JOIN public.campus_users u ON u.id=t.faculty_user_id
                       LEFT JOIN public.faculty f ON f.id=u.faculty_id LEFT JOIN public.campus_classrooms c ON c.id=t.classroom_id
                       WHERE t.active=true ORDER BY t.day_of_week,t.year,t.section,t.start_time LIMIT 300`);
    const classrooms = user.role === "student" ? { rows: [] } : await query(`SELECT id,code,name,building,latitude,longitude,radius_m FROM public.campus_classrooms WHERE active=true ORDER BY name`);
    const students = user.role === "student" ? { rows: [] } : user.role === "hod"
      ? await query(`SELECT s.id,s.roll_no,s.name,s.year,s.section,s.dept,s.status,cu.email
                     FROM public.students s LEFT JOIN public.campus_users cu ON cu.student_id=s.id
                     ORDER BY s.year,s.section,s.roll_no LIMIT 500`)
      : await query(`SELECT DISTINCT s.id,s.roll_no,s.name,s.year,s.section,s.dept,s.status
                     FROM public.students s JOIN public.campus_class_assignments ca ON ca.faculty_user_id=$1
                     AND ca.year=s.year AND ca.section=s.section AND ca.dept=s.dept AND ca.active=true
                     WHERE s.status='active' ORDER BY s.year,s.section,s.roll_no LIMIT 500`, [user.id]);
    const assignments = user.role === "student" ? { rows: [] } : user.role === "hod"
      ? await query(`SELECT ca.id,ca.faculty_user_id,cu.email, f.name AS faculty_name,ca.subject_code,ca.year,ca.section,ca.dept
                     FROM public.campus_class_assignments ca JOIN public.campus_users cu ON cu.id=ca.faculty_user_id
                     LEFT JOIN public.faculty f ON f.id=cu.faculty_id WHERE ca.active=true ORDER BY ca.year,ca.section,ca.subject_code`)
      : await query(`SELECT id,subject_code,year,section,dept FROM public.campus_class_assignments WHERE faculty_user_id=$1 AND active=true ORDER BY year,section,subject_code`, [user.id]);
    const finePolicy = await query(`SELECT setting_value FROM public.campus_settings WHERE setting_key='absence_fine_per_day'`);
    const summary = user.role === "student"
      ? {
          present: attendance.rows.filter((a: any) => a.status === "present").length,
          absent: attendance.rows.filter((a: any) => a.status === "absent").length,
          attendanceRecords: attendance.rows.length,
          fineBalancePaise: fines.rows.filter((f: any) => f.status === "unpaid").reduce((sum: number, f: any) => sum + Number(f.amount_paise), 0),
          pendingLeaves: leaves.rows.filter((l: any) => l.status === "pending").length
        }
      : {
          totalStudents: user.role === "hod" ? Number(profile.rows[0]?.total_students || 0) : students.rows.length,
          activeSessions: attendance.rows.filter((s: any) => s.status === "open").length,
          pendingLeaves: leaves.rows.filter((l: any) => l.status === "pending").length,
          unpaidFinePaise: fines.rows.filter((f: any) => f.status === "unpaid").reduce((sum: number, f: any) => sum + Number(f.amount_paise), 0)
        };
    return Response.json({
      user: { id: user.id, email: user.email, role: user.role, student_id: user.student_id, faculty_id: user.faculty_id },
      profile: profile.rows[0] || null, summary, attendance: attendance.rows, timetable: timetableResult.rows,
      leaves: leaves.rows, fines: fines.rows, notifications: notifications.rows,
      classrooms: classrooms.rows, students: students.rows, assignments: assignments.rows,
      finePerDayPaise: Number(finePolicy.rows[0]?.setting_value?.amount ?? 50) * 100,
      todayDayOfWeek: day
    });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const action = z.object({ action: z.string() }).safeParse(body);
    if (!action.success) return Response.json({ error: "Action is required" }, { status: 400 });

    if (action.data.action === "user.createStudent") {
      const actor = await requireRole(["hod"]);
      const parsed = createStudentSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid student" }, { status: 400 });
      const v = parsed.data;
      const email = v.email.toLowerCase();
      const tempPassword = createTemporaryPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      client = await pool.connect();
      await client.query("BEGIN");
      const duplicate = await client.query(`SELECT 1 FROM public.campus_users WHERE lower(email)=lower($1)
        UNION ALL SELECT 1 FROM public.students WHERE lower(roll_no)=lower($2) LIMIT 1`, [email,v.roll_no]);
      if (duplicate.rowCount) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Email or roll number already exists" }, { status: 409 });
      }
      const student = await client.query(`INSERT INTO public.students(roll_no,name,year,section,dept,phone,status)
        VALUES($1,$2,$3,$4,$5,$6,'active') RETURNING id,roll_no,name,year,section,dept`,
        [v.roll_no,v.name,v.year,v.section,v.dept,v.phone || null]);
      await client.query(`INSERT INTO public.campus_student_contacts(student_id,email,phone) VALUES($1,$2,$3)`,
        [student.rows[0].id,email,v.phone || null]);
      await client.query(`INSERT INTO public.campus_users(email,password_hash,role,student_id,active,must_change_password)
        VALUES($1,$2,'student',$3,true,true)`, [email,passwordHash,student.rows[0].id]);
      await client.query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'user.create_student','student',$2,jsonb_build_object('email',$3))`, [actor.id,student.rows[0].id,email]);
      await client.query("COMMIT");
      return Response.json({ student: student.rows[0], email, temporaryPassword: tempPassword, mustChangePassword: true }, { status: 201 });
    }

    if (action.data.action === "user.createFaculty") {
      const actor = await requireRole(["hod"]);
      const parsed = createFacultySchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid faculty member" }, { status: 400 });
      const v = parsed.data;
      const email = v.email.toLowerCase();
      const tempPassword = createTemporaryPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      client = await pool.connect();
      await client.query("BEGIN");
      const duplicate = await client.query(`SELECT 1 FROM public.campus_users WHERE lower(email)=lower($1)
        UNION ALL SELECT 1 FROM public.faculty WHERE lower(email)=lower($1) LIMIT 1`, [email]);
      if (duplicate.rowCount) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Email already exists" }, { status: 409 });
      }
      const faculty = await client.query(`INSERT INTO public.faculty(employee_code,name,email,department,active)
        VALUES($1,$2,$3,$4,true) RETURNING id,employee_code,name,email,department`,
        [v.employee_code || null,v.name,email,v.department]);
      await client.query(`INSERT INTO public.campus_users(email,password_hash,role,faculty_id,active,must_change_password)
        VALUES($1,$2,'faculty',$3,true,true)`, [email,passwordHash,faculty.rows[0].id]);
      await client.query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'user.create_faculty','faculty',$2,jsonb_build_object('email',$3))`, [actor.id,faculty.rows[0].id,email]);
      await client.query("COMMIT");
      return Response.json({ faculty: faculty.rows[0], email, temporaryPassword: tempPassword, mustChangePassword: true }, { status: 201 });
    }

    if (action.data.action === "assignment.create") {
      const actor = await requireRole(["hod"]);
      const parsed = assignmentSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid faculty assignment" }, { status: 400 });
      const v = parsed.data;
      const faculty = await query(`SELECT id FROM public.campus_users WHERE id=$1 AND role='faculty' AND active=true`, [v.faculty_user_id]);
      if (!faculty.rowCount) return Response.json({ error: "Select an active faculty account" }, { status: 400 });
      const result = await query(`INSERT INTO public.campus_class_assignments(faculty_user_id,subject_code,year,section,dept,active)
        VALUES($1,$2,$3,$4,$5,true) ON CONFLICT(faculty_user_id,subject_code,year,section,dept)
        DO UPDATE SET active=true RETURNING id,faculty_user_id,subject_code,year,section,dept`,
        [v.faculty_user_id,v.subject_code,v.year,v.section,v.dept]);
      await query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'assignment.create','faculty_assignment',$2,jsonb_build_object('subject_code',$3,'year',$4,'section',$5))`,
        [actor.id,result.rows[0].id,v.subject_code,v.year,v.section]);
      return Response.json({ assignment: result.rows[0] }, { status: 201 });
    }

    if (action.data.action === "leave.create") {
      const user = await requireRole(["student"]);
      if (!user.student_id) return Response.json({ error: "Student profile is not linked" }, { status: 403 });
      const parsed = leaveSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid leave request" }, { status: 400 });
      const v = parsed.data;
      const result = await query(`INSERT INTO public.campus_leave_requests(student_id,from_date,to_date,leave_type,reason)
        VALUES($1,$2,$3,$4,$5) RETURNING id,status,from_date,to_date`, [user.student_id,v.from_date,v.to_date,v.leave_type,v.reason]);
      await query(`INSERT INTO public.campus_notifications(user_id,title,body,category)
        SELECT id,'New leave request','A student has submitted a leave request for review.','leave'
        FROM public.campus_users WHERE role='hod' AND active=true`);
      return Response.json({ leave: result.rows[0] }, { status: 201 });
    }

    if (action.data.action === "leave.review") {
      const user = await requireRole(["hod", "faculty"]);
      const parsed = reviewLeaveSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid review" }, { status: 400 });
      const v = parsed.data;
      const requestRow = await query(`SELECT l.id,l.student_id,l.from_date,l.to_date,s.year,s.section,s.dept,l.status
        FROM public.campus_leave_requests l JOIN public.students s ON s.id=l.student_id WHERE l.id=$1`, [v.id]);
      const row = requestRow.rows[0];
      if (!row || row.status !== "pending") return Response.json({ error: "Leave request not found or already reviewed" }, { status: 409 });
      if (user.role === "faculty") {
        const allowed = await query(`SELECT 1 FROM public.campus_class_assignments WHERE faculty_user_id=$1 AND year=$2 AND section=$3 AND dept=$4 AND active=true LIMIT 1`,
          [user.id,row.year,row.section,row.dept]);
        if (!allowed.rowCount) return Response.json({ error: "You are not assigned to this student's class" }, { status: 403 });
      }
      const updated = await query(`UPDATE public.campus_leave_requests SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now(),updated_at=now()
        WHERE id=$1 AND status='pending' RETURNING id,status`, [v.id,v.status,user.id,v.review_note]);
      if (v.status === "approved") {
        await query(`UPDATE public.campus_attendance a SET status='excused',verification_method='admin_correction',
            corrected_by=$2,correction_reason=COALESCE(NULLIF($3,''),'Approved leave'),marked_at=now()
          FROM public.campus_sessions s
          WHERE a.session_id=s.id AND a.student_id=$1
            AND (s.opens_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $4::date AND $5::date`,
          [row.student_id,user.id,v.review_note,row.from_date,row.to_date]);
        await query(`UPDATE public.campus_fines SET status='cancelled',resolved_by=$2,
            resolution_note='Approved leave',resolved_at=now()
          WHERE student_id=$1 AND absent_date BETWEEN $3::date AND $4::date AND status='unpaid'`,
          [row.student_id,user.id,row.from_date,row.to_date]);
      }
      await query(`INSERT INTO public.campus_notifications(user_id,title,body,category)
        SELECT id,'Leave request reviewed',$2,'leave' FROM public.campus_users WHERE student_id=$1`,
        [row.student_id, `Your leave request was ${v.status}.`]);
      await query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'leave.review','leave_request',$2,jsonb_build_object('status',$3))`, [user.id,v.id,v.status]);
      return Response.json({ leave: updated.rows[0] });
    }

    if (action.data.action === "timetable.create") {
      const user = await requireRole(["hod"]);
      const parsed = timetableSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid timetable entry" }, { status: 400 });
      const v = parsed.data;
      const result = await query(`INSERT INTO public.campus_timetable
        (dept,year,section,day_of_week,start_time,end_time,subject_code,subject_name,faculty_user_id,classroom_id,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,day_of_week,start_time,end_time,subject_code,subject_name,year,section`,
        [v.dept,v.year,v.section,v.day_of_week,v.start_time,v.end_time,v.subject_code,v.subject_name,v.faculty_user_id || null,v.classroom_id || null,user.id]);
      await query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,entity_id)
        VALUES($1,'timetable.create','timetable',$2)`, [user.id,result.rows[0].id]);
      return Response.json({ timetable: result.rows[0] }, { status: 201 });
    }

    if (action.data.action === "fine.resolve") {
      const user = await requireRole(["hod"]);
      const parsed = fineResolveSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid fine resolution" }, { status: 400 });
      const v = parsed.data;
      const result = await query(`UPDATE public.campus_fines SET status=$2,resolved_by=$3,resolution_note=$4,resolved_at=now()
        WHERE id=$1 AND status='unpaid' RETURNING id,status,student_id,amount_paise`, [v.id,v.status,user.id,v.resolution_note]);
      if (!result.rowCount) return Response.json({ error: "Fine not found or already resolved" }, { status: 409 });
      await query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'fine.resolve','fine',$2,jsonb_build_object('status',$3,'amount_paise',$4,'note',$5))`,
        [user.id,v.id,v.status,result.rows[0].amount_paise,v.resolution_note]);
      await query(`INSERT INTO public.campus_notifications(user_id,title,body,category)
        SELECT id,'Fine account updated',$2,'fine' FROM public.campus_users WHERE student_id=$1`,
        [result.rows[0].student_id, `A fine was marked ${v.status}.`]);
      return Response.json({ fine: { id: v.id, status: v.status } });
    }

    if (action.data.action === "fine.policy") {
      const user = await requireRole(["hod"]);
      const parsed = finePolicySchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: "Fine amount must be between ₹0 and ₹10,000 per absent day" }, { status: 400 });
      await query(`INSERT INTO public.campus_settings(setting_key,setting_value,updated_by,updated_at)
        VALUES('absence_fine_per_day',jsonb_build_object('amount',$1::numeric,'currency','INR'),$2,now())
        ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=now()`,
        [parsed.data.amount,user.id]);
      await query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,metadata)
        VALUES($1,'fine.policy.update','campus_settings',jsonb_build_object('amount_inr',$2))`, [user.id,parsed.data.amount]);
      return Response.json({ finePerDay: parsed.data.amount });
    }

    if (action.data.action === "attendance.manual") {
      const user = await requireRole(["hod", "faculty"]);
      const parsed = manualAttendanceSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid attendance correction" }, { status: 400 });
      const v = parsed.data;
      const sessionResult = await query(`SELECT id,created_by,year,section,dept,subject_code,opens_at,status
        FROM public.campus_sessions WHERE id=$1`, [v.session_id]);
      const session = sessionResult.rows[0];
      const studentResult = await query(`SELECT id,year,section,dept FROM public.students WHERE id=$1 AND status='active'`, [v.student_id]);
      const student = studentResult.rows[0];
      if (!session || !student || session.year !== student.year || session.section !== student.section || session.dept !== student.dept) {
        return Response.json({ error: "Session and student must belong to the same active class" }, { status: 400 });
      }
      if (user.role === "faculty") {
        const assigned = await query(`SELECT 1 FROM public.campus_class_assignments WHERE faculty_user_id=$1 AND year=$2 AND section=$3 AND dept=$4 AND subject_code=$5 AND active=true LIMIT 1`,
          [user.id,session.year,session.section,session.dept,session.subject_code]);
        if (session.created_by !== user.id && !assigned.rowCount) return Response.json({ error: "Not authorized for this class" }, { status: 403 });
      }
      const result = await query(`INSERT INTO public.campus_attendance
        (session_id,student_id,status,marked_at,verification_method,corrected_by,correction_reason)
        VALUES($1,$2,$3,now(),'admin_correction',$4,$5)
        ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status,marked_at=now(),
          verification_method='admin_correction',corrected_by=excluded.corrected_by,correction_reason=excluded.correction_reason
        RETURNING id,status,student_id`, [v.session_id,v.student_id,v.status,user.id,v.reason]);
      await query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'attendance.manual_correction','attendance',$2,jsonb_build_object('status',$3,'reason',$4))`,
        [user.id,result.rows[0].id,v.status,v.reason]);
      if (v.status !== "absent") {
        await query(`UPDATE public.campus_fines SET status='cancelled',resolved_by=$2,resolution_note='Attendance corrected: '||$3,resolved_at=now()
          WHERE student_id=$1 AND absent_date=($4::timestamptz AT TIME ZONE 'Asia/Kolkata')::date AND status='unpaid'`,
          [v.student_id,user.id,v.reason,session.opens_at]);
      } else {
        const dateResult = await query(`SELECT ($1::timestamptz AT TIME ZONE 'Asia/Kolkata')::date AS d`, [session.opens_at]);
        const settingResult = await query(`SELECT setting_value FROM public.campus_settings WHERE setting_key='absence_fine_per_day'`);
        const amountPaise = Math.round(Number(settingResult.rows[0]?.setting_value?.amount ?? 50) * 100);
        await query(`INSERT INTO public.campus_fines(student_id,absent_date,amount_paise,reason,source_session_id,created_by)
          VALUES($1,$2::date,$3,'Unexcused absence',$4,$5)
          ON CONFLICT(student_id,absent_date) DO UPDATE SET amount_paise=excluded.amount_paise,
            status='unpaid',reason='Unexcused absence',source_session_id=excluded.source_session_id,
            created_by=excluded.created_by,resolved_by=NULL,resolution_note=NULL,resolved_at=NULL
          WHERE public.campus_fines.status='cancelled'`,
          [v.student_id,dateResult.rows[0].d,amountPaise,v.session_id,user.id]);
      }
      return Response.json({ attendance: result.rows[0] });
    }

    if (action.data.action === "classroom.create") {
      const user = await requireRole(["hod"]);
      const parsed = classroomSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid classroom" }, { status: 400 });
      const v = parsed.data;
      const result = await query(`INSERT INTO public.campus_classrooms(code,name,building,latitude,longitude,radius_m)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id,code,name,building,latitude,longitude,radius_m`,
        [v.code,v.name,v.building || null,v.latitude,v.longitude,v.radius_m]);
      await query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,entity_id)
        VALUES($1,'classroom.create','classroom',$2)`, [user.id,result.rows[0].id]);
      return Response.json({ classroom: result.rows[0] }, { status: 201 });
    }

    if (action.data.action === "session.create") {
      const user = await requireRole(["hod", "faculty"]);
      const parsed = sessionCreateSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid session" }, { status: 400 });
      const v = parsed.data;
      if (user.role === "faculty") {
        const assigned = await query(`SELECT 1 FROM public.campus_class_assignments WHERE faculty_user_id=$1 AND year=$2 AND section=$3 AND dept=$4 AND subject_code=$5 AND active=true LIMIT 1`,
          [user.id,v.year,v.section,v.dept,v.subject_code]);
        if (!assigned.rowCount) return Response.json({ error: "Not assigned to this class and subject" }, { status: 403 });
      }
      const room = await query(`SELECT id FROM public.campus_classrooms WHERE id=$1 AND active=true`, [v.classroom_id]);
      if (!room.rowCount) return Response.json({ error: "Choose an active classroom" }, { status: 400 });
      const result = await query(`INSERT INTO public.campus_sessions
        (created_by,year,section,dept,subject_code,classroom_id,opens_at,closes_at,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'open') RETURNING id,year,section,dept,subject_code,classroom_id,opens_at,closes_at,status`,
        [user.id,v.year,v.section,v.dept,v.subject_code,v.classroom_id,v.opens_at,v.closes_at]);
      return Response.json({ session: result.rows[0] }, { status: 201 });
    }

    if (action.data.action === "session.close") {
      const user = await requireRole(["hod", "faculty"]);
      const parsed = z.object({ action: z.literal("session.close"), id: z.string().uuid() }).safeParse(body);
      if (!parsed.success) return Response.json({ error: "Invalid session ID" }, { status: 400 });
      client = await pool.connect();
      await client.query("BEGIN");
      const sr = await client.query(`SELECT * FROM public.campus_sessions WHERE id=$1 FOR UPDATE`, [parsed.data.id]);
      const session = sr.rows[0];
      if (!session || session.status !== "open") {
        await client.query("ROLLBACK");
        return Response.json({ error: "Session is not open" }, { status: 409 });
      }
      if (user.role === "faculty" && session.created_by !== user.id) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Only the session creator or HOD can close it" }, { status: 403 });
      }
      const fineSettings = await client.query(`SELECT setting_value FROM public.campus_settings WHERE setting_key='absence_fine_per_day'`);
      const finePaise = Math.round(Number(fineSettings.rows[0]?.setting_value?.amount ?? 50) * 100);
      const absentDate = await client.query(`SELECT ($1::timestamptz AT TIME ZONE 'Asia/Kolkata')::date AS d`, [session.opens_at]);
      await client.query(`INSERT INTO public.campus_attendance(session_id,student_id,status,verification_method,correction_reason)
        SELECT $1,st.id,CASE WHEN EXISTS (
          SELECT 1 FROM public.campus_leave_requests l WHERE l.student_id=st.id AND l.status='approved'
            AND l.from_date <= $2::date AND l.to_date >= $2::date
        ) THEN 'excused' ELSE 'absent' END,'manual','Session closed by attendance system'
        FROM public.students st WHERE st.status='active' AND st.year=$3 AND st.section=$4 AND st.dept=$5
        ON CONFLICT(session_id,student_id) DO NOTHING`,
        [session.id,absentDate.rows[0].d,session.year,session.section,session.dept]);
      await client.query(`INSERT INTO public.campus_fines(student_id,absent_date,amount_paise,reason,source_session_id,created_by)
        SELECT a.student_id,$2::date,$3,'Unexcused absence', $1,$4
        FROM public.campus_attendance a
        WHERE a.session_id=$1 AND a.status='absent'
        ON CONFLICT(student_id,absent_date) DO NOTHING`, [session.id,absentDate.rows[0].d,finePaise,user.id]);
      await client.query(`UPDATE public.campus_sessions SET status='closed' WHERE id=$1`, [session.id]);
      await client.query(`INSERT INTO public.campus_audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'session.close','attendance_session',$2,jsonb_build_object('absent_date',$3::text,'fine_paise',$4))`,
        [user.id,session.id,absentDate.rows[0].d,finePaise]);
      await client.query("COMMIT");
      return Response.json({ closed: true, absentDate: absentDate.rows[0].d, finePerAbsentDayPaise: finePaise });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
    return apiError(error);
  } finally { client?.release(); }
}
