"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, CreditCard, Bell, DollarSign, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/admin/sidebar";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface DashboardStats {
  total_customers: number;
  active_subscriptions: number;
  revenue_today: number;
  revenue_this_month: number;
  revenue_total: number;
  new_customers_today: number;
  new_customers_this_month: number;
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}

function StatCard({ title, value, icon: Icon, color, loading }: StatCardProps) {
  return (
    <motion.div
      className="bg-surface-card rounded-2xl border border-white/5 p-6"
      whileHover={{ y: -4, boxShadow: "0 0 30px rgba(6, 182, 212, 0.1)" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {loading ? (
        <div className="h-9 flex items-center">
          <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
        </div>
      ) : (
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
      )}
      <p className="text-sm text-gray-500">{title}</p>
    </motion.div>
  );
}

export default function AdminDashboardPage() {
  const { user, isLoading, authFetch } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    if (isLoading) return;

    const fetchStats = async () => {
      try {
        const res = await authFetch("/api/admin/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setStatsError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [isLoading, authFetch]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <AdminSidebar activePage="dashboard" user={user} />

      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Admin Dashboard</h1>
            <p className="text-gray-400">Overview of ParentShield platform</p>
          </div>
          <Button variant="secondary">
            <Bell className="w-4 h-4" />
            Notifications
          </Button>
        </div>

        {/* Stats Error */}
        {statsError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {statsError}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Customers"
            value={stats?.total_customers.toLocaleString() || "0"}
            icon={Users}
            color="bg-blue-500"
            loading={statsLoading}
          />
          <StatCard
            title="Active Subscriptions"
            value={stats?.active_subscriptions.toLocaleString() || "0"}
            icon={CreditCard}
            color="bg-green-500"
            loading={statsLoading}
          />
          <StatCard
            title="Monthly Revenue"
            value={`$${stats?.revenue_this_month.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`}
            icon={DollarSign}
            color="bg-purple-500"
            loading={statsLoading}
          />
          <StatCard
            title="New Customers Today"
            value={stats?.new_customers_today.toLocaleString() || "0"}
            icon={UserPlus}
            color="bg-orange-500"
            loading={statsLoading}
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Summary Cards */}
          <div className="bg-surface-card rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Revenue Summary</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-gray-400">Today</span>
                <span className="text-white font-medium">
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    `$${stats?.revenue_today.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-gray-400">This Month</span>
                <span className="text-white font-medium">
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    `$${stats?.revenue_this_month.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-400">All Time</span>
                <span className="text-white font-medium">
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    `$${stats?.revenue_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Growth */}
          <div className="bg-surface-card rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Customer Growth</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-gray-400">New Today</span>
                <span className="text-white font-medium">
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    stats?.new_customers_today.toLocaleString() || "0"
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-gray-400">New This Month</span>
                <span className="text-white font-medium">
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    stats?.new_customers_this_month.toLocaleString() || "0"
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-400">Total Customers</span>
                <span className="text-white font-medium">
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    stats?.total_customers.toLocaleString() || "0"
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
