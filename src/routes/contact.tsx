import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cloneElement, isValidElement, useId, useState } from "react";
import { CheckCircle2, Mail, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "@tanstack/react-router";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(3000),
});

export const Route = createFileRoute("/contact")({
  validateSearch: z.object({ subject: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Contact — LegalSetu" },
      { name: "description", content: "Get in touch with the LegalSetu team for questions, partnerships or support." },
      { property: "og:title", content: "Contact LegalSetu" },
      { property: "og:description", content: "Send us a message and we'll get back to you." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { subject } = Route.useSearch();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { subject: subject ?? "" },
  });
  const onSubmit = async (v: z.infer<typeof schema>) => {
    const { error } = await supabase.from("contact_messages").insert(v);
    if (error) return setError("root", { message: "Couldn't send your message. Please try again." });
    setDone(true);
  };
  return (
    <>
      <PageHero eyebrow="Contact" title="We're here to help" subtitle="Please don't include PAN, Aadhaar or financial details in this form." />
      <div className="container-page grid gap-8 py-14 lg:grid-cols-[1fr_360px]">
        <div className="card-surface p-6 md:p-8">
          {done ? (
            <div className="py-10 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-success" /><h2 className="mt-3 text-xl font-semibold">Message sent</h2><p className="mt-1 text-muted-foreground">Thanks — we'll reply by email.</p></div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Name" err={errors.name?.message}><Input {...register("name")} /></F>
                <F label="Email" err={errors.email?.message}><Input type="email" {...register("email")} /></F>
              </div>
              <F label="Subject" err={errors.subject?.message}><Input {...register("subject")} /></F>
              <F label="Message" err={errors.message?.message}><Textarea rows={6} {...register("message")} /></F>
              {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
              <Button type="submit" variant="accent" disabled={isSubmitting} className="w-fit">{isSubmitting ? "Sending…" : "Send message"}</Button>
            </form>
          )}
        </div>
        <aside className="space-y-4">
          <div className="card-surface p-5"><Mail className="h-5 w-5 text-accent" /><h3 className="mt-2 font-semibold">Email</h3><p className="text-sm text-muted-foreground">A support email address will be published at launch. Use this form meanwhile.</p></div>
          <div className="card-surface p-5"><LifeBuoy className="h-5 w-5 text-accent" /><h3 className="mt-2 font-semibold">Existing request?</h3><p className="text-sm text-muted-foreground">Raise a support ticket from your dashboard to track it.</p><Button asChild variant="outline" size="sm" className="mt-3"><Link to="/dashboard/support">Open support</Link></Button></div>
        </aside>
      </div>
    </>
  );
}

export function F({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) {
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children;
  return <div className="grid gap-1.5"><Label htmlFor={id}>{label}</Label>{child}{err && <p className="text-xs text-destructive">{err}</p>}</div>;
}
