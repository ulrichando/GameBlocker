import { useEffect } from "react";
import {
  Shield,
  ShieldOff,
  Gamepad2,
  Bot,
  Globe,
  Calendar,
  List,
  Settings,
  LogOut,
  AlertCircle,
  X,
  Flame,
  CheckCircle2,
  Server,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useBlockingStore } from "@/stores/blocking-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDaemonStore } from "@/stores/daemon-store";

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const {
    gameBlockingEnabled,
    aiBlockingEnabled,
    dnsBlockingEnabled,
    currentlyBlocking,
    firewallBlockingActive,
    recentlyBlocked,
    fetchStatus,
    setGameBlocking,
    setAiBlocking,
    setDnsBlocking,
    isLoading,
    error,
    clearError,
    dohDisabled,
    dohConfiguredBrowsers,
    disableBrowserDoh,
    enableFirewallBlocking,
    disableFirewallBlocking,
  } = useBlockingStore();

  const { logout } = useAuthStore();
  const { status: daemonStatus, fetchStatus: fetchDaemonStatus } = useDaemonStore();

  useEffect(() => {
    fetchStatus();
    fetchDaemonStatus();
  }, []);

  const isProtectionActive = currentlyBlocking && (gameBlockingEnabled || aiBlockingEnabled || dnsBlockingEnabled);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">ParentShield</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-gray-700 dark:text-gray-200">
            <LogOut className="h-4 w-4 mr-2" />
            Lock
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Blocking Error</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={clearError} className="h-6 px-2">
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Status Card */}
        <Card className={isProtectionActive
          ? "border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-700"
          : "border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isProtectionActive ? "bg-green-200 dark:bg-green-900" : "bg-amber-200 dark:bg-amber-900"}`}>
                {isProtectionActive ? (
                  <Shield className="h-8 w-8 text-green-700 dark:text-green-300" />
                ) : (
                  <ShieldOff className="h-8 w-8 text-amber-700 dark:text-amber-300" />
                )}
              </div>
              <div>
                <h2 className={`text-xl font-bold ${isProtectionActive ? "text-green-800 dark:text-green-200" : "text-amber-800 dark:text-amber-200"}`}>
                  {isProtectionActive ? "Protection Active" : "Protection Paused"}
                </h2>
                <p className={`text-sm ${isProtectionActive ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}>
                  {isProtectionActive
                    ? "Gaming/AI websites blocked via hosts file. Process blocking runs every 5s."
                    : currentlyBlocking
                    ? "Enable blocking options below"
                    : "Blocking paused due to schedule"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daemon Status */}
        {daemonStatus?.installed && daemonStatus?.running && (
          <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800">
            <Server className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-800 dark:text-purple-200">Background Service Active</AlertTitle>
            <AlertDescription className="text-purple-700 dark:text-purple-300">
              Blocking continues even when app is closed. {daemonStatus.blockedCount > 0 && `Blocked ${daemonStatus.blockedCount} processes.`}
            </AlertDescription>
          </Alert>
        )}

        {daemonStatus && !daemonStatus.installed && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">Background Service Not Installed</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Blocking only works while the app is open. Install the service in Settings for continuous protection.
            </AlertDescription>
          </Alert>
        )}

        {/* Firewall Blocking Status - Show when active */}
        {firewallBlockingActive && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-200">Firewall Protection Active</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              DNS-over-HTTPS providers are blocked at the firewall level. Websites cannot bypass blocking.
              <Button
                size="sm"
                variant="outline"
                onClick={disableFirewallBlocking}
                disabled={isLoading}
                className="ml-3"
              >
                Disable Firewall
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Warning when blocking is active but firewall isn't */}
        {isProtectionActive && !firewallBlockingActive && (
          <Alert variant="destructive" className="border-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Website Blocking Can Be Bypassed!</AlertTitle>
            <AlertDescription className="space-y-3">
              <p className="font-medium">
                Modern browsers use DNS-over-HTTPS (DoH) which bypasses hosts file blocking.
                Enable firewall protection to block DoH providers and enforce website blocking.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="default"
                  onClick={enableFirewallBlocking}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Flame className="h-4 w-4 mr-2" />
                  Enable Firewall Protection (Recommended)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={disableBrowserDoh}
                  disabled={isLoading}
                >
                  Disable Browser DoH (Alternative)
                </Button>
              </div>
              <p className="text-xs opacity-80">
                Firewall protection blocks connections to DoH servers (Cloudflare, Google DNS, etc.) using iptables.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* DoH disabled confirmation */}
        {dohDisabled && dohConfiguredBrowsers.length > 0 && !firewallBlockingActive && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertTitle>Browser DoH Disabled</AlertTitle>
            <AlertDescription>
              Configured: {dohConfiguredBrowsers.join(", ")}. Restart your browser for changes to take effect.
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Toggles */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Gamepad2 className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Game Blocking</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">200+ gaming sites & apps</p>
                  </div>
                </div>
                <Switch
                  checked={gameBlockingEnabled}
                  onCheckedChange={(checked) => {
                    console.log("[Dashboard] Game blocking switch toggled to:", checked);
                    setGameBlocking(checked);
                  }}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">AI Blocking</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">50+ AI sites & apps</p>
                  </div>
                </div>
                <Switch
                  checked={aiBlockingEnabled}
                  onCheckedChange={setAiBlocking}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Custom Websites</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Your blocked sites</p>
                  </div>
                </div>
                <Switch
                  checked={dnsBlockingEnabled}
                  onCheckedChange={setDnsBlocking}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        {recentlyBlocked.length > 0 && (
          <Card className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-white">Recently Blocked</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">Processes that were blocked</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {recentlyBlocked.map((process) => (
                  <Badge key={process.pid} variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    {process.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            className="cursor-pointer bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            onClick={() => onNavigate("schedule")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Schedule</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Set blocking times</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            onClick={() => onNavigate("blocklist")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <List className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Blocklist</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Manage blocked items</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            onClick={() => onNavigate("settings")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Settings</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">App preferences</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
