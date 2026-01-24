"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Save, Bell, Shield, Mail, Globe, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/admin/sidebar";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface SettingsSectionProps {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function SettingsSection({ title, description, icon: Icon, children }: SettingsSectionProps) {
  return (
    <motion.div
      className="bg-surface-card rounded-2xl border border-white/5 p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function ToggleSetting({ label, description, enabled, onChange }: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`w-12 h-6 rounded-full transition-colors relative ${
          enabled ? "bg-primary-500" : "bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            enabled ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { user, isLoading } = useAdminAuth();
  const [saved, setSaved] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    emailNotifications: true,
    newUserAlerts: true,
    paymentAlerts: true,
    weeklyReports: false,
    maintenanceMode: false,
    registrationEnabled: true,
    trialDays: 7,
    requireEmailVerification: true,
  });

  const handleSave = () => {
    // In a real app, this would save to the backend
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateSetting = (key: keyof typeof settings, value: boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <AdminSidebar activePage="settings" user={user} />

      <main className="ml-64 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
            <p className="text-gray-400">Configure platform settings</p>
          </div>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4" />
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>

        {saved && (
          <motion.div
            className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg mb-6 text-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Settings saved successfully!
          </motion.div>
        )}

        <div className="grid gap-6 max-w-3xl">
          {/* Notifications */}
          <SettingsSection
            title="Notifications"
            description="Configure how you receive alerts"
            icon={Bell}
          >
            <ToggleSetting
              label="Email Notifications"
              description="Receive important updates via email"
              enabled={settings.emailNotifications}
              onChange={(v) => updateSetting("emailNotifications", v)}
            />
            <ToggleSetting
              label="New User Alerts"
              description="Get notified when new users register"
              enabled={settings.newUserAlerts}
              onChange={(v) => updateSetting("newUserAlerts", v)}
            />
            <ToggleSetting
              label="Payment Alerts"
              description="Get notified about payments and subscriptions"
              enabled={settings.paymentAlerts}
              onChange={(v) => updateSetting("paymentAlerts", v)}
            />
            <ToggleSetting
              label="Weekly Reports"
              description="Receive weekly summary reports"
              enabled={settings.weeklyReports}
              onChange={(v) => updateSetting("weeklyReports", v)}
            />
          </SettingsSection>

          {/* Security */}
          <SettingsSection
            title="Security"
            description="Platform security settings"
            icon={Shield}
          >
            <ToggleSetting
              label="Require Email Verification"
              description="Users must verify email before accessing dashboard"
              enabled={settings.requireEmailVerification}
              onChange={(v) => updateSetting("requireEmailVerification", v)}
            />
            <ToggleSetting
              label="Maintenance Mode"
              description="Temporarily disable access for non-admin users"
              enabled={settings.maintenanceMode}
              onChange={(v) => updateSetting("maintenanceMode", v)}
            />
          </SettingsSection>

          {/* Registration */}
          <SettingsSection
            title="Registration"
            description="Control user registration settings"
            icon={Globe}
          >
            <ToggleSetting
              label="Registration Enabled"
              description="Allow new users to register"
              enabled={settings.registrationEnabled}
              onChange={(v) => updateSetting("registrationEnabled", v)}
            />
            <div className="py-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Trial Duration</p>
                  <p className="text-xs text-gray-500">Number of days for free trial</p>
                </div>
                <select
                  value={settings.trialDays}
                  onChange={(e) => updateSetting("trialDays", Number(e.target.value))}
                  className="bg-surface-elevated border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-primary-500"
                >
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>
            </div>
          </SettingsSection>

          {/* API Keys */}
          <SettingsSection
            title="API Configuration"
            description="Manage external service integrations"
            icon={Key}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Stripe Secret Key
                </label>
                <input
                  type="password"
                  value="sk_live_••••••••••••••••"
                  disabled
                  className="w-full bg-surface-elevated border border-white/10 rounded-lg py-2 px-3 text-gray-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Configured via environment variables
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SMTP Server
                </label>
                <input
                  type="text"
                  value="smtp.example.com"
                  disabled
                  className="w-full bg-surface-elevated border border-white/10 rounded-lg py-2 px-3 text-gray-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Configured via environment variables
                </p>
              </div>
            </div>
          </SettingsSection>
        </div>
      </main>
    </div>
  );
}
