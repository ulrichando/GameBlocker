"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  Download,
  Laptop,
  Menu,
  X,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

interface SubscriptionData {
  id: string;
  plan_name: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  max_devices: number;
  price_cents: number;
  billing_interval: string;
}

interface InstallationData {
  id: string;
  device_id: string;
  device_name: string | null;
  platform: string;
  os_version: string | null;
  app_version: string;
  status: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  last_seen: string;
  created_at: string;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color?: "primary" | "green" | "yellow" | "red";
}

function StatCard({ title, value, subtitle, icon: Icon, color = "primary" }: StatCardProps) {
  const colorClasses = {
    primary: "bg-primary-500/10 text-primary-400",
    green: "bg-green-500/10 text-green-400",
    yellow: "bg-yellow-500/10 text-yellow-400",
    red: "bg-red-500/10 text-red-400",
  };

  return (
    <motion.div
      className="bg-surface-card rounded-2xl border border-white/5 p-6"
      whileHover={{ y: -4, boxShadow: "0 0 30px rgba(6, 182, 212, 0.1)" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
      {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
    </motion.div>
  );
}

function getStatusColor(status: string): "green" | "yellow" | "red" | "primary" {
  switch (status.toLowerCase()) {
    case "active":
      return "green";
    case "trialing":
    case "past_due":
      return "yellow";
    case "canceled":
    case "expired":
      return "red";
    default:
      return "primary";
  }
}

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return CheckCircle;
    case "trialing":
    case "past_due":
      return AlertTriangle;
    case "canceled":
    case "expired":
      return XCircle;
    default:
      return CreditCard;
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateString);
}

export default function DashboardPage() {
  const { user, isLoading, authFetch, logout } = useCustomerAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [installations, setInstallations] = useState<InstallationData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        // Fetch subscription data
        const subRes = await authFetch("/api/account/subscription/details");
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscription(subData);
        }

        // Fetch installations
        const instRes = await authFetch("/api/device/installations");
        if (instRes.ok) {
          const instData = await instRes.json();
          setInstallations(instData);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoadingData(false);
      }
    }

    if (user) {
      fetchData();
    }
  }, [user, authFetch]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeDevices = installations.filter(i => i.status === "active" && !i.is_blocked).length;
  const totalDevices = installations.length;
  const maxDevices = subscription?.max_devices || 3;

  const navItems = [
    { icon: BarChart3, label: "Dashboard", active: true, href: "/dashboard" },
    { icon: Download, label: "Download App", href: "/dashboard/download" },
    { icon: Laptop, label: "My Devices", href: "/dashboard/devices" },
    { icon: Clock, label: "Screen Time", href: "/dashboard/screen-time" },
    { icon: Ban, label: "Blocked Apps", href: "/dashboard/blocked-apps" },
    { icon: Globe, label: "Web Filters", href: "/dashboard/web-filters" },
    { icon: Bell, label: "Alerts", href: "/dashboard/alerts" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface-card border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">ParentShield</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          {mobileOpen ? <X className="w-6 h-6 text-gray-400" /> : <Menu className="w-6 h-6 text-gray-400" />}
        </button>
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-surface-card border-r border-white/5 p-6 flex flex-col z-50 transform transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">ParentShield</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                item.active
                  ? "bg-gradient-primary text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/5 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary-400 to-secondary-500 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.first_name || "User"}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-4 md:p-6 lg:p-8 pt-20 lg:pt-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white mb-1">
              Welcome back, {user?.first_name || "User"}
            </h1>
            <p className="text-sm md:text-base text-gray-400">Here&apos;s your family protection overview.</p>
          </div>
          <Button variant="secondary" className="w-full sm:w-auto">
            <Bell className="w-4 h-4" />
            Notifications
          </Button>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
              <StatCard
                title="Subscription Status"
                value={subscription ? subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1) : "None"}
                subtitle={subscription ? `${subscription.plan_name} Plan` : "No active subscription"}
                icon={subscription ? getStatusIcon(subscription.status) : CreditCard}
                color={subscription ? getStatusColor(subscription.status) : "red"}
              />
              <StatCard
                title="Active Devices"
                value={`${activeDevices}/${maxDevices}`}
                subtitle={totalDevices > activeDevices ? `${totalDevices - activeDevices} inactive` : "All devices active"}
                icon={Laptop}
                color={activeDevices > 0 ? "green" : "yellow"}
              />
              <StatCard
                title="Next Billing"
                value={subscription ? formatDate(subscription.current_period_end) : "N/A"}
                subtitle={subscription ? `$${(subscription.price_cents / 100).toFixed(2)}/${subscription.billing_interval}` : ""}
                icon={CreditCard}
                color="primary"
              />
              <StatCard
                title="Protection Status"
                value={activeDevices > 0 ? "Protected" : "Unprotected"}
                subtitle={activeDevices > 0 ? "All devices secure" : "Install app to protect"}
                icon={Shield}
                color={activeDevices > 0 ? "green" : "red"}
              />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Devices List */}
              <div className="bg-surface-card rounded-2xl border border-white/5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Your Devices</h2>
                  <Link href="/dashboard/devices" className="text-sm text-primary-400 hover:text-primary-300">
                    View all
                  </Link>
                </div>
                {installations.length === 0 ? (
                  <div className="text-center py-8">
                    <Laptop className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 mb-2">No devices registered yet</p>
                    <Link href="/dashboard/download">
                      <Button size="sm">
                        <Download className="w-4 h-4" />
                        Download App
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {installations.slice(0, 4).map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            device.is_blocked
                              ? "bg-red-500/10"
                              : device.status === "active"
                              ? "bg-green-500/10"
                              : "bg-yellow-500/10"
                          }`}>
                            <Laptop className={`w-4 h-4 ${
                              device.is_blocked
                                ? "text-red-400"
                                : device.status === "active"
                                ? "text-green-400"
                                : "text-yellow-400"
                            }`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {device.device_name || device.platform.charAt(0).toUpperCase() + device.platform.slice(1)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {device.platform} • v{device.app_version}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            device.is_blocked
                              ? "bg-red-500/10 text-red-400"
                              : device.status === "active"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-yellow-500/10 text-yellow-400"
                          }`}>
                            {device.is_blocked ? "Blocked" : device.status}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">{getRelativeTime(device.last_seen)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-surface-card rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  {[
                    { label: "Download App", description: "Install on a new device", href: "/dashboard/download", icon: Download },
                    { label: "Manage Devices", description: "View and manage installations", href: "/dashboard/devices", icon: Laptop },
                    { label: "Screen Time Settings", description: "Configure daily limits", href: "/dashboard/screen-time", icon: Clock },
                    { label: "Web Filters", description: "Block websites by category", href: "/dashboard/web-filters", icon: Globe },
                  ].map((action) => (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex items-center justify-between p-4 rounded-xl bg-surface-elevated hover:bg-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                          <action.icon className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{action.label}</p>
                          <p className="text-xs text-gray-500">{action.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-primary-400 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Subscription Banner (if no subscription or expired) */}
            {(!subscription || subscription.status === "canceled" || subscription.status === "expired") && (
              <motion.div
                className="mt-6 bg-linear-to-r from-primary-500/20 to-secondary-500/20 rounded-2xl border border-primary-500/30 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {!subscription ? "Get Started with ParentShield" : "Reactivate Your Protection"}
                    </h3>
                    <p className="text-gray-400">
                      {!subscription
                        ? "Subscribe to protect your family's devices with advanced parental controls."
                        : "Your subscription has ended. Reactivate to continue protecting your devices."}
                    </p>
                  </div>
                  <Button className="shrink-0">
                    {!subscription ? "View Plans" : "Reactivate Now"}
                  </Button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
