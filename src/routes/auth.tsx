import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { selectCls } from "@/components/site/LocationSelect";

const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : undefined);

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    mode: z.enum(["login", "signup", "forgot"]).optional(),
    type: z.enum(["customer", "professional"]).optional(),
    next: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Login or Sign Up — LegalSetu" },
      { name: "description", content: "Sign in to your LegalSetu account or create one to request services and track progress." },
      { property: "og:title", content: "LegalSetu Account" },
      { property: "og:description", content: "Log in or create your LegalSetu account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const emailS = z.string().trim().email("Enter a valid email").max(255);
const pwS = z.string().min(8, "Password must be at least 8 characters").max(72);

function AuthPage() {
  const s = Route.useSearch();
  const mode = s.mode ?? "login";
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const next = safeNext(s.next);

  useEffect(() => {
    if (!loading && user && mode !== "forgot") navigate({ to: next ?? "/dashboard" });
  }, [user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="container-page grid items-center gap-10 py-12 md:py-20 lg:min-h-[46rem] lg:grid-cols-2">
      <div className="hidden lg:block">
        <p className="eyebrow">LegalSetu</p>
        <h1 className="mt-3 text-4xl font-bold">Your Business. Your Legal Support. One Platform.</h1>
        <p className="mt-4 max-w-md text-muted-foreground">Track requests, store documents privately and talk to your professional — all in one secure dashboard.</p>
      </div>
      <div className="card-surface mx-auto w-full max-w-md p-6 md:p-8">
        {mode === "forgot" ? <Forgot /> : <Form mode={mode} type={s.type} next={next} />}
      </div>
    </div>
  );
}

function Form({ mode, type, next }: { mode: "login" | "signup"; type?: "customer" | "professional"; next?: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [account, setAccount] = useState<string>(type === "professional" ? "ca" : "customer");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const ev = emailS.safeParse(email); if (!ev.success) return setErr(ev.error.issues[0].message);
    const pv = pwS.safeParse(password); if (!pv.success) return setErr(pv.error.issues[0].message);
    setBusy(true);
    if (mode === "signup") {
      if (!name.trim()) { setBusy(false); return setErr("Please enter your name"); }
      const { error } = await supabase.auth.signUp({
        email: ev.data, password,
        options: { emailRedirectTo: window.location.origin + (next ?? "/dashboard"), data: { full_name: name.trim().slice(0, 100), account_type: account } },
      });
      setBusy(false);
      if (error) return setErr(error.message);
      setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: ev.data, password });
      setBusy(false);
      if (error) return setErr(error.message === "Email not confirmed" ? "Please verify your email first — check your inbox." : "Incorrect email or password.");
      navigate({ to: next ?? "/dashboard" });
    }
  };

  const google = async () => {
    if (next) sessionStorage.setItem("ls_next", next);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Google sign-in failed. Please try again.");
  };

  if (sent) return (
    <div className="text-center">
      <h2 className="text-2xl font-bold">Check your email</h2>
      <p className="mt-2 text-muted-foreground">We sent a verification link to <strong>{email}</strong>. Click it to activate your account.</p>
      <Button asChild variant="outline" className="mt-6"><Link to="/auth" search={{ mode: "login" }}>Back to login</Link></Button>
    </div>
  );

  return (
    <>
      <h2 className="text-2xl font-bold">{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{mode === "signup" ? "Free to join. No card required." : "Log in to your LegalSetu account."}</p>
      <Button type="button" variant="outline" className="mt-6 w-full" onClick={google}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.7 3.74 14.56 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z"/></svg>
        Continue with Google
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {mode === "signup" && (
          <>
            <div className="grid gap-1.5"><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            <div className="grid gap-1.5">
              <Label htmlFor="acct">I am a</Label>
              <select id="acct" className={selectCls} value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="customer">Customer / business owner</option>
                <option value="ca">CA / CA firm</option>
                <option value="advocate">Advocate / law firm</option>
                <option value="professional">Other eligible professional</option>
              </select>
            </div>
          </>
        )}
        <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
        <div className="grid gap-1.5">
          <div className="flex justify-between"><Label htmlFor="pw">Password</Label>{mode === "login" && <Link to="/auth" search={{ mode: "forgot" }} className="text-xs text-accent hover:underline">Forgot password?</Link>}</div>
          <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Button type="submit" variant="accent" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}</Button>
        <p className="text-xs text-muted-foreground">Phone verification — <span className="font-medium">coming soon</span>.</p>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signup" ? <>Already have an account? <Link to="/auth" search={{ mode: "login", next }} className="font-semibold text-accent">Log in</Link></>
          : <>New to LegalSetu? <Link to="/auth" search={{ mode: "signup", next }} className="font-semibold text-accent">Sign up</Link></>}
      </p>
    </>
  );
}

function Forgot() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = emailS.safeParse(email); if (!v.success) return setErr(v.error.issues[0].message);
    const { error } = await supabase.auth.resetPasswordForEmail(v.data, { redirectTo: window.location.origin + "/reset-password" });
    if (error) return setErr(error.message);
    setDone(true);
  };
  return done ? (
    <div className="text-center"><h2 className="text-2xl font-bold">Check your email</h2><p className="mt-2 text-muted-foreground">If an account exists, a reset link is on its way.</p></div>
  ) : (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <h2 className="text-2xl font-bold">Reset your password</h2>
      <div className="grid gap-1.5"><Label htmlFor="fe">Email</Label><Input id="fe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" variant="accent">Send reset link</Button>
      <Link to="/auth" search={{ mode: "login" }} className="text-center text-sm text-accent">Back to login</Link>
    </form>
  );
}
