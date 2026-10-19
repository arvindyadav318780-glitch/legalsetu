import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader } from "@/components/dash/DashShell";
import { LocationSelect, selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({ component: Settings });

function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["profile", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const [f, setF] = useState({ full_name: "", phone: "", state: "", city: "", preferred_language: "en", notify_email: true });
  useEffect(() => { if (data) setF({ full_name: data.full_name ?? "", phone: data.phone ?? "", state: data.state ?? "", city: data.city ?? "", preferred_language: data.preferred_language ?? "en", notify_email: data.notify_email ?? true }); }, [data]);

  const save = async () => {
    if (f.phone && !/^[0-9+\s-]{6,15}$/.test(f.phone)) return toast.error("Enter a valid phone number");
    const { error } = await supabase.from("profiles").upsert({ id: user!.id, ...f, full_name: f.full_name.trim().slice(0, 100) });
    if (error) return toast.error("Couldn't save");
    toast.success("Profile saved");
  };

  return (
    <>
      <DashHeader title="Profile Settings" />
      <div className="card-surface grid max-w-2xl gap-4 p-6">
        <div className="grid gap-1.5"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
        <div className="grid gap-1.5"><Label>Full name</Label><Input value={f.full_name} maxLength={100} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label>Phone</Label><Input value={f.phone} maxLength={15} onChange={(e) => setF({ ...f, phone: e.target.value })} /><p className="text-xs text-muted-foreground">Phone verification — coming soon.</p></div>
        <div className="grid gap-1.5"><Label>Location</Label><LocationSelect state={f.state} city={f.city} onChange={(v) => setF({ ...f, ...v })} allLabel="Select state" /></div>
        <div className="grid gap-1.5"><Label>Preferred language</Label>
          <select className={selectCls} value={f.preferred_language} onChange={(e) => setF({ ...f, preferred_language: e.target.value })}>
            <option value="en">English</option><option value="hi">हिन्दी (Hindi) — interface coming soon</option>
          </select></div>
        <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Email notifications</p><p className="text-xs text-muted-foreground">Preference saved now; email delivery launches soon.</p></div><Switch checked={f.notify_email} onCheckedChange={(v) => setF({ ...f, notify_email: v })} /></div>
        <div className="flex gap-2">
          <Button variant="accent" onClick={save}>Save changes</Button>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>Log out</Button>
        </div>
      </div>
      <ChangePassword />
    </>
  );
}

function ChangePassword() {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8 || pw.length > 72) return toast.error("New password must be 8–72 characters");
    if (pw !== pw2) return toast.error("New passwords don't match");
    if (!cur) return toast.error("Enter your current password");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as { password: string });
    setBusy(false);
    if (error) return toast.error(/current|invalid|incorrect/i.test(error.message) ? "Current password is incorrect" : error.message);
    setCur(""); setPw(""); setPw2("");
    toast.success("Password changed");
  };
  return (
    <form onSubmit={submit} className="card-surface mt-6 grid max-w-2xl gap-4 p-6" noValidate>
      <h2 className="font-semibold">Change password</h2>
      <div className="grid gap-1.5"><Label htmlFor="cp">Current password</Label><Input id="cp" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label htmlFor="np1">New password</Label><Input id="np1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label htmlFor="np2">Confirm new password</Label><Input id="np2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      <p className="text-xs text-muted-foreground">Signed in with Google? Use "Forgot password" on the login page to set one.</p>
      <Button type="submit" variant="outline" className="w-fit" disabled={busy}>{busy ? "Please wait…" : "Change password"}</Button>
    </form>
  );
}
