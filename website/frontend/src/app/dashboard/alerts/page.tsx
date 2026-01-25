"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  Bell,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Globe,
  Ban,
  Laptop,
  Eye,
  Trash2,
  CheckCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Alert {
  id: string;
  installation_id: string;
  device_name: string | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  details: Record<string, unknown> | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

interface Installation {
  id: string;
  device_name: string | null;
  platform: string;
}

const ALERT_TYPE_ICONS: Record<string, React.ElementType> = {
  blocked_site: Globe,
  blocked_app: Ban,
  screen_time_limit: Clock,
  tamper_attempt: AlertTriangle,
  device_offline: Laptop,
  new_app_installed: CheckCircle,
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  info: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  warning: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function AlertsPage() {
  const { user, isLoading: authLoading, authFetch, logout } = useCustomerAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [devices, setDevices] = useState<Installation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      const response = await authFetch(`${API_URL}/device/installations`);
      if (!response.ok) throw new Error("Failed to fetch devices");
      const data = await response.json();
      setDevices(data);
    } catch (err) {
      // Silent fail - not critical
    }
  };

  const fetchAlerts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `${API_URL}/parental/alerts?limit=100`;
      if (filter === "unread") {
        url += "&is_read=false";
      }
      if (selectedDevice !== "all") {
        url += `&installation_id=${selectedDevice}`;
      }

      const [alertsRes, countRes] = await Promise.all([
        authFetch(url),
        authFetch(`${API_URL}/parental/alerts/unread-count`),
      ]);

      if (!alertsRes.ok) throw new Error("Failed to fetch alerts");
      const alertsData = await alertsRes.json();
      setAlerts(alertsData);

      if (countRes.ok) {
        const countData = await countRes.json();
        setUnreadCount(countData.unread_count);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      const response = await authFetch(`${API_URL}/parental/alerts/${alertId}/read`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      setAlerts(alerts.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark as read");
    } finally {
      setActionLoading(null);
    }
  };

  const dismissAlert = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      const response = await authFetch(`${API_URL}/parental/alerts/${alertId}/dismiss`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to dismiss");
      setAlerts(alerts.filter((a) => a.id !== alertId));
      const alert = alerts.find((a) => a.id === alertId);
      if (alert && !alert.is_read) {
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss alert");
    } finally {
      setActionLoading(null);
    }
  };

  const markAllAsRead = async () => {
    setActionLoading("all");
    try {
      const response = await authFetch(`${API_URL}/parental/alerts/mark-all-read`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");
      setAlerts(alerts.map((a) => ({ ...a, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark all as read");
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchDevices();
      fetchAlerts();
    }
  }, [authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchAlerts();
    }
  }, [filter, selectedDevice]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="border-b border-white/5 bg-surface-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">ParentShield</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Page Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Bell className="w-8 h-8 text-yellow-400" />
              Alerts
              {unreadCount > 0 && (
                <span className="text-sm bg-red-500 text-white px-2 py-1 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p className="text-gray-400">View notifications and alerts from your devices.</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchAlerts}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                size="sm"
                onClick={markAllAsRead}
                disabled={actionLoading === "all"}
              >
                {actionLoading === "all" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                Mark All Read
              </Button>
            )}
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="flex flex-col md:flex-row gap-4 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Filter</label>
            <div className="flex gap-2">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? "bg-primary-500 text-white"
                      : "bg-surface-card text-gray-400 hover:text-white"
                  }`}
                >
                  {f === "all" ? "All Alerts" : "Unread"}
                </button>
              ))}
            </div>
          </div>

          {devices.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Device</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full md:w-48 bg-surface-card border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
              >
                <option value="all">All Devices</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.device_name || `${device.platform} Device`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </motion.div>

        {error && (
          <motion.div
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-red-400 text-center">{error}</p>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <motion.div
            className="bg-surface-card rounded-2xl border border-white/5 p-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-surface-elevated flex items-center justify-center mb-6">
              <Bell className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Alerts</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              {filter === "unread"
                ? "You have no unread alerts. Great job keeping up!"
                : "No alerts have been generated yet. Alerts will appear here when blocked content is accessed or limits are reached."}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, index) => {
              const Icon = ALERT_TYPE_ICONS[alert.alert_type] || Info;
              const colors = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info;

              return (
                <motion.div
                  key={alert.id}
                  className={`bg-surface-card rounded-xl border p-4 ${
                    alert.is_read ? "border-white/5" : colors.border
                  } ${!alert.is_read ? colors.bg : ""} transition-all`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.bg}`}
                    >
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className={`font-medium ${alert.is_read ? "text-gray-300" : "text-white"}`}>
                            {alert.title}
                          </h3>
                          <p className="text-sm text-gray-400 mt-1">{alert.message}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            {alert.device_name && (
                              <>
                                <span className="flex items-center gap-1">
                                  <Laptop className="w-3 h-3" />
                                  {alert.device_name}
                                </span>
                                <span>•</span>
                              </>
                            )}
                            <span>{formatTimeAgo(alert.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!alert.is_read && (
                            <button
                              onClick={() => markAsRead(alert.id)}
                              disabled={actionLoading === alert.id}
                              className="p-2 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-500/10 transition-colors disabled:opacity-50"
                              title="Mark as read"
                            >
                              {actionLoading === alert.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => dismissAlert(alert.id)}
                            disabled={actionLoading === alert.id}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Dismiss"
                          >
                            {actionLoading === alert.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
