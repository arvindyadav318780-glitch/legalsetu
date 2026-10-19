import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Menu, X, LayoutDashboard, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/lib/catalog-live";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/professionals", label: "Find Professionals" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/resources", label: "Resources" },
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const { CATEGORIES, SERVICES } = useCatalog();
  const { user, isAdmin, isPro } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const dashTo = isAdmin ? "/admin" : isPro ? "/pro" : "/dashboard";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-0.5 whitespace-nowrap xl:flex" aria-label="Main">
          <Link to="/" className="nav-link rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>Home</Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Services <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[560px] p-3">
              <div className="grid grid-cols-2 gap-1">
                {CATEGORIES.map((c) => (
                  <DropdownMenuItem key={c.key} asChild>
                    <Link to="/services" search={{ category: c.key }} className="flex items-start gap-3 rounded-lg p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-soft text-accent"><c.icon className="h-4 w-4" /></span>
                      <span>
                        <span className="block text-sm font-semibold text-foreground">{c.name}</span>
                        <span className="block text-xs text-muted-foreground">{c.blurb}</span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/services" className="justify-center text-sm font-medium text-accent">View all {SERVICES.length} services →</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 xl:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">My account <ChevronDown className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="max-w-56 truncate text-xs font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
                <DropdownMenuItem asChild><Link to={dashTo}><LayoutDashboard className="h-4 w-4" /> Dashboard</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}><LogOut className="h-4 w-4" /> Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/auth" search={{ mode: "login" }}>Login</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/auth" search={{ mode: "signup" }}>Sign Up</Link></Button>
            </>
          )}
          <Button asChild variant="accent" size="sm"><Link to="/services">Explore Services</Link></Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[86vw] max-w-sm overflow-y-auto p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Logo />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></Button>
            </div>
            <div className="space-y-6 p-4" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
              <div className="grid grid-cols-2 gap-2">
                {user ? (
                  <>
                    <Button asChild variant="outline"><Link to={dashTo}>Dashboard</Link></Button>
                    <Button variant="ghost" onClick={signOut}>Log out</Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline"><Link to="/auth" search={{ mode: "login" }}>Login</Link></Button>
                    <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Sign Up</Link></Button>
                  </>
                )}
              </div>
              <div>
                <p className="eyebrow mb-2">Services</p>
                <div className="grid gap-1">
                  {CATEGORIES.map((c) => (
                    <Link key={c.key} to="/services" search={{ category: c.key }} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted">
                      <c.icon className="h-4 w-4 text-accent" /> {c.name}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="grid gap-1 border-t pt-4">
                <Link to="/" className="rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted">Home</Link>
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to} className="rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted">{n.label}</Link>
                ))}
              </div>
              <Button asChild variant="accent" className="w-full"><Link to="/services">Explore Services</Link></Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
