import { useEffect } from "react";
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Shield,
  Globe,
  Gamepad2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TitleBar } from "@/components/TitleBar";
import { useActivityStore, Alert } from "@/stores/activity-store";

interface AlertsProps {
  onBack: () => void;
}

function getAlertIcon(type: string) {
  switch (type) {
    case "blocked_site":
      return <Globe className="h-4 w-4" />;
    case "blocked_app":
      return <Gamepad2 className="h-4 w-4" />;
    case "screen_time":
      return <Clock className="h-4 w-4" />;
    case "tamper_attempt":
      return <Shield className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    default:
      return <Info className="h-4 w-4 text-secondary" />;
  }
}

function getSeverityBadgeClass(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "warning":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-secondary/10 text-secondary border-secondary/20";
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export function Alerts({ onBack }: AlertsProps) {
  const {
    alerts,
    unreadAlertCount,
    isLoading,
    fetchAlerts,
    markAlertRead,
    markAllAlertsRead,
  } = useActivityStore();

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleAlertClick = (alert: Alert) => {
    if (!alert.is_read) {
      markAlertRead(alert.id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <TitleBar>
        <div className="flex items-center px-3 gap-2 h-full">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-6 w-6 p-0 rounded">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-5 h-5 bg-gradient-primary rounded flex items-center justify-center">
            <Bell className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold">Alerts</span>
          {unreadAlertCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground text-caption-2 px-1.5 py-0 h-4 rounded-full">
              {unreadAlertCount}
            </Badge>
          )}
        </div>
      </TitleBar>

      <main className="flex-1 overflow-y-auto scrollable-content">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Notifications</h2>
              <p className="text-sm text-muted-foreground">
                Alerts from your protected devices
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAlerts}
                disabled={isLoading}
                className="h-8 text-xs rounded"
              >
                <RefreshCw className={`h-3 w-3 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {unreadAlertCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAlertsRead}
                  className="h-8 text-xs rounded"
                >
                  <CheckCheck className="h-3 w-3 mr-1.5" />
                  Mark All Read
                </Button>
              )}
            </div>
          </div>

          {/* Alerts List */}
          <Card className="rounded-lg">
            <CardContent className="p-0">
              {alerts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BellOff className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No alerts yet</p>
                  <p className="text-xs">You'll be notified when something happens</p>
                </div>
              ) : (
                <div className="divide-y">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                        !alert.is_read ? "bg-primary/5" : ""
                      }`}
                      onClick={() => handleAlertClick(alert)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-2 rounded-lg ${getSeverityBadgeClass(alert.severity)}`}>
                          {getAlertIcon(alert.alert_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${!alert.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                              {alert.title}
                            </span>
                            {!alert.is_read && (
                              <span className="w-2 h-2 bg-primary rounded-full" />
                            )}
                            <Badge
                              variant="outline"
                              className={`text-caption-2 px-1.5 py-0 h-4 rounded ml-auto ${getSeverityBadgeClass(alert.severity)}`}
                            >
                              {alert.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-caption-2 text-muted-foreground">
                              {formatDate(alert.created_at)}
                            </span>
                            {alert.device_name && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-caption-2 text-muted-foreground">
                                  {alert.device_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
