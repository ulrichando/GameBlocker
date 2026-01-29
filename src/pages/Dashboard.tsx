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
  Clock,
  Sparkles,
  Activity,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TitleBar } from "@/components/TitleBar";
import { useBlockingStore } from "@/stores/blocking-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDaemonStore } from "@/stores/daemon-store";
import { useLicenseStore } from "@/stores/license-store";

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
  const { features, plan, status: subscriptionStatus, daysRemaining } = useLicenseStore();

  useEffect(() => {
    fetchStatus();
    fetchDaemonStatus();
  }, []);

  const isProtectionActive = currentlyBlocking && (gameBlockingEnabled || aiBlockingEnabled || dnsBlockingEnabled);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header - Fluent 2 Custom Title Bar */}
      <TitleBar>
        <div className="flex items-center px-3 gap-2 h-full">
          <div className="w-5 h-5 bg-gradient-primary rounded flex items-center justify-center">
            <Shield className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold">ParentShield</span>
          {/* Plan Indicator */}
          {plan && plan !== "none" && (
            <Badge
              variant={subscriptionStatus === "active" ? "default" : subscriptionStatus === "trialing" ? "secondary" : "outline"}
              className={`text-caption-2 px-1.5 py-0 h-4 ${
                subscriptionStatus === "active"
                  ? "bg-success text-success-foreground"
                  : subscriptionStatus === "trialing"
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {plan === "Free Trial" ? "Trial" : plan}
            </Badge>
          )}
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={logout} className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded px-2 mr-1">
          <LogOut className="h-3.5 w-3.5 mr-1.5" />
          Lock
        </Button>
      </TitleBar>

      <main className="flex-1 overflow-y-auto scrollable-content">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Trial Banner */}
        {subscriptionStatus === "trialing" && daysRemaining !== null && (
          <Alert className="border-primary/30 bg-primary/5 rounded-lg">
            <Clock className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary text-sm font-semibold">Free Trial</AlertTitle>
            <AlertDescription className="text-primary/80 text-xs">
              {daysRemaining > 0
                ? `You have ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining in your free trial.`
                : "Your trial expires today!"}
            </AlertDescription>
          </Alert>
        )}

        {/* Plan Badge */}
        {plan && plan !== "none" && plan !== "Free Trial" && (
          <Alert className="border-success/30 bg-success/5 rounded-lg">
            <Sparkles className="h-4 w-4 text-success" />
            <AlertTitle className="text-success text-sm font-semibold">{plan} Plan</AlertTitle>
            <AlertDescription className="text-success/80 text-xs">
              Your subscription is active.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">Error</AlertTitle>
            <AlertDescription className="flex items-center justify-between text-xs">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={clearError} className="h-5 px-1.5 rounded">
                <X className="h-3 w-3" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Status Card - Main Protection Status */}
        <Card className={`overflow-hidden rounded-lg ${
          isProtectionActive
            ? "border-success/50 bg-success/5"
            : "border-warning/50 bg-warning/5"
        }`}>
          <CardContent className="py-4 px-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                isProtectionActive
                  ? "bg-success/20"
                  : "bg-warning/20"
              }`}>
                {isProtectionActive ? (
                  <Shield className="h-6 w-6 text-success" />
                ) : (
                  <ShieldOff className="h-6 w-6 text-warning" />
                )}
              </div>
              <div className="flex-1">
                <h2 className={`text-base font-semibold ${
                  isProtectionActive ? "text-success" : "text-warning"
                }`}>
                  {isProtectionActive ? "Protection Active" : "Protection Paused"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isProtectionActive
                    ? "Blocking is enabled and running"
                    : currentlyBlocking
                    ? "Enable blocking options below"
                    : "Blocking paused due to schedule"}
                </p>
              </div>
              {firewallBlockingActive && (
                <Badge className="bg-success/20 text-success border-success/30 rounded">
                  <Flame className="h-3 w-3 mr-1" />
                  Firewall
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service & Firewall Status Row */}
        <div className="grid gap-2 md:grid-cols-2">
          {/* Daemon Status */}
          {daemonStatus?.installed && daemonStatus?.running && (
            <Alert className="border-secondary/30 bg-secondary/5 rounded-lg">
              <Server className="h-4 w-4 text-secondary" />
              <AlertTitle className="text-secondary text-sm font-semibold">Background Service</AlertTitle>
              <AlertDescription className="text-secondary/80 text-xs">
                Active{daemonStatus.blockedCount > 0 && ` • ${daemonStatus.blockedCount} blocked`}
              </AlertDescription>
            </Alert>
          )}

          {daemonStatus && !daemonStatus.installed && (
            <Alert className="border-warning/30 bg-warning/5 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning text-sm font-semibold">Service Not Installed</AlertTitle>
              <AlertDescription className="text-warning/80 text-xs">
                Install in Settings for 24/7 protection
              </AlertDescription>
            </Alert>
          )}

          {/* Firewall Status */}
          {firewallBlockingActive && (
            <Alert className="border-success/30 bg-success/5 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertTitle className="text-success text-sm font-semibold">Firewall Active</AlertTitle>
              <AlertDescription className="text-success/80 text-xs flex items-center justify-between">
                <span>DoH providers blocked</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={disableFirewallBlocking}
                  disabled={isLoading}
                  className="h-5 text-xs rounded"
                >
                  Disable
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Bypass Warning */}
        {isProtectionActive && !firewallBlockingActive && (
          <Alert variant="destructive" className="border-destructive/50 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">Blocking Can Be Bypassed</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-xs">
                Browsers use DNS-over-HTTPS which bypasses blocking. Enable firewall protection.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={enableFirewallBlocking}
                  disabled={isLoading}
                  className="bg-destructive hover:bg-destructive/90 rounded-md text-xs h-7"
                >
                  <Flame className="h-3 w-3 mr-1.5" />
                  Enable Firewall
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={disableBrowserDoh}
                  disabled={isLoading}
                  className="rounded-md text-xs h-7"
                >
                  Disable Browser DoH
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* DoH disabled confirmation */}
        {dohDisabled && dohConfiguredBrowsers.length > 0 && !firewallBlockingActive && (
          <Alert className="border-success/30 bg-success/5 rounded-lg">
            <Shield className="h-4 w-4 text-success" />
            <AlertTitle className="text-success text-sm font-semibold">Browser DoH Disabled</AlertTitle>
            <AlertDescription className="text-success/80 text-xs">
              {dohConfiguredBrowsers.join(", ")} • Restart browser to apply
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Toggles - Fluent 2 Cards */}
        <div className="grid gap-2 md:grid-cols-3">
          <Card className="fluent-card">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-secondary/10 flex items-center justify-center">
                    <Gamepad2 className="h-4 w-4 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      Game Blocking
                      {!features.gameBlocking && (
                        <Badge variant="outline" className="text-caption-2 px-1 py-0 rounded">Pro</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">200+ gaming sites</p>
                  </div>
                </div>
                <Switch
                  checked={gameBlockingEnabled}
                  onCheckedChange={setGameBlocking}
                  disabled={isLoading || !features.gameBlocking}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="fluent-card">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">AI Blocking</p>
                    <p className="text-xs text-muted-foreground">50+ AI services</p>
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

          <Card className="fluent-card">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-success/10 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Custom Sites</p>
                    <p className="text-xs text-muted-foreground">Your blocklist</p>
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
          <Card className="rounded-lg">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Recently Blocked</CardTitle>
              <CardDescription className="text-xs">Processes that were terminated</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {recentlyBlocked.map((process) => (
                  <Badge key={process.pid} variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20 rounded text-xs">
                    {process.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Cards */}
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card
            className="fluent-card cursor-pointer"
            onClick={() => onNavigate("activity")}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Activity</p>
                  <p className="text-xs text-muted-foreground">Live feed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="fluent-card cursor-pointer"
            onClick={() => onNavigate("alerts")}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-warning/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium">Alerts</p>
                  <p className="text-xs text-muted-foreground">Notifications</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="fluent-card cursor-pointer"
            onClick={() => onNavigate("schedule")}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-accent/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium">Schedule</p>
                  <p className="text-xs text-muted-foreground">Blocking times</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="fluent-card cursor-pointer"
            onClick={() => onNavigate("blocklist")}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-destructive/10 flex items-center justify-center">
                  <List className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">Blocklist</p>
                  <p className="text-xs text-muted-foreground">Manage items</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="fluent-card cursor-pointer"
            onClick={() => onNavigate("settings")}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Settings</p>
                  <p className="text-xs text-muted-foreground">Preferences</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </main>
    </div>
  );
}
