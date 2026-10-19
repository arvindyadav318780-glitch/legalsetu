import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Professional photo from the private avatars bucket via a short-lived signed URL; initials fallback. Pass `proId` to link it to the public profile. */
export function ProAvatar({ name, path, size = 56, proId }: { name: string; path?: string | null; size?: number; proId?: string }) {
  const { data: url } = useQuery({
    queryKey: ["avatar", path], enabled: !!path, staleTime: 50 * 60 * 1000,
    queryFn: async () => (await supabase.storage.from("avatars").createSignedUrl(path!, 3600)).data?.signedUrl ?? null,
  });
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const img = url
    ? <img src={url} alt={`Photo of ${name}`} width={size} height={size} className="shrink-0 rounded-full border object-cover" style={{ width: size, height: size }} />
    : <div className="grid shrink-0 place-items-center rounded-full bg-muted text-lg font-bold text-muted-foreground" style={{ width: size, height: size }} aria-hidden>{initials}</div>;
  if (!proId) return img;
  return <Link to="/professionals/$id" params={{ id: proId }} aria-label={`View profile of ${name}`} className="shrink-0 rounded-full">{img}</Link>;
}

/** Professional name linked to the public profile page (shows "not available" there unless verified and listed). */
export function ProLink({ id, children }: { id: string | null | undefined; children: ReactNode }) {
  if (!id) return <>{children}</>;
  return <Link to="/professionals/$id" params={{ id }} className="hover:underline">{children}</Link>;
}
