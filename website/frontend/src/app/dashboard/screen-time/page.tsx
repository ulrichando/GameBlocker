"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  Clock,
  Laptop,
  Save,
  Loader2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Installation {
  id: string;
  device_name: string | null;
  platform: string;
}

interface ScreenTimeConfig {
  id: string;
  installation_id: string;
  is_enabled: boolean;
  monday_limit: number;
  tuesday_limit: number;
  wednesday_limit: number;
  thursday_limit: number;
  friday_limit: number;
  saturday_limit: number;
  sunday_limit: number;
  allowed_start_time: string | null;
  allowed_end_time: string | null;
  grace_period: number;
}

const DAYS = [
  { key: "monday_limit", label: "Monday" },
  { key: "tuesday_limit", label: "Tuesday" },
  { key: "wednesday_limit", label: "Wednesday" },
  { key: "thursday_limit", label: "Thursday" },
  { key: "friday_limit", label: "Friday" },
  { key: "saturday_limit", label: "Saturday" },
  { key: "sunday_limit", label: "Sunday" },
];

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "Unlimited";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function ScreenTimePage() {
  const { user, isLoading: authLoading, authFetch, logout } = useCustomerAuth();
  const [devices, setDevices] = useState<Installation[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [config, setConfig] = useState<ScreenTimeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchDevices = async () => {
    try {
      const response = await authFetch(`${API_URL}/device/installations`);
      if (!response.ok) throw new Error("Failed to fetch devices");
      const data = await response.json();
      setDevices(data.filter((d: Installation & { status: string }) => d.status === "active"));
      if (data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    }
  };

  const fetchConfig = async (deviceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/parental/screen-time/${deviceId}`);
      if (!response.ok) throw new Error("Failed to fetch configuration");
      const data = await response.json();
      setConfig(data);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!selectedDevice || !config) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/parental/screen-time/${selectedDevice}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Failed to save configuration");
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = (key: string, value: number | boolean | string | null) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    setHasChanges(true);
  };

  useEffect(() => {
    if (!authLoading) {
      fetchDevices();
    }
  }, [authLoading]);

  useEffect(() => {
    if (selectedDevice) {
      fetchConfig(selectedDevice);
    }
  }, [selectedDevice]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const selectedDeviceInfo = devices.find((d) => d.id === selectedDevice);

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
              <Clock className="w-8 h-8 text-primary-400" />
              Screen Time
            </h1>
            <p className="text-gray-400">Set daily time limits for device usage.</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => selectedDevice && fetchConfig(selectedDevice)}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={saveConfig} disabled={!hasChanges || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </motion.div>

        {/* Device Selector */}
        {devices.length > 0 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <label className="block text-sm font-medium text-gray-400 mb-2">Select Device</label>
            <select
              value={selectedDevice || ""}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full md:w-64 bg-surface-card border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.device_name || `${device.platform} Device`}
                </option>
              ))}
            </select>
          </motion.div>
        )}

        {error && (
          <motion.div
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-red-400 text-center">{error}</p>
          </motion.div>
        )}

        {devices.length === 0 ? (
          <motion.div
            className="bg-surface-card rounded-2xl border border-white/5 p-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-surface-elevated flex items-center justify-center mb-6">
              <Laptop className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Devices Found</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              You need to have at least one active device to configure screen time limits.
            </p>
            <Link href="/dashboard/download">
              <Button>Add Your First Device</Button>
            </Link>
          </motion.div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : config ? (
          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <motion.div
              className="bg-surface-card rounded-xl border border-white/5 p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Enable Screen Time Limits</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Turn on to enforce daily usage limits on this device.
                  </p>
                </div>
                <button
                  onClick={() => updateConfig("is_enabled", !config.is_enabled)}
                  className="text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {config.is_enabled ? (
                    <ToggleRight className="w-12 h-12" />
                  ) : (
                    <ToggleLeft className="w-12 h-12 text-gray-500" />
                  )}
                </button>
              </div>
            </motion.div>

            {/* Daily Limits */}
            <motion.div
              className={`bg-surface-card rounded-xl border border-white/5 p-6 ${
                !config.is_enabled ? "opacity-50" : ""
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Daily Time Limits</h3>
              <p className="text-sm text-gray-400 mb-6">
                Set maximum screen time for each day. Use 0 for unlimited.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DAYS.map((day) => (
                  <div key={day.key} className="flex items-center justify-between py-3 px-4 bg-surface-elevated rounded-lg">
                    <span className="text-white font-medium">{day.label}</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="720"
                        step="15"
                        value={config[day.key as keyof ScreenTimeConfig] as number}
                        onChange={(e) => updateConfig(day.key, parseInt(e.target.value))}
                        disabled={!config.is_enabled}
                        className="w-24 accent-primary-500"
                      />
                      <span className="text-sm text-gray-400 w-20 text-right">
                        {formatMinutes(config[day.key as keyof ScreenTimeConfig] as number)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Time Window */}
            <motion.div
              className={`bg-surface-card rounded-xl border border-white/5 p-6 ${
                !config.is_enabled ? "opacity-50" : ""
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Allowed Time Window</h3>
              <p className="text-sm text-gray-400 mb-6">
                Optionally restrict usage to specific hours. Leave empty for no restrictions.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={config.allowed_start_time || ""}
                    onChange={(e) => updateConfig("allowed_start_time", e.target.value || null)}
                    disabled={!config.is_enabled}
                    className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">End Time</label>
                  <input
                    type="time"
                    value={config.allowed_end_time || ""}
                    onChange={(e) => updateConfig("allowed_end_time", e.target.value || null)}
                    disabled={!config.is_enabled}
                    className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>
            </motion.div>

            {/* Grace Period */}
            <motion.div
              className={`bg-surface-card rounded-xl border border-white/5 p-6 ${
                !config.is_enabled ? "opacity-50" : ""
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Grace Period</h3>
              <p className="text-sm text-gray-400 mb-6">
                Allow a warning period before enforcing limits.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="5"
                  value={config.grace_period}
                  onChange={(e) => updateConfig("grace_period", parseInt(e.target.value))}
                  disabled={!config.is_enabled}
                  className="flex-1 accent-primary-500"
                />
                <span className="text-white font-medium w-24 text-right">
                  {config.grace_period} minutes
                </span>
              </div>
            </motion.div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
