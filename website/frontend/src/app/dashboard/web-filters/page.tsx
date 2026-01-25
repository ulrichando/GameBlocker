"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  Globe,
  Laptop,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  Save,
  ToggleLeft,
  ToggleRight,
  X,
  Search,
  Ban,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Installation {
  id: string;
  device_name: string | null;
  platform: string;
}

interface WebFilterConfig {
  id: string;
  installation_id: string;
  is_enabled: boolean;
  blocked_categories: string[];
  enforce_safe_search: boolean;
  rules_count: number;
}

interface WebFilterRule {
  id: string;
  url_pattern: string;
  is_blocked: boolean;
  is_enabled: boolean;
  notes: string | null;
  created_at: string;
}

const CATEGORIES = [
  { id: "adult", name: "Adult Content", description: "Block adult and explicit content" },
  { id: "social_media", name: "Social Media", description: "Block social networking sites" },
  { id: "gaming", name: "Gaming", description: "Block online gaming websites" },
  { id: "gambling", name: "Gambling", description: "Block gambling and betting sites" },
  { id: "streaming", name: "Streaming", description: "Block video streaming services" },
  { id: "shopping", name: "Shopping", description: "Block e-commerce and shopping sites" },
  { id: "news", name: "News", description: "Block news websites" },
  { id: "forums", name: "Forums", description: "Block discussion forums" },
];

export default function WebFiltersPage() {
  const { user, isLoading: authLoading, authFetch, logout } = useCustomerAuth();
  const [devices, setDevices] = useState<Installation[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [config, setConfig] = useState<WebFilterConfig | null>(null);
  const [rules, setRules] = useState<WebFilterRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New rule form
  const [newRule, setNewRule] = useState({
    url_pattern: "",
    is_blocked: true,
    notes: "",
  });
  const [isAddingRule, setIsAddingRule] = useState(false);

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

  const fetchConfig = async (deviceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [configRes, rulesRes] = await Promise.all([
        authFetch(`${API_URL}/parental/web-filters/${deviceId}`),
        authFetch(`${API_URL}/parental/web-filters/${deviceId}/rules`),
      ]);

      if (!configRes.ok) throw new Error("Failed to fetch configuration");
      const configData = await configRes.json();
      setConfig(configData);

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData);
      }
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
      const response = await authFetch(`${API_URL}/parental/web-filters/${selectedDevice}`, {
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

  const toggleCategory = (categoryId: string) => {
    if (!config) return;
    const categories = config.blocked_categories.includes(categoryId)
      ? config.blocked_categories.filter((c) => c !== categoryId)
      : [...config.blocked_categories, categoryId];
    setConfig({ ...config, blocked_categories: categories });
    setHasChanges(true);
  };

  const addRule = async () => {
    if (!selectedDevice || !newRule.url_pattern) return;

    setIsAddingRule(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/parental/web-filters/${selectedDevice}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url_pattern: newRule.url_pattern,
          is_blocked: newRule.is_blocked,
          is_enabled: true,
          notes: newRule.notes || null,
        }),
      });
      if (!response.ok) throw new Error("Failed to add rule");
      const addedRule = await response.json();
      setRules([addedRule, ...rules]);
      setShowAddRule(false);
      setNewRule({ url_pattern: "", is_blocked: true, notes: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setIsAddingRule(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!selectedDevice) return;

    setDeletingId(ruleId);
    try {
      const response = await authFetch(
        `${API_URL}/parental/web-filters/${selectedDevice}/rules/${ruleId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to delete rule");
      setRules(rules.filter((r) => r.id !== ruleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
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
              <Globe className="w-8 h-8 text-blue-400" />
              Web Filters
            </h1>
            <p className="text-gray-400">Block websites by category or custom URLs.</p>
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
              You need to have at least one active device to configure web filters.
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
            {/* Enable/Disable & Safe Search */}
            <motion.div
              className="bg-surface-card rounded-xl border border-white/5 p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Enable Web Filtering</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Turn on to block websites on this device.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setConfig({ ...config, is_enabled: !config.is_enabled });
                    setHasChanges(true);
                  }}
                  className="text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {config.is_enabled ? (
                    <ToggleRight className="w-12 h-12" />
                  ) : (
                    <ToggleLeft className="w-12 h-12 text-gray-500" />
                  )}
                </button>
              </div>

              <div className="border-t border-white/5 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">Enforce Safe Search</h4>
                    <p className="text-sm text-gray-400">
                      Force safe search on Google, Bing, and YouTube.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setConfig({ ...config, enforce_safe_search: !config.enforce_safe_search });
                      setHasChanges(true);
                    }}
                    disabled={!config.is_enabled}
                    className="text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50"
                  >
                    {config.enforce_safe_search ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Category Filters */}
            <motion.div
              className={`bg-surface-card rounded-xl border border-white/5 p-6 ${
                !config.is_enabled ? "opacity-50" : ""
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Block Categories</h3>
              <p className="text-sm text-gray-400 mb-6">
                Select categories of websites to block.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CATEGORIES.map((category) => {
                  const isSelected = config.blocked_categories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      disabled={!config.is_enabled}
                      className={`p-4 rounded-lg text-left transition-all ${
                        isSelected
                          ? "bg-primary-500/10 border-primary-500/30 border"
                          : "bg-surface-elevated hover:bg-white/5 border border-transparent"
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{category.name}</span>
                        {isSelected ? (
                          <Ban className="w-5 h-5 text-red-400" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{category.description}</p>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Custom Rules */}
            <motion.div
              className={`bg-surface-card rounded-xl border border-white/5 p-6 ${
                !config.is_enabled ? "opacity-50" : ""
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Custom Rules</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Add specific websites to block or allow.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddRule(true)}
                  disabled={!config.is_enabled}
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </Button>
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No custom rules yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between py-3 px-4 bg-surface-elevated rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {rule.is_blocked ? (
                          <Ban className="w-4 h-4 text-red-400" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                        <div>
                          <p className="text-white font-medium">{rule.url_pattern}</p>
                          {rule.notes && (
                            <p className="text-xs text-gray-500">{rule.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            rule.is_blocked
                              ? "bg-red-500/10 text-red-400"
                              : "bg-green-500/10 text-green-400"
                          }`}
                        >
                          {rule.is_blocked ? "Blocked" : "Allowed"}
                        </span>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          disabled={deletingId === rule.id}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          {deletingId === rule.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        ) : null}
      </main>

      {/* Add Rule Modal */}
      {showAddRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-surface-card rounded-2xl border border-white/10 p-6 w-full max-w-md"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Add Custom Rule</h2>
              <button
                onClick={() => setShowAddRule(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  URL / Domain Pattern
                </label>
                <input
                  type="text"
                  value={newRule.url_pattern}
                  onChange={(e) => setNewRule({ ...newRule, url_pattern: e.target.value })}
                  placeholder="e.g., facebook.com, *.tiktok.com"
                  className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Action</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewRule({ ...newRule, is_blocked: true })}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      newRule.is_blocked
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-surface-elevated text-gray-400"
                    }`}
                  >
                    Block
                  </button>
                  <button
                    onClick={() => setNewRule({ ...newRule, is_blocked: false })}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      !newRule.is_blocked
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-surface-elevated text-gray-400"
                    }`}
                  >
                    Allow
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={newRule.notes}
                  onChange={(e) => setNewRule({ ...newRule, notes: e.target.value })}
                  placeholder="e.g., Block for homework time"
                  className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowAddRule(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={addRule}
                disabled={!newRule.url_pattern || isAddingRule}
                className="flex-1"
              >
                {isAddingRule ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Rule
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
