import { useState, useEffect } from "react";
import { ArrowLeft, Key, Eye, EyeOff, Copy, Check, Server, Play, Square, Trash2, Download, Globe, LogIn, LogOut, CreditCard, ExternalLink, Sun, Moon, Monitor } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TitleBar } from "@/components/TitleBar";
import { useAuthStore } from "@/stores/auth-store";
import { useDaemonStore } from "@/stores/daemon-store";
import { useLicenseStore } from "@/stores/license-store";
import { invoke } from "@tauri-apps/api/core";
import { apiService } from "@/services/api";
import { useThemeStore } from "@/stores/theme-store";

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

  // Website account state
  const [showWebsiteLogin, setShowWebsiteLogin] = useState(false);
  const [websiteEmail, setWebsiteEmail] = useState("");
  const [websitePassword, setWebsitePassword] = useState("");
  const [websiteLoggedIn, setWebsiteLoggedIn] = useState(false);
  const [websiteLoading, setWebsiteLoading] = useState(false);
  const [websiteError, setWebsiteError] = useState("");

  // Website account password change state
  const [showAccountPasswordChange, setShowAccountPasswordChange] = useState(false);
  const [accountCurrentPassword, setAccountCurrentPassword] = useState("");
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountConfirmPassword, setAccountConfirmPassword] = useState("");
  const [accountPasswordLoading, setAccountPasswordLoading] = useState(false);
  const [accountPasswordError, setAccountPasswordError] = useState("");
  const [accountPasswordSuccess, setAccountPasswordSuccess] = useState("");

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
  const {
    plan: licensePlan,
    status: licenseStatus,
    daysRemaining,
    upgradeUrl,
  } = useLicenseStore();
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    fetchDaemonStatus();
    // Check if already logged into website
    setWebsiteLoggedIn(apiService.isLoggedIn());

    // Subscribe to session expiration events (e.g., password changed on another device)
    apiService.onSessionExpired(() => {
      setWebsiteLoggedIn(false);
      setWebsiteError("Session expired. Password may have been changed.");
    });
  }, []);

  const handleWebsiteLogin = async () => {
    setWebsiteError("");
    setWebsiteLoading(true);
    try {
      const success = await apiService.login(websiteEmail, websitePassword);
      if (success) {
        setWebsiteLoggedIn(true);
        setShowWebsiteLogin(false);
        setWebsiteEmail("");
        setWebsitePassword("");
      } else {
        setWebsiteError("Invalid email or password");
      }
    } catch (err) {
      setWebsiteError("Connection failed. Please try again.");
    } finally {
      setWebsiteLoading(false);
    }
  };

  const handleWebsiteLogout = () => {
    apiService.logout();
    setWebsiteLoggedIn(false);
  };

  const handleAccountPasswordChange = async () => {
    setAccountPasswordError("");
    setAccountPasswordSuccess("");

    if (accountNewPassword !== accountConfirmPassword) {
      setAccountPasswordError("Passwords do not match");
      return;
    }

    if (accountNewPassword.length < 8) {
      setAccountPasswordError("Password must be at least 8 characters");
      return;
    }

    setAccountPasswordLoading(true);
    try {
      const result = await apiService.changePassword(accountCurrentPassword, accountNewPassword);
      if (result.success) {
        setAccountPasswordSuccess("Account password changed successfully");
        setAccountCurrentPassword("");
        setAccountNewPassword("");
        setAccountConfirmPassword("");
        setTimeout(() => {
          setShowAccountPasswordChange(false);
          setAccountPasswordSuccess("");
        }, 2000);
      } else {
        setAccountPasswordError(result.error || "Failed to change password");
      }
    } catch (err) {
      setAccountPasswordError("Connection failed. Please try again.");
    } finally {
      setAccountPasswordLoading(false);
    }
  };

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
    if (result.success) {
      setSuccess("Password changed successfully");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowChangePassword(false);
    } else {
      setError(result.error || "Current password is incorrect");
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
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header - Fluent 2 Custom Title Bar */}
      <TitleBar>
        <div className="flex items-center px-2 gap-1 h-full">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-6 w-6 rounded hover:bg-foreground/10">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-semibold">Settings</span>
        </div>
      </TitleBar>

      <main className="flex-1 overflow-y-auto scrollable-content">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
        {/* Password Section */}
        <Card className="fluent-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
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

        {/* Website Account Section */}
        <Card className="fluent-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              ParentShield Account
            </CardTitle>
            <CardDescription className="text-xs">
              Connect to your ParentShield subscription account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            {websiteLoggedIn ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Device ID: {apiService.getDeviceId()}
                    </p>
                  </div>
                  <Badge variant="default" className="bg-green-500">Active</Badge>
                </div>

                {/* Subscription Info */}
                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Subscription</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <Badge
                      variant={licenseStatus === "active" || licenseStatus === "trialing" ? "default" : "secondary"}
                      className={licenseStatus === "active" ? "bg-green-500" : licenseStatus === "trialing" ? "bg-blue-500" : ""}
                    >
                      {licensePlan === "none" || licensePlan === "expired_trial" ? "No Plan" : licensePlan}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className="text-sm capitalize">
                      {licenseStatus === "trialing" ? "Trial" : licenseStatus === "expired_trial" ? "Expired" : licenseStatus}
                    </span>
                  </div>
                  {licenseStatus === "trialing" && daysRemaining !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Days Remaining</span>
                      <span className={`text-sm font-medium ${daysRemaining <= 2 ? "text-red-500" : "text-blue-500"}`}>
                        {daysRemaining > 0 ? `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}` : "Expires today"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Account Password Change Form */}
                {showAccountPasswordChange ? (
                  <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Change Account Password</span>
                    </div>
                    <div className="space-y-4 max-w-sm">
                      <div className="space-y-2">
                        <Label>Current Password</Label>
                        <Input
                          type="password"
                          value={accountCurrentPassword}
                          onChange={(e) => setAccountCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>New Password</Label>
                        <Input
                          type="password"
                          value={accountNewPassword}
                          onChange={(e) => setAccountNewPassword(e.target.value)}
                          placeholder="Enter new password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Confirm New Password</Label>
                        <Input
                          type="password"
                          value={accountConfirmPassword}
                          onChange={(e) => setAccountConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          onKeyDown={(e) => e.key === "Enter" && handleAccountPasswordChange()}
                        />
                      </div>
                      {accountPasswordError && <p className="text-sm text-red-500">{accountPasswordError}</p>}
                      {accountPasswordSuccess && <p className="text-sm text-green-500">{accountPasswordSuccess}</p>}
                      <div className="flex gap-2">
                        <Button onClick={handleAccountPasswordChange} disabled={accountPasswordLoading}>
                          {accountPasswordLoading ? "Saving..." : "Change Password"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAccountPasswordChange(false);
                            setAccountCurrentPassword("");
                            setAccountNewPassword("");
                            setAccountConfirmPassword("");
                            setAccountPasswordError("");
                            setAccountPasswordSuccess("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {upgradeUrl && (licenseStatus === "trialing" || licenseStatus === "expired_trial" || licensePlan === "Basic") && (
                    <Button
                      variant="default"
                      onClick={async () => {
                        try { await openUrl(upgradeUrl); } catch { window.open(upgradeUrl, "_blank"); }
                      }}
                      className="bg-primary hover:bg-primary-600"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Upgrade Plan
                    </Button>
                  )}
                  {!showAccountPasswordChange && (
                    <Button variant="outline" onClick={() => setShowAccountPasswordChange(true)}>
                      <Key className="h-4 w-4 mr-2" />
                      Change Account Password
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleWebsiteLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Disconnect Account
                  </Button>
                </div>
              </div>
            ) : !showWebsiteLogin ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your ParentShield account to sync settings and validate your subscription.
                </p>
                <Button variant="outline" onClick={() => setShowWebsiteLogin(true)}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Connect Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={websiteEmail}
                    onChange={(e) => setWebsiteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Your account password"
                    value={websitePassword}
                    onChange={(e) => setWebsitePassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleWebsiteLogin()}
                  />
                </div>
                {websiteError && <p className="text-sm text-red-500">{websiteError}</p>}
                <div className="flex gap-2">
                  <Button onClick={handleWebsiteLogin} disabled={websiteLoading}>
                    {websiteLoading ? "Connecting..." : "Connect"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowWebsiteLogin(false);
                      setWebsiteEmail("");
                      setWebsitePassword("");
                      setWebsiteError("");
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
        <Card className="fluent-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Recovery Password</CardTitle>
            <CardDescription className="text-xs">
              View your master recovery password (requires verification)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
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
        <Card className="fluent-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-secondary" />
              Background Service
            </CardTitle>
            <CardDescription className="text-xs">
              The background service ensures blocking works even when the app is closed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
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

        {/* Appearance Section */}
        <Card className="fluent-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sun className="h-4 w-4 text-primary" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Theme</Label>
              <div className="flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  className="flex-1 h-8 text-xs"
                >
                  <Sun className="h-3.5 w-3.5 mr-1.5" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  className="flex-1 h-8 text-xs"
                >
                  <Moon className="h-3.5 w-3.5 mr-1.5" />
                  Dark
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("system")}
                  className="flex-1 h-8 text-xs"
                >
                  <Monitor className="h-3.5 w-3.5 mr-1.5" />
                  System
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About Section */}
        <Card className="fluent-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground px-4 pb-4">
            <p><strong>ParentShield</strong> v0.2.0</p>
            <p>Cross-platform parental control software for blocking games and AI services.</p>
          </CardContent>
        </Card>
        </div>
      </main>
    </div>
  );
}
