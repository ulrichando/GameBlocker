"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
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
  Key,
  Copy,
  Link2,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

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

interface ActivationCode {
  id: string;
  code: string;
  expires_at: string;
  is_used: boolean;
  is_expired: boolean;
  used_at: string | null;
  used_device_id: string | null;
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
  const { isLoading: authLoading, authFetch } = useCustomerAuth();
  const [devices, setDevices] = useState<Installation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Activation codes
  const [activationCodes, setActivationCodes] = useState<ActivationCode[]>([]);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showLinkDevice, setShowLinkDevice] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [isLinking, setIsLinking] = useState(false);

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

  const fetchActivationCodes = async () => {
    try {
      const response = await authFetch(`${API_URL}/device/activation-codes`);
      if (response.ok) {
        const data = await response.json();
        setActivationCodes(data);
      }
    } catch (err) {
      console.error("Failed to fetch activation codes:", err);
    }
  };

  const generateActivationCode = async () => {
    setIsGeneratingCode(true);
    try {
      const response = await authFetch(`${API_URL}/device/activation-codes`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to generate code");
      }
      const newCode = await response.json();
      setActivationCodes([newCode, ...activationCodes]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate code");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const deleteActivationCode = async (codeId: string) => {
    try {
      const response = await authFetch(`${API_URL}/device/activation-codes/${codeId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setActivationCodes(activationCodes.filter((c) => c.id !== codeId));
      }
    } catch (err) {
      console.error("Failed to delete code:", err);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const linkDeviceWithCode = async () => {
    if (!linkCode.trim()) return;

    setIsLinking(true);
    try {
      const response = await authFetch(`${API_URL}/device/link-device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: linkCode }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.detail || "Failed to link device");
      }

      // Refresh devices list
      await fetchDevices();
      setLinkCode("");
      setShowLinkDevice(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link device");
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchDevices();
      fetchActivationCodes();
    }
  }, [authLoading]);

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
        {/* Page Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <h1 className="text-lg md:text-base font-bold text-white mb-2 flex items-center gap-3">
              <Laptop className="w-5 h-5 text-primary-400" />
              My Devices
            </h1>
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
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-red-400 text-center">{error}</p>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : devices.length === 0 ? (
          <motion.div
            className="bg-surface-card rounded-2xl border border-white/5 p-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-10 h-10 mx-auto rounded-full bg-surface-elevated flex items-center justify-center mb-6">
              <Laptop className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-base font-bold text-white mb-2">No Devices Yet</h2>
            <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
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
          <div className="space-y-3">
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
                      <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center">
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

        {/* Device Linking Section */}
        <motion.div
          className="mt-8 bg-surface-card rounded-xl border border-white/5 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-primary-400" />
                Quick Device Linking
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Generate a code to quickly link a new device without entering your password
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowLinkDevice(!showLinkDevice)}
              >
                <Link2 className="w-4 h-4" />
                Link Device
              </Button>
              <Button
                size="sm"
                onClick={generateActivationCode}
                disabled={isGeneratingCode}
              >
                {isGeneratingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Generate Code
              </Button>
            </div>
          </div>

          {/* Link device by code input */}
          {showLinkDevice && (
            <div className="mb-4 p-4 bg-surface-elevated rounded-lg border border-white/5">
              <p className="text-sm text-gray-300 mb-3">
                Enter the code displayed on the device you want to link:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                  placeholder="ABC-123"
                  className="flex-1 px-4 py-2 bg-surface-card border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-primary-500 focus:outline-none text-center font-mono text-lg tracking-wider"
                  maxLength={7}
                />
                <Button onClick={linkDeviceWithCode} disabled={isLinking || !linkCode.trim()}>
                  {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link"}
                </Button>
              </div>
            </div>
          )}

          {/* Activation codes list */}
          {activationCodes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Active Codes</p>
              {activationCodes.filter(c => !c.is_used && !c.is_expired).map((code) => (
                <div
                  key={code.id}
                  className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                      <QrCode className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <p className="font-mono text-lg text-white tracking-wider">{code.code}</p>
                      <p className="text-xs text-gray-500">
                        Expires: {new Date(code.expires_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(code.code)}
                      className="text-gray-400 hover:text-white"
                    >
                      {copiedCode === code.code ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteActivationCode(code.id)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activationCodes.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No active codes. Generate one to quickly link a new device.
            </div>
          )}
        </motion.div>

        {/* Info Card */}
        <motion.div
          className="mt-6 bg-surface-card rounded-xl border border-white/5 p-4"
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
    </DashboardLayout>
  );
}
