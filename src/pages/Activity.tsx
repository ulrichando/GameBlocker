import { useEffect } from "react";
import {
  ArrowLeft,
  Activity as ActivityIcon,
  Shield,
  Ban,
  Clock,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Globe,
  Gamepad2,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TitleBar } from "@/components/TitleBar";
import { useActivityStore, ActivityEvent } from "@/stores/activity-store";
import { useBlockingStore } from "@/stores/blocking-store";

interface ActivityProps {
  onBack: () => void;
}

function getActivityIcon(type: ActivityEvent["type"]) {
  switch (type) {
    case "blocked_site":
      return <Globe className="h-4 w-4" />;
    case "blocked_app":
      return <Gamepad2 className="h-4 w-4" />;
    case "screen_time":
      return <Clock className="h-4 w-4" />;
    case "tamper_attempt":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <ActivityIcon className="h-4 w-4" />;
  }
}

function getSeverityColor(severity: ActivityEvent["severity"]) {
  switch (severity) {
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "warning":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-secondary/10 text-secondary border-secondary/20";
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function Activity({ onBack }: ActivityProps) {
  const { activities, isLoading, clearActivities, addActivity } = useActivityStore();
  const { recentlyBlocked } = useBlockingStore();

  // Convert recently blocked processes to activity events
  useEffect(() => {
    recentlyBlocked.forEach((process) => {
      // Check if we already have this activity
      const exists = activities.some(
        (a) => a.details?.pid === process.pid && a.type === "blocked_app"
      );
      if (!exists) {
        addActivity({
          type: "blocked_app",
          title: "Process Blocked",
          description: `${process.name} was terminated`,
          severity: "warning",
          details: { pid: process.pid, name: process.name },
        });
      }
    });
  }, [recentlyBlocked]);

  // Stats calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayActivities = activities.filter(
    (a) => new Date(a.timestamp) >= today
  );
  const blockedToday = todayActivities.filter(
    (a) => a.type === "blocked_site" || a.type === "blocked_app"
  ).length;
  const warningsToday = todayActivities.filter(
    (a) => a.severity === "warning" || a.severity === "critical"
  ).length;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <TitleBar>
        <div className="flex items-center px-3 gap-2 h-full">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-6 w-6 p-0 rounded">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-5 h-5 bg-gradient-primary rounded flex items-center justify-center">
            <ActivityIcon className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold">Activity</span>
        </div>
      </TitleBar>

      <main className="flex-1 overflow-y-auto scrollable-content">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="rounded-lg">
              <CardContent className="py-3 px-4 text-center">
                <div className="text-2xl font-bold text-primary">{todayActivities.length}</div>
                <div className="text-xs text-muted-foreground">Events Today</div>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardContent className="py-3 px-4 text-center">
                <div className="text-2xl font-bold text-destructive">{blockedToday}</div>
                <div className="text-xs text-muted-foreground">Blocked Today</div>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardContent className="py-3 px-4 text-center">
                <div className="text-2xl font-bold text-warning">{warningsToday}</div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Feed */}
          <Card className="rounded-lg">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Activity Feed</CardTitle>
                  <CardDescription className="text-xs">
                    Real-time blocking activity
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearActivities}
                    className="h-7 text-xs rounded"
                    disabled={activities.length === 0}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ActivityIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No activity yet</p>
                  <p className="text-xs">Blocked items will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${getSeverityColor(activity.severity)}`}
                    >
                      <div className="mt-0.5">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{activity.title}</span>
                          <Badge
                            variant="outline"
                            className={`text-caption-2 px-1.5 py-0 h-4 rounded ${
                              activity.severity === "critical"
                                ? "border-destructive/50 text-destructive"
                                : activity.severity === "warning"
                                ? "border-warning/50 text-warning"
                                : "border-secondary/50 text-secondary"
                            }`}
                          >
                            {activity.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {activity.description}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(activity.timestamp)}
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
