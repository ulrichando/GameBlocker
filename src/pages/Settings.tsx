import { useState, useEffect } from "react";
import { ArrowLeft, Key, Eye, EyeOff, Copy, Check, Server, Play, Square, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { useDaemonStore } from "@/stores/daemon-store";
import { invoke } from "@tauri-apps/api/core";

interface SettingsPageProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsPageProps) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const { changePassword, isLoading } = useAuthStore();
  const {
    status: daemonStatus,
    fetchStatus: fetchDaemonStatus,
    installDaemon,
    uninstallDaemon,
    startDaemon,
    stopDaemon,
    isLoading: daemonLoading,
    error: daemonError,
  } = useDaemonStore();

  useEffect(() => {
    fetchDaemonStatus();
  }, []);

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    const result = await changePassword(oldPassword, newPassword);
    if (result) {
      setSuccess("Password changed successfully");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowChangePassword(false);
    } else {
      setError("Current password is incorrect");
    }
  };

  const handleShowMasterPassword = async () => {
    setError("");
    try {
      const master = await invoke<string | null>("get_master_password", {
        password: verifyPassword,
      });
      if (master) {
        setMasterPassword(master);
        setVerifyPassword("");
      } else {
        setError("Invalid password");
      }
    } catch (err) {
      setError("Failed to retrieve master password");
    }
  };

  const handleCopyMasterPassword = () => {
    navigator.clipboard.writeText(masterPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">App preferences</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Password Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showChangePassword ? (
              <Button variant="outline" onClick={() => setShowChangePassword(true)}>
                Change Password
              </Button>
            ) : (
              <div className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
                {success && <p className="text-sm text-green-500">{success}</p>}

                <div className="flex gap-2">
                  <Button onClick={handleChangePassword} disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowChangePassword(false);
                      setError("");
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Master Password Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recovery Password</CardTitle>
            <CardDescription>
              View your master recovery password (requires verification)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showMasterPassword ? (
              <Button variant="outline" onClick={() => setShowMasterPassword(true)}>
                View Recovery Password
              </Button>
            ) : masterPassword ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                    Master Recovery Password
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-lg font-mono font-bold text-amber-900 dark:text-amber-200">
                      {masterPassword}
                    </code>
                    <Button variant="ghost" size="sm" onClick={handleCopyMasterPassword}>
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMasterPassword(false);
                    setMasterPassword("");
                  }}
                >
                  Hide
                </Button>
              </div>
            ) : (
              <div className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label>Enter your password to verify</Label>
                  <Input
                    type="password"
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleShowMasterPassword()}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <Button onClick={handleShowMasterPassword}>Verify</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowMasterPassword(false);
                      setVerifyPassword("");
                      setError("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daemon/Service Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" />
              Background Service
            </CardTitle>
            <CardDescription>
              The background service ensures blocking works even when the app is closed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Service Status</p>
                <p className="text-sm text-muted-foreground">
                  {!daemonStatus?.installed
                    ? "Not installed"
                    : daemonStatus?.running
                    ? "Running"
                    : "Stopped"}
                </p>
              </div>
              <Badge
                variant={daemonStatus?.running ? "default" : "secondary"}
                className={daemonStatus?.running ? "bg-green-500" : ""}
              >
                {daemonStatus?.running ? "Active" : daemonStatus?.installed ? "Inactive" : "Not Installed"}
              </Badge>
            </div>

            {daemonStatus?.running && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Uptime: {Math.floor((daemonStatus.uptimeSecs || 0) / 60)} minutes</p>
                <p>Processes blocked: {daemonStatus.blockedCount || 0}</p>
                <p>Firewall active: {daemonStatus.firewallActive ? "Yes" : "No"}</p>
              </div>
            )}

            {daemonError && (
              <p className="text-sm text-red-500">{daemonError}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {!daemonStatus?.installed ? (
                <Button onClick={installDaemon} disabled={daemonLoading}>
                  <Download className="h-4 w-4 mr-2" />
                  {daemonLoading ? "Installing..." : "Install Service"}
                </Button>
              ) : (
                <>
                  {daemonStatus?.running ? (
                    <Button variant="outline" onClick={stopDaemon} disabled={daemonLoading}>
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  ) : (
                    <Button onClick={startDaemon} disabled={daemonLoading}>
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </Button>
                  )}
                  <Button variant="destructive" onClick={uninstallDaemon} disabled={daemonLoading}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Uninstall
                  </Button>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              The service runs with administrator privileges to manage hosts file and firewall rules without password prompts.
            </p>
          </CardContent>
        </Card>

        {/* About Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>GameBlocker</strong> v0.1.0</p>
            <p>Cross-platform parental control software for blocking games and AI services.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
