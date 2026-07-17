import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Briefcase, Users, BookOpen, Wrench, ShieldCheck, LogOut, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useReadySession, hasRole, type RoleCode } from "@/lib/session-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Briefcase;
  visibleTo?: RoleCode[]; // if omitted → all
};

const NAV: NavItem[] = [
  { to: "/work", label: "Work", icon: Briefcase },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/engagements", label: "Engagements", icon: FileText },
  {
    to: "/playbooks",
    label: "Playbooks",
    icon: BookOpen,
    visibleTo: ["FIRM_ADMIN", "MANAGER", "REVIEWER"],
  },
  { to: "/tools", label: "Tools", icon: Wrench },
  {
    to: "/administration",
    label: "Administration",
    icon: ShieldCheck,
    visibleTo: ["FIRM_ADMIN"],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { firm, profile, role, branding } = useReadySession();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const brandName = branding?.brand_display_name ?? firm.display_name;

  const items = NAV.filter(
    (n) => !n.visibleTo || hasRole(role, n.visibleTo),
  );

  const initials = (profile.display_name || profile.first_name || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-60 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Firm
          </div>
          <div className="mt-0.5 text-sm font-semibold text-sidebar-foreground truncate">
            {brandName}
          </div>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors " +
                  (active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-3 border-t border-sidebar-border text-[11px] text-muted-foreground">
          Finclore Practice
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center justify-end px-6 gap-3">
          <div className="text-right leading-tight hidden sm:block">
            <div className="text-sm font-medium text-foreground">
              {profile.display_name}
            </div>
            <div className="text-xs text-muted-foreground">{role.name}</div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 rounded-full font-medium"
                aria-label="User menu"
              >
                {initials}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{profile.display_name}</div>
                <div className="text-xs text-muted-foreground">{role.name}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
