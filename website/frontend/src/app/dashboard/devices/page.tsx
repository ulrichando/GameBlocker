"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  Laptop,
  Monitor,
  Apple,
  Terminal,
  Smartphone,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Installation {
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

const platformIcons: Record<string, React.ElementType> = {
  windows: Monitor,
  macos: Apple,
  linux: Terminal,
  android: Smartphone,
  ios: Smartphone,
};

const statusColors: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  active: { bg: "bg-green-500/10", text: "text-green-400", icon: CheckCircle },
  inactive: { bg: "bg-yellow-500/10", text: "text-yellow-400", icon: AlertTriangle },
  pending: { bg: "bg-blue-500/10", text: "text-blue-400", icon: Clock },
  uninstalled: { bg: "bg-gray-500/10", text: "text-gray-400", icon: XCircle },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

export default function DevicesPage() {
  const { user, isLoading: authLoading, authFetch, logout } = useCustomerAuth();
  const [devices, setDevices] = useState<Installation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDevices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/device/installations`);
      if (!response.ok) throw new Error("Failed to fetch devices");
      const data = await response.json();
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Are you sure you want to remove "${deviceName || 'this device'}"?\n\nThis will remove it from your account.`)) {
      return;
    }

    setDeletingId(deviceId);
    try {
      const response = await authFetch(`${API_URL}/device/installation/${deviceId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to delete device");
      }
      // Remove from local state
      setDevices(devices.filter((d) => d.id !== deviceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete device");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchDevices();
    }
  }, [authLoading]);

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
            <h1 className="text-3xl font-bold text-white mb-2">My Devices</h1>
            <p className="text-gray-400">
              Manage your protected devices and installations.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={fetchDevices} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/dashboard/download">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                Add Device
              </Button>
            </Link>
          </div>
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
        ) : devices.length === 0 ? (
          <motion.div
            className="bg-surface-card rounded-2xl border border-white/5 p-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-surface-elevated flex items-center justify-center mb-6">
              <Laptop className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Devices Yet</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              You haven&apos;t installed ParentShield on any devices yet. Download the app to
              start protecting your family.
            </p>
            <Link href="/dashboard/download">
              <Button>
                <Plus className="w-4 h-4" />
                Add Your First Device
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {devices.map((device, index) => {
              const PlatformIcon = platformIcons[device.platform] || Laptop;
              const statusConfig = statusColors[device.status] || statusColors.inactive;
              const StatusIcon = statusConfig.icon;

              return (
                <motion.div
                  key={device.id}
                  className={`bg-surface-card rounded-xl border p-6 ${
                    device.is_blocked
                      ? "border-red-500/30"
                      : "border-white/5 hover:border-primary-500/20"
                  } transition-all duration-300`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  whileHover={{ boxShadow: "0 0 20px rgba(6, 182, 212, 0.1)" }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center">
                        <PlatformIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white mb-1">
                          {device.device_name || `${device.platform} Device`}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="capitalize">{device.platform}</span>
                          <span>•</span>
                          <span>v{device.app_version}</span>
                          {device.os_version && (
                            <>
                              <span>•</span>
                              <span>{device.os_version}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          Last seen: {formatTimeAgo(device.last_seen)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-end gap-2">
                        {device.is_blocked ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span className="text-sm font-medium text-red-400">Blocked</span>
                          </div>
                        ) : (
                          <div
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusConfig.bg}`}
                          >
                            <StatusIcon className={`w-4 h-4 ${statusConfig.text}`} />
                            <span className={`text-sm font-medium capitalize ${statusConfig.text}`}>
                              {device.status}
                            </span>
                          </div>
                        )}
                        {device.blocked_reason && (
                          <p className="text-xs text-red-400">{device.blocked_reason}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteDevice(device.id, device.device_name || `${device.platform} Device`)}
                        disabled={deletingId === device.id}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Remove device"
                      >
                        {deletingId === device.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <motion.div
          className="mt-8 bg-surface-card rounded-xl border border-white/5 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="font-medium text-white mb-2">About Device Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-gray-400">Active - Online recently</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-400">Inactive - Offline</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400">Pending - Setting up</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400">Uninstalled</span>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
