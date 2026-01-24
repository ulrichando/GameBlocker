"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Shield,
  Clock,
  Ban,
  Globe,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  User,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserData {
  email: string;
  role: string;
  first_name?: string;
}

interface StatCardProps {
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: React.ElementType;
}

function StatCard({ title, value, trend, trendUp, icon: Icon }: StatCardProps) {
  return (
    <motion.div
      className="bg-surface-card rounded-2xl border border-white/5 p-6"
      whileHover={{ y: -4, boxShadow: "0 0 30px rgba(6, 182, 212, 0.1)" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary-400" />
        </div>
        <div
          className={`flex items-center gap-1 text-xs font-medium ${
            trendUp ? "text-green-400" : "text-red-400"
          }`}
        >
          {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    setUser({
      email: localStorage.getItem("user_email") || "user@example.com",
      role: localStorage.getItem("user_role") || "customer",
      first_name: localStorage.getItem("user_name") || "User",
    });
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_name");
    router.push("/login");
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-card border-r border-white/5 p-6 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">ParentShield</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {[
            { icon: BarChart3, label: "Dashboard", active: true },
            { icon: Clock, label: "Screen Time" },
            { icon: Ban, label: "Blocked Apps" },
            { icon: Globe, label: "Web Filters" },
            { icon: Bell, label: "Alerts" },
            { icon: Settings, label: "Settings" },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                item.active
                  ? "bg-gradient-primary text-white"
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.first_name || "User"}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Welcome back, {user?.first_name || "User"}
            </h1>
            <p className="text-gray-400">Here&apos;s what&apos;s happening with your family today.</p>
          </div>
          <Button variant="secondary">
            <Bell className="w-4 h-4" />
            Notifications
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Screen Time Today"
            value="2h 34m"
            trend="-15%"
            trendUp={false}
            icon={Clock}
          />
          <StatCard
            title="Apps Blocked"
            value="47"
            trend="+12"
            trendUp={true}
            icon={Ban}
          />
          <StatCard
            title="Sites Filtered"
            value="156"
            trend="+8"
            trendUp={true}
            icon={Globe}
          />
          <StatCard
            title="Safety Score"
            value="98%"
            trend="+3%"
            trendUp={true}
            icon={Shield}
          />
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity Feed */}
          <div className="bg-surface-card rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {[
                { action: "Blocked access to TikTok", time: "2 minutes ago", type: "block" },
                { action: "Screen time limit reached", time: "15 minutes ago", type: "limit" },
                { action: "New device connected", time: "1 hour ago", type: "device" },
                { action: "Weekly report generated", time: "3 hours ago", type: "report" },
              ].map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        activity.type === "block"
                          ? "bg-red-500/10"
                          : activity.type === "limit"
                          ? "bg-yellow-500/10"
                          : "bg-primary-500/10"
                      }`}
                    >
                      <AlertCircle
                        className={`w-4 h-4 ${
                          activity.type === "block"
                            ? "text-red-400"
                            : activity.type === "limit"
                            ? "text-yellow-400"
                            : "text-primary-400"
                        }`}
                      />
                    </div>
                    <span className="text-sm text-gray-300">{activity.action}</span>
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface-card rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {[
                { label: "Add New Device", description: "Protect another device" },
                { label: "Block an App", description: "Add app to blocklist" },
                { label: "Set Screen Time", description: "Configure daily limits" },
                { label: "View Reports", description: "See detailed analytics" },
              ].map((action) => (
                <button
                  key={action.label}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-elevated hover:bg-white/5 transition-all group"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{action.label}</p>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-primary-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
