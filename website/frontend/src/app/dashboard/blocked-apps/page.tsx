"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  Ban,
  Laptop,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  Gamepad2,
  AppWindow,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Installation {
  id: string;
  device_name: string | null;
  platform: string;
}

interface BlockedApp {
  id: string;
  app_name: string;
  app_identifier: string;
  platform: string;
  is_game: boolean;
  is_enabled: boolean;
  schedule: Record<string, unknown> | null;
  created_at: string;
}

export default function BlockedAppsPage() {
  const { user, isLoading: authLoading, authFetch, logout } = useCustomerAuth();
  const [devices, setDevices] = useState<Installation[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [apps, setApps] = useState<BlockedApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "apps" | "games">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add form state
  const [newApp, setNewApp] = useState({
    app_name: "",
    app_identifier: "",
    is_game: false,
  });
  const [isAdding, setIsAdding] = useState(false);

  const fetchDevices = async () => {
    try {
      const response = await authFetch(`${API_URL}/device/installations`);
      if (!response.ok) throw new Error("Failed to fetch devices");
      const data = await response.json();
      const activeDevices = data.filter((d: Installation & { status: string }) => d.status === "active");
      setDevices(activeDevices);
      if (activeDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(activeDevices[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    }
  };

  const fetchApps = async (deviceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/parental/blocked-apps/${deviceId}`);
      if (!response.ok) throw new Error("Failed to fetch blocked apps");
      const data = await response.json();
      setApps(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load blocked apps");
    } finally {
      setIsLoading(false);
    }
  };

  const addApp = async () => {
    if (!selectedDevice || !newApp.app_name || !newApp.app_identifier) return;

    setIsAdding(true);
    setError(null);
    try {
      const device = devices.find((d) => d.id === selectedDevice);
      const response = await authFetch(`${API_URL}/parental/blocked-apps/${selectedDevice}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newApp,
          platform: device?.platform || "windows",
          is_enabled: true,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to add app");
      }
      const addedApp = await response.json();
      setApps([...apps, addedApp]);
      setShowAddModal(false);
      setNewApp({ app_name: "", app_identifier: "", is_game: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add app");
    } finally {
      setIsAdding(false);
    }
  };

  const toggleApp = async (appId: string, isEnabled: boolean) => {
    if (!selectedDevice) return;

    try {
      const response = await authFetch(`${API_URL}/parental/blocked-apps/${selectedDevice}/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: isEnabled }),
      });
      if (!response.ok) throw new Error("Failed to update app");
      setApps(apps.map((app) => (app.id === appId ? { ...app, is_enabled: isEnabled } : app)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update app");
    }
  };

  const deleteApp = async (appId: string) => {
    if (!selectedDevice) return;

    setDeletingId(appId);
    try {
      const response = await authFetch(`${API_URL}/parental/blocked-apps/${selectedDevice}/${appId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete app");
      setApps(apps.filter((app) => app.id !== appId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete app");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchDevices();
    }
  }, [authLoading]);

  useEffect(() => {
    if (selectedDevice) {
      fetchApps(selectedDevice);
    }
  }, [selectedDevice]);

  const filteredApps = apps.filter((app) => {
    if (filter === "all") return true;
    if (filter === "games") return app.is_game;
    return !app.is_game;
  });

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
              <Ban className="w-8 h-8 text-red-400" />
              Blocked Apps
            </h1>
            <p className="text-gray-400">Manage applications and games to block on devices.</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => selectedDevice && fetchApps(selectedDevice)}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAddModal(true)} disabled={!selectedDevice}>
              <Plus className="w-4 h-4" />
              Add App
            </Button>
          </div>
        </motion.div>

        {/* Device Selector & Filter */}
        <motion.div
          className="flex flex-col md:flex-row gap-4 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {devices.length > 0 && (
            <div>
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
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Filter</label>
            <div className="flex gap-2">
              {(["all", "apps", "games"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? "bg-primary-500 text-white"
                      : "bg-surface-card text-gray-400 hover:text-white"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
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
              You need to have at least one active device to manage blocked apps.
            </p>
            <Link href="/dashboard/download">
              <Button>Add Your First Device</Button>
            </Link>
          </motion.div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : filteredApps.length === 0 ? (
          <motion.div
            className="bg-surface-card rounded-2xl border border-white/5 p-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-surface-elevated flex items-center justify-center mb-6">
              <Ban className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Blocked Apps</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              You haven&apos;t blocked any {filter === "all" ? "apps" : filter} yet. Add apps to
              block them on this device.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              Add Your First App
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredApps.map((app, index) => (
              <motion.div
                key={app.id}
                className="bg-surface-card rounded-xl border border-white/5 p-4 flex items-center justify-between hover:border-primary-500/20 transition-all"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      app.is_game ? "bg-purple-500/10" : "bg-blue-500/10"
                    }`}
                  >
                    {app.is_game ? (
                      <Gamepad2 className="w-5 h-5 text-purple-400" />
                    ) : (
                      <AppWindow className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{app.app_name}</h3>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{app.app_identifier}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      app.is_game
                        ? "bg-purple-500/10 text-purple-400"
                        : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {app.is_game ? "Game" : "App"}
                  </span>
                  <button
                    onClick={() => toggleApp(app.id, !app.is_enabled)}
                    className="text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    {app.is_enabled ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-500" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteApp(app.id)}
                    disabled={deletingId === app.id}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {deletingId === app.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Add App Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-surface-card rounded-2xl border border-white/10 p-6 w-full max-w-md"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Add Blocked App</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">App Name</label>
                <input
                  type="text"
                  value={newApp.app_name}
                  onChange={(e) => setNewApp({ ...newApp, app_name: e.target.value })}
                  placeholder="e.g., Chrome, Minecraft"
                  className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  App Identifier / Path
                </label>
                <input
                  type="text"
                  value={newApp.app_identifier}
                  onChange={(e) => setNewApp({ ...newApp, app_identifier: e.target.value })}
                  placeholder="e.g., chrome.exe, com.mojang.minecraft"
                  className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the executable name (Windows), bundle ID (macOS), or package name (Android).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNewApp({ ...newApp, is_game: !newApp.is_game })}
                  className="text-primary-400"
                >
                  {newApp.is_game ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-500" />
                  )}
                </button>
                <span className="text-white">This is a game</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={addApp}
                disabled={!newApp.app_name || !newApp.app_identifier || isAdding}
                className="flex-1"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add App
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
