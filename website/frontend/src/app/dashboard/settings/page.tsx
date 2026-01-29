"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Settings,
  Loader2,
  Save,
  User,
  Bell,
  Mail,
  Clock,
  ToggleLeft,
  ToggleRight,
  Key,
  CreditCard,
  ExternalLink,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserSettings {
  email_alerts: boolean;
  email_weekly_report: boolean;
  email_security_alerts: boolean;
  alert_blocked_sites: boolean;
  alert_blocked_apps: boolean;
  alert_screen_time: boolean;
  alert_tamper_attempts: boolean;
  timezone: string;
}

interface UserProfile {
  email: string;
  first_name: string | null;
  last_name: string | null;
}

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

export default function SettingsPage() {
  const { user, isLoading: authLoading, authFetch } = useCustomerAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [settingsRes, profileRes] = await Promise.all([
        authFetch(`${API_URL}/parental/settings`),
        authFetch(`${API_URL}/account/profile`),
      ]);

      if (!settingsRes.ok) throw new Error("Failed to fetch settings");
      const settingsData = await settingsRes.json();
      setSettings(settingsData);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await authFetch(`${API_URL}/parental/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to save settings");
      setHasChanges(false);
      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError("Passwords do not match");
      return;
    }
    if (passwordData.new_password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await authFetch(`${API_URL}/account/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
          confirm_password: passwordData.confirm_password,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        let errorMessage = "Failed to change password";
        if (typeof data.detail === "string") {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail) && data.detail.length > 0) {
          errorMessage = data.detail[0]?.msg || errorMessage;
        }
        throw new Error(errorMessage);
      }
      setSuccess("Password changed successfully!");
      setShowPasswordForm(false);
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const updateSetting = (key: keyof UserSettings, value: boolean | string) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  useEffect(() => {
    if (!authLoading) {
      fetchSettings();
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
          <h1 className="text-lg md:text-xl font-bold text-white mb-2 flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-400" />
            Settings
          </h1>
          <p className="text-gray-400">Manage your account and notification preferences.</p>
        </div>
        <Button size="sm" onClick={saveSettings} disabled={!hasChanges || isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </motion.div>

      {error && (
        <motion.div
          className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-red-400 text-center">{error}</p>
        </motion.div>
      )}

      {success && (
        <motion.div
          className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-green-400 text-center">{success}</p>
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      ) : settings ? (
        <div className="space-y-4">
          {/* Profile Section */}
          <motion.div
            className="bg-surface-card rounded-xl border border-white/5 p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-primary-400" />
              <h2 className="text-base font-semibold text-white">Profile</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={profile?.email || user?.email || ""}
                    disabled
                    className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2.5 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Not set"}
                    disabled
                    className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2.5 text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <button
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <Key className="w-4 h-4" />
                  Change Password
                </button>

                {showPasswordForm && (
                  <motion.div
                    className="mt-4 space-y-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={passwordData.current_password}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, current_password: e.target.value })
                        }
                        className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.new_password}
                          onChange={(e) =>
                            setPasswordData({ ...passwordData, new_password: e.target.value })
                          }
                          className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Confirm Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.confirm_password}
                          onChange={(e) =>
                            setPasswordData({ ...passwordData, confirm_password: e.target.value })
                          }
                          className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={changePassword}
                      disabled={isChangingPassword || !passwordData.current_password || !passwordData.new_password}
                    >
                      {isChangingPassword ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Key className="w-4 h-4" />
                      )}
                      Update Password
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Email Notifications */}
          <motion.div
            className="bg-surface-card rounded-xl border border-white/5 p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Mail className="w-5 h-5 text-primary-400" />
              <h2 className="text-base font-semibold text-white">Email Notifications</h2>
            </div>

            <div className="space-y-1">
              {[
                { key: "email_alerts", label: "Alert Emails", description: "Receive emails when alerts are triggered" },
                { key: "email_weekly_report", label: "Weekly Report", description: "Get a weekly summary of device activity" },
                { key: "email_security_alerts", label: "Security Alerts", description: "Important security notifications" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <h4 className="font-medium text-white">{item.label}</h4>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <button
                    onClick={() => updateSetting(item.key as keyof UserSettings, !settings[item.key as keyof UserSettings])}
                    className="text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    {settings[item.key as keyof UserSettings] ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-500" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Alert Preferences */}
          <motion.div
            className="bg-surface-card rounded-xl border border-white/5 p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-primary-400" />
              <h2 className="text-base font-semibold text-white">Alert Preferences</h2>
            </div>

            <div className="space-y-1">
              {[
                { key: "alert_blocked_sites", label: "Blocked Sites", description: "Alert when blocked websites are accessed" },
                { key: "alert_blocked_apps", label: "Blocked Apps", description: "Alert when blocked apps are launched" },
                { key: "alert_screen_time", label: "Screen Time", description: "Alert when screen time limits are reached" },
                { key: "alert_tamper_attempts", label: "Tamper Attempts", description: "Alert when someone tries to disable the app" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <h4 className="font-medium text-white">{item.label}</h4>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <button
                    onClick={() => updateSetting(item.key as keyof UserSettings, !settings[item.key as keyof UserSettings])}
                    className="text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    {settings[item.key as keyof UserSettings] ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-500" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Timezone */}
          <motion.div
            className="bg-surface-card rounded-xl border border-white/5 p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-primary-400" />
              <h2 className="text-base font-semibold text-white">Timezone</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Your Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => updateSetting("timezone", e.target.value)}
                className="w-full md:w-64 bg-surface-elevated border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-2">
                Used for scheduling and activity reports.
              </p>
            </div>
          </motion.div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subscription Link */}
            <motion.div
              className="bg-surface-card rounded-xl border border-white/5 p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="w-5 h-5 text-primary-400" />
                <h2 className="text-base font-semibold text-white">Subscription</h2>
              </div>

              <p className="text-gray-500 text-sm mb-4">
                Manage your subscription, billing, and payment methods.
              </p>

              <Link href="/dashboard/billing">
                <Button variant="secondary" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Manage Subscription
                </Button>
              </Link>
            </motion.div>

            {/* API Link */}
            <motion.div
              className="bg-surface-card rounded-xl border border-white/5 p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Code className="w-5 h-5 text-primary-400" />
                <h2 className="text-base font-semibold text-white">API & Integrations</h2>
              </div>

              <p className="text-gray-500 text-sm mb-4">
                Manage API keys and webhooks for programmatic access.
              </p>

              <Link href="/dashboard/api">
                <Button variant="secondary" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Manage API
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
