"use client";

import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  User,
  DollarSign,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminSidebarProps {
  activePage: "dashboard" | "users" | "subscriptions" | "transactions" | "analytics" | "settings";
  user: {
    email: string;
    first_name?: string;
  };
}

const navItems = [
  { icon: BarChart3, label: "Dashboard", href: "/admin", key: "dashboard" },
  { icon: Users, label: "Users", href: "/admin/users", key: "users" },
  { icon: CreditCard, label: "Subscriptions", href: "/admin/subscriptions", key: "subscriptions" },
  { icon: DollarSign, label: "Transactions", href: "/admin/transactions", key: "transactions" },
  { icon: Activity, label: "Analytics", href: "/admin/analytics", key: "analytics" },
  { icon: Settings, label: "Settings", href: "/admin/settings", key: "settings" },
];

export function AdminSidebar({ activePage, user }: AdminSidebarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_name");
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-card border-r border-white/5 p-6 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-linear-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-lg font-bold text-white">ParentShield</span>
          <p className="text-xs text-red-400 font-medium">Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => router.push(item.href)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activePage === item.key
                ? "bg-linear-to-r from-red-500 to-orange-500 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/5 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-red-400 to-orange-500 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{user?.first_name || "Admin"}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
