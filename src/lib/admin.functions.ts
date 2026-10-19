import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Server-side check of the caller's staff roles (never trusts the browser). */
export const getStaffAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (error) throw new Error("Could not verify access");
    const roles = (data ?? []).map((r) => r.role as string);
    const { data: prof } = await context.supabase.from("profiles").select("suspended").eq("id", context.userId).maybeSingle();
    const active = !prof?.suspended;
    return { isAdmin: active && roles.includes("admin"), isStaff: active && (roles.includes("admin") || roles.includes("support")) };
  });

const announcementSchema = z.object({
  audience: z.enum(["customers", "professionals", "user"]),
  targetUser: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(1000),
});

/** Admin-only: sends an in-app notification to a group or one user and records it. */
export const sendAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => announcementSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only administrators can send announcements");
    if (data.audience === "user" && !data.targetUser) throw new Error("Choose a recipient");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ids: string[] = [];
    if (data.audience === "user") ids = [data.targetUser!];
    else {
      const roles = data.audience === "customers" ? ["customer"] : ["ca", "advocate", "professional"];
      const { data: rows, error } = await supabaseAdmin.from("user_roles").select("user_id").in("role", roles as never);
      if (error) throw new Error("Could not load recipients");
      ids = [...new Set((rows ?? []).map((r) => r.user_id))];
    }
    if (ids.length) {
      const { error } = await supabaseAdmin.from("notifications").insert(ids.map((user_id) => ({ user_id, title: data.title, body: data.body, link: null })));
      if (error) throw new Error("Could not send notifications");
    }
    await supabaseAdmin.from("announcements").insert({ audience: data.audience, target_user: data.targetUser ?? null, title: data.title, body: data.body, recipients: ids.length, sent_by: context.userId });
    await context.supabase.from("audit_logs").insert({ actor_id: context.userId, action: "announcement.send", target: `audience:${data.audience}`, details: { title: data.title, recipients: ids.length } });
    return { recipients: ids.length };
  });
