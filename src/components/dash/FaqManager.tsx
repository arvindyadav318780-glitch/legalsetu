import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const empty = { id: "", question: "", answer: "", published: false, sort: "100" };

/** Admin editor for public FAQs (homepage and Help Center). */
export function FaqManager() {
  const qc = useQueryClient();
  const [f, setF] = useState(empty);
  const { data = [] } = useQuery({ queryKey: ["admin-faqs"], queryFn: async () => (await supabase.from("faqs").select("*").order("sort")).data ?? [] });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-faqs"] }); qc.invalidateQueries({ queryKey: ["live-catalog"] }); };
  const save = async () => {
    if (f.question.trim().length < 5 || f.answer.trim().length < 5) return toast.error("Question and answer are required");
    const row = { question: f.question.trim(), answer: f.answer.trim(), published: f.published, sort: parseInt(f.sort) || 100 };
    const { error } = f.id ? await supabase.from("faqs").update(row).eq("id", f.id) : await supabase.from("faqs").insert(row);
    if (error) return toast.error(error.message);
    toast.success("FAQ saved"); setF(empty); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    const { error } = await supabase.from("faqs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("FAQ deleted"); refresh();
  };
  return (
    <>
      <div className="card-surface grid gap-3 p-5">
        <Input aria-label="FAQ question" placeholder="Question" value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} />
        <Textarea aria-label="FAQ answer" rows={4} placeholder="Answer" value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} />Published</label>
          <Input aria-label="FAQ sort order" className="w-28" type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} />
          <Button variant="accent" onClick={save}>{f.id ? "Update" : "Add"} FAQ</Button>
          {f.id && <Button variant="outline" onClick={() => setF(empty)}>Cancel edit</Button>}
        </div>
      </div>
      <div className="card-surface mt-6 divide-y">{data.map((q) => (
        <div key={q.id} className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1"><p className="font-medium">{q.question}</p><p className="text-xs text-muted-foreground">{q.published ? "Published" : "Draft"} · order {q.sort}</p></div>
          <Button size="sm" variant="outline" onClick={() => setF({ id: q.id, question: q.question, answer: q.answer, published: q.published, sort: String(q.sort) })}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => remove(q.id)}>Delete</Button>
        </div>
      ))}</div>
    </>
  );
}
