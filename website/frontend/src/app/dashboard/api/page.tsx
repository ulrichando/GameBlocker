"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Code,
  Loader2,
  Plus,
  Copy,
  Trash2,
  Check,
  Globe,
  Send,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Key,
  BookOpen,
  Terminal,
  Shield,
  Clock,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  is_revoked: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface NewAPIKey extends APIKey {
  key: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface WebhookWithSecret extends Webhook {
  secret: string;
}

interface WebhookEvent {
  id: string;
  name: string;
  description: string;
}

type TabType = "keys" | "webhooks" | "docs";

const AVAILABLE_SCOPES = [
  { id: "read", name: "Read", description: "Read device data, alerts, and settings" },
  { id: "write", name: "Write", description: "Modify settings and configurations" },
  { id: "alerts", name: "Alerts", description: "Access and manage alerts" },
  { id: "devices", name: "Devices", description: "Manage connected devices" },
];

export default function APIPage() {
  const { isLoading: authLoading, authFetch } = useCustomerAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("keys");

  // API Keys state
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);
  const [showCreateKeyForm, setShowCreateKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read"]);
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>("");
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [availableEvents, setAvailableEvents] = useState<WebhookEvent[]>([]);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(false);
  const [showCreateWebhookForm, setShowCreateWebhookForm] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookDescription, setNewWebhookDescription] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [newlyCreatedWebhook, setNewlyCreatedWebhook] = useState<WebhookWithSecret | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // API Key functions
  const fetchApiKeys = async () => {
    setIsLoadingApiKeys(true);
    try {
      const response = await authFetch(`${API_URL}/api/v1/api-keys`);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data);
      }
    } catch (err) {
      console.error("Failed to fetch API keys:", err);
    } finally {
      setIsLoadingApiKeys(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;

    setIsCreatingKey(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: newKeyName,
        scopes: newKeyScopes
      };
      if (newKeyExpiry) {
        body.expires_at = new Date(newKeyExpiry).toISOString();
      }

      const response = await authFetch(`${API_URL}/api/v1/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to create API key");

      const data: NewAPIKey = await response.json();
      setNewlyCreatedKey(data.key);
      setApiKeys((prev) => [{ ...data, key: undefined } as unknown as APIKey, ...prev]);
      setNewKeyName("");
      setNewKeyScopes(["read"]);
      setNewKeyExpiry("");
      setShowCreateKeyForm(false);
      setSuccess("API key created! Make sure to copy it - it won't be shown again.");
      setTimeout(() => setSuccess(null), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreatingKey(false);
    }
  };

  const revokeApiKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) return;

    try {
      const response = await authFetch(`${API_URL}/api/v1/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to revoke API key");

      setApiKeys((prev) => prev.filter((key) => key.id !== keyId));
      setSuccess("API key revoked successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  };

  const copyToClipboard = async (text: string, keyId?: string) => {
    await navigator.clipboard.writeText(text);
    if (keyId) {
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
    }
    setSuccess("Copied to clipboard!");
    setTimeout(() => setSuccess(null), 2000);
  };

  // Webhook functions
  const fetchWebhooks = async () => {
    setIsLoadingWebhooks(true);
    try {
      const [webhooksRes, eventsRes] = await Promise.all([
        authFetch(`${API_URL}/api/v1/webhooks`),
        authFetch(`${API_URL}/api/v1/webhooks/events`),
      ]);

      if (webhooksRes.ok) {
        const data = await webhooksRes.json();
        setWebhooks(data);
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setAvailableEvents(data.events || []);
      }
    } catch (err) {
      console.error("Failed to fetch webhooks:", err);
    } finally {
      setIsLoadingWebhooks(false);
    }
  };

  const createWebhook = async () => {
    if (!newWebhookUrl.trim() || newWebhookEvents.length === 0) return;

    setIsCreatingWebhook(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/api/v1/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newWebhookUrl,
          events: newWebhookEvents,
          description: newWebhookDescription || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to create webhook");
      }

      const data: WebhookWithSecret = await response.json();
      setNewlyCreatedWebhook(data);
      setWebhooks((prev) => [{ ...data, secret: undefined } as unknown as Webhook, ...prev]);
      setNewWebhookUrl("");
      setNewWebhookDescription("");
      setNewWebhookEvents([]);
      setShowCreateWebhookForm(false);
      setSuccess("Webhook created! Make sure to copy the secret - it won't be shown again.");
      setTimeout(() => setSuccess(null), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setIsCreatingWebhook(false);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook? This cannot be undone.")) return;

    try {
      const response = await authFetch(`${API_URL}/api/v1/webhooks/${webhookId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete webhook");

      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
      setSuccess("Webhook deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete webhook");
    }
  };

  const toggleWebhook = async (webhookId: string, isActive: boolean) => {
    try {
      const response = await authFetch(`${API_URL}/api/v1/webhooks/${webhookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) throw new Error("Failed to update webhook");

      setWebhooks((prev) =>
        prev.map((w) => (w.id === webhookId ? { ...w, is_active: !isActive } : w))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update webhook");
    }
  };

  const testWebhook = async (webhookId: string) => {
    setTestingWebhookId(webhookId);
    try {
      const response = await authFetch(`${API_URL}/api/v1/webhooks/${webhookId}/test`, {
        method: "POST",
      });

      const data = await response.json();
      if (data.success) {
        setSuccess("Test webhook sent successfully!");
      } else {
        setError(`Webhook test failed: ${data.error_message || "Unknown error"}`);
      }
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test webhook");
    } finally {
      setTestingWebhookId(null);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setNewWebhookEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  const toggleScopeSelection = (scopeId: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  useEffect(() => {
    if (!authLoading) {
      fetchApiKeys();
      fetchWebhooks();
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

  const tabs = [
    { id: "keys" as TabType, label: "API Keys", icon: Key, count: apiKeys.filter(k => !k.is_revoked).length },
    { id: "webhooks" as TabType, label: "Webhooks", icon: Globe, count: webhooks.length },
    { id: "docs" as TabType, label: "Documentation", icon: BookOpen },
  ];

  return (
    <DashboardLayout>
      {/* Page Header */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-xl md:text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <div className="p-2 bg-primary-500/10 rounded-lg">
            <Code className="w-6 h-6 text-primary-400" />
          </div>
          API & Integrations
        </h1>
        <p className="text-gray-400">
          Connect ParentShield to your apps and services with API keys and webhooks.
        </p>
      </motion.div>

      {/* Alerts */}
      {error && (
        <motion.div
          className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-400">{error}</p>
        </motion.div>
      )}

      {success && (
        <motion.div
          className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
          <p className="text-green-400">{success}</p>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-primary-500 text-white"
                : "bg-surface-card text-gray-400 hover:text-white hover:bg-surface-elevated"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeTab === tab.id ? "bg-white/20" : "bg-white/10"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* API Keys Tab */}
      {activeTab === "keys" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-xl border border-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                  <Key className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{apiKeys.filter(k => !k.is_revoked).length}</p>
                  <p className="text-sm text-gray-500">Active Keys</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-card rounded-xl border border-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Shield className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">1,000</p>
                  <p className="text-sm text-gray-500">Requests/hour</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-card rounded-xl border border-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {apiKeys.filter(k => k.expires_at && new Date(k.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length}
                  </p>
                  <p className="text-sm text-gray-500">Expiring Soon</p>
                </div>
              </div>
            </div>
          </div>

          {/* Create Key Card */}
          <div className="bg-surface-card rounded-xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">API Keys</h2>
                <p className="text-sm text-gray-500">Manage your API keys for programmatic access</p>
              </div>
              <Button
                onClick={() => setShowCreateKeyForm(!showCreateKeyForm)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Generate New Key
              </Button>
            </div>

            {/* Create Key Form */}
            {showCreateKeyForm && (
              <motion.div
                className="bg-surface-elevated rounded-xl p-5 mb-6 border border-white/10"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <h3 className="text-white font-medium mb-4">Create New API Key</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Key Name *
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production Server, Mobile App"
                      className="w-full bg-surface-base border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Permissions
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_SCOPES.map((scope) => (
                        <label
                          key={scope.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            newKeyScopes.includes(scope.id)
                              ? "bg-primary-500/10 border-primary-500/30"
                              : "bg-surface-base border-white/10 hover:border-white/20"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={newKeyScopes.includes(scope.id)}
                            onChange={() => toggleScopeSelection(scope.id)}
                            className="mt-0.5 rounded border-white/20 bg-surface-base text-primary-500 focus:ring-primary-500"
                          />
                          <div>
                            <div className="font-medium text-white text-sm">{scope.name}</div>
                            <div className="text-xs text-gray-500">{scope.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Expiration (Optional)
                    </label>
                    <input
                      type="date"
                      value={newKeyExpiry}
                      onChange={(e) => setNewKeyExpiry(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full bg-surface-base border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowCreateKeyForm(false);
                        setNewKeyName("");
                        setNewKeyScopes(["read"]);
                        setNewKeyExpiry("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createApiKey}
                      disabled={isCreatingKey || !newKeyName.trim() || newKeyScopes.length === 0}
                    >
                      {isCreatingKey ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Create Key"
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Newly Created Key */}
            {newlyCreatedKey && (
              <motion.div
                className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-green-400 font-medium">API Key Created Successfully!</p>
                    <p className="text-green-400/70 text-sm">Copy this key now. You won&apos;t be able to see it again.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-surface-base rounded-lg p-3">
                  <code className="flex-1 text-sm text-white font-mono break-all">
                    {showKey ? newlyCreatedKey : "•".repeat(40)}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowKey(!showKey)}
                    title={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      copyToClipboard(newlyCreatedKey);
                      setTimeout(() => {
                        setNewlyCreatedKey(null);
                        setShowKey(false);
                      }, 500);
                    }}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Keys List */}
            {isLoadingApiKeys ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
                <Key className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400 font-medium">No API keys yet</p>
                <p className="text-gray-500 text-sm mt-1">Create your first API key to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      key.is_revoked
                        ? "bg-red-500/5 border-red-500/20 opacity-50"
                        : "bg-surface-elevated border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-white">{key.name}</span>
                        {key.is_revoked && (
                          <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-medium">
                            Revoked
                          </span>
                        )}
                        {key.expires_at && new Date(key.expires_at) < new Date() && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-medium">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <code className="font-mono text-gray-400">{key.key_prefix}...</code>
                        <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                        {key.last_used_at && (
                          <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                        )}
                        {key.expires_at && (
                          <span className={new Date(key.expires_at) < new Date() ? "text-red-400" : ""}>
                            Expires {new Date(key.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {key.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="text-xs px-2 py-0.5 bg-primary-500/10 text-primary-400 rounded"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(key.key_prefix, key.id)}
                        title="Copy key prefix"
                      >
                        {copiedKeyId === key.id ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      {!key.is_revoked && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revokeApiKey(key.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Revoke key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Webhooks Tab */}
      {activeTab === "webhooks" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-surface-card rounded-xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Webhooks</h2>
                <p className="text-sm text-gray-500">Receive real-time notifications for events</p>
              </div>
              <Button
                onClick={() => setShowCreateWebhookForm(!showCreateWebhookForm)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Webhook
              </Button>
            </div>

            {/* Create Webhook Form */}
            {showCreateWebhookForm && (
              <motion.div
                className="bg-surface-elevated rounded-xl p-5 mb-6 border border-white/10"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <h3 className="text-white font-medium mb-4">Create New Webhook</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Endpoint URL *
                    </label>
                    <input
                      type="url"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      placeholder="https://your-server.com/webhook"
                      className="w-full bg-surface-base border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={newWebhookDescription}
                      onChange={(e) => setNewWebhookDescription(e.target.value)}
                      placeholder="e.g., Slack notifications, Custom integration"
                      className="w-full bg-surface-base border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Events to Subscribe *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {availableEvents.map((event) => (
                        <label
                          key={event.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            newWebhookEvents.includes(event.id)
                              ? "bg-primary-500/10 border-primary-500/30"
                              : "bg-surface-base border-white/10 hover:border-white/20"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={newWebhookEvents.includes(event.id)}
                            onChange={() => toggleEventSelection(event.id)}
                            className="mt-0.5 rounded border-white/20 bg-surface-base text-primary-500 focus:ring-primary-500"
                          />
                          <div>
                            <div className="font-medium text-white text-sm">{event.name}</div>
                            <div className="text-xs text-gray-500">{event.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowCreateWebhookForm(false);
                        setNewWebhookUrl("");
                        setNewWebhookDescription("");
                        setNewWebhookEvents([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createWebhook}
                      disabled={isCreatingWebhook || !newWebhookUrl.trim() || newWebhookEvents.length === 0}
                    >
                      {isCreatingWebhook ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Create Webhook"
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Newly Created Webhook Secret */}
            {newlyCreatedWebhook && (
              <motion.div
                className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-green-400 font-medium">Webhook Created Successfully!</p>
                    <p className="text-green-400/70 text-sm">Copy this secret to verify webhook signatures.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-surface-base rounded-lg p-3">
                  <code className="flex-1 text-sm text-white font-mono break-all">
                    {newlyCreatedWebhook.secret}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      copyToClipboard(newlyCreatedWebhook.secret);
                      setNewlyCreatedWebhook(null);
                    }}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  Use this secret to verify the <code className="text-gray-400">X-Webhook-Signature</code> header.
                </p>
              </motion.div>
            )}

            {/* Webhooks List */}
            {isLoadingWebhooks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
                <Globe className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400 font-medium">No webhooks configured</p>
                <p className="text-gray-500 text-sm mt-1">Add a webhook to receive real-time event notifications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className={`p-4 rounded-xl border transition-all ${
                      webhook.is_active
                        ? "bg-surface-elevated border-white/10 hover:border-white/20"
                        : "bg-surface-elevated/50 border-white/5 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {webhook.is_active ? (
                            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-500 shrink-0" />
                          )}
                          <span className="font-semibold text-white truncate">
                            {webhook.description || "Webhook"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate mb-2 font-mono">{webhook.url}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {webhook.events.map((event) => (
                            <span
                              key={event}
                              className="text-xs px-2 py-0.5 bg-primary-500/10 text-primary-400 rounded"
                            >
                              {event}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => testWebhook(webhook.id)}
                          disabled={testingWebhookId === webhook.id || !webhook.is_active}
                          title="Send test webhook"
                        >
                          {testingWebhookId === webhook.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                        <button
                          onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                          className="text-primary-400 hover:text-primary-300 transition-colors"
                          title={webhook.is_active ? "Disable webhook" : "Enable webhook"}
                        >
                          {webhook.is_active ? (
                            <ToggleRight className="w-7 h-7" />
                          ) : (
                            <ToggleLeft className="w-7 h-7 text-gray-500" />
                          )}
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteWebhook(webhook.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Delete webhook"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-600">
                      Created {new Date(webhook.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Documentation Tab */}
      {activeTab === "docs" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Getting Started */}
          <div className="bg-surface-card rounded-xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary-400" />
              Getting Started
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-white font-medium mb-2">Authentication</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Include your API key in the <code className="bg-surface-elevated px-1.5 py-0.5 rounded text-xs text-primary-400">X-API-Key</code> header with every request.
                </p>
                <div className="bg-surface-elevated rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre className="text-gray-300">
{`curl -X GET "https://api.parentshield.com/api/v1/devices" \\
  -H "X-API-Key: your_api_key_here"`}
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="text-white font-medium mb-2">Base URL</h3>
                <div className="flex items-center gap-2 bg-surface-elevated rounded-lg p-3">
                  <code className="text-primary-400 font-mono text-sm">https://api.parentshield.com/api/v1</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard("https://api.parentshield.com/api/v1")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div className="bg-surface-card rounded-xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Available Endpoints</h2>

            <div className="space-y-3">
              {[
                { method: "GET", path: "/devices", description: "List all connected devices" },
                { method: "GET", path: "/devices/:id", description: "Get device details" },
                { method: "GET", path: "/alerts", description: "List recent alerts" },
                { method: "GET", path: "/settings", description: "Get current settings" },
                { method: "PUT", path: "/settings", description: "Update settings" },
                { method: "GET", path: "/blocked-apps", description: "List blocked applications" },
                { method: "POST", path: "/blocked-apps", description: "Add blocked application" },
                { method: "GET", path: "/web-filters", description: "List web filters" },
                { method: "POST", path: "/web-filters", description: "Add web filter" },
              ].map((endpoint, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    endpoint.method === "GET" ? "bg-green-500/20 text-green-400" :
                    endpoint.method === "POST" ? "bg-blue-500/20 text-blue-400" :
                    endpoint.method === "PUT" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {endpoint.method}
                  </span>
                  <code className="text-white font-mono text-sm">{endpoint.path}</code>
                  <span className="text-gray-500 text-sm ml-auto hidden md:block">{endpoint.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook Security */}
          <div className="bg-surface-card rounded-xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Webhook Security</h2>

            <p className="text-gray-400 text-sm mb-4">
              All webhooks include a signature in the <code className="bg-surface-elevated px-1.5 py-0.5 rounded text-xs text-primary-400">X-Webhook-Signature</code> header for verification.
            </p>

            <div className="bg-surface-elevated rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="w-5 h-5 text-primary-400" />
                <span className="text-white font-medium">HMAC-SHA256 Signed</span>
              </div>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>• Signature format: <code className="text-gray-300">sha256=&#123;hash&#125;</code></li>
                <li>• Use your webhook secret to verify signatures</li>
                <li>• Always verify before processing webhook data</li>
              </ul>
            </div>
          </div>

          {/* Rate Limits */}
          <div className="bg-surface-card rounded-xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Rate Limits</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-elevated rounded-lg p-4">
                <p className="text-2xl font-bold text-white">1,000</p>
                <p className="text-gray-500 text-sm">Requests per hour</p>
              </div>
              <div className="bg-surface-elevated rounded-lg p-4">
                <p className="text-2xl font-bold text-white">100</p>
                <p className="text-gray-500 text-sm">Requests per minute</p>
              </div>
            </div>

            <p className="text-gray-500 text-sm mt-4">
              Rate limit headers are included in every response: <code className="text-gray-400">X-RateLimit-Remaining</code>, <code className="text-gray-400">X-RateLimit-Reset</code>
            </p>
          </div>

          {/* Full Docs Link */}
          <div className="bg-linear-to-r from-primary-500/10 to-primary-600/10 rounded-xl border border-primary-500/20 p-6 text-center">
            <BookOpen className="w-10 h-10 text-primary-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Need More Help?</h3>
            <p className="text-gray-400 text-sm mb-4">
              Check out our public API documentation for more examples and use cases.
            </p>
            <a href="/api-docs" target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                <ExternalLink className="w-4 h-4" />
                View Public Docs
              </Button>
            </a>
          </div>
        </motion.div>
      )}
    </DashboardLayout>
  );
}
