import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Set a new password — LegalSetu" },
    { name: "description", content: "Choose a new password for your LegalSetu account." },
    { property: "og:title", content: "Reset password — LegalSetu" },
    { property: "og:description", content: "Choose a new password." },
    { name: "robots", content: "noindex" },
  ] }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr("Password must be at least 8 characters");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr("This reset link is invalid or expired. Request a new one.");
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <form onSubmit={submit} className="card-surface grid w-full max-w-md gap-4 p-8">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <div className="grid gap-1.5"><Label htmlFor="np">New password</Label><Input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" variant="accent">Update password</Button>
      </form>
    </div>
  );
}
