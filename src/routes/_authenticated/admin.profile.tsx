import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/profile")({ component: AdminProfile });

function AdminProfile() {
  const { user, roles } = useAuth();
  const { data } = useQuery({ queryKey: ["my-profile", user?.id], enabled: !!user, queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle()).data });
  const [name, setName] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  useEffect(() => { if (data) setName(data.full_name ?? ""); }, [data]);
  const saveName = async () => {
    if (name.trim().length < 2) return toast.error("Enter your name");
    const { error } = await supabase.from("profiles").update({ full_name: name.trim().slice(0, 100) }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Name saved");
  };
  const changePw = async () => {
    if (pw.next.length < 8) return toast.error("New password must be at least 8 characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords don't match");
    if (!pw.current) return toast.error("Enter your current password");
    // Confirm the current password first; the sign-in service doesn't always enforce it on update.
    const check = await supabase.auth.signInWithPassword({ email: user!.email!, password: pw.current });
    if (check.error) return toast.error("Current password is incorrect");
    const { error } = await supabase.auth.updateUser({ password: pw.next, current_password: pw.current } as never);
    if (error) return toast.error(error.message);
    toast.success("Password changed"); setPw({ current: "", next: "", confirm: "" });
  };
  return (
    <>
      <DashHeader title="My admin profile" subtitle="Your own roles can only be changed by another administrator." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-surface grid gap-3 p-5">
          <div className="grid gap-1.5"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div className="grid gap-1.5"><Label htmlFor="an">Display name</Label><Input id="an" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <p className="text-sm text-muted-foreground">Roles: {roles.join(", ")}</p>
          <Button className="w-fit" onClick={saveName}>Save name</Button>
        </div>
        <div className="card-surface grid gap-3 p-5">
          <h2 className="font-semibold">Change password</h2>
          <div className="grid gap-1.5"><Label htmlFor="pc">Current password</Label><Input id="pc" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="pn">New password</Label><Input id="pn" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="pf">Confirm new password</Label><Input id="pf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          <Button className="w-fit" onClick={changePw}>Change password</Button>
        </div>
      </div>
    </>
  );
}
