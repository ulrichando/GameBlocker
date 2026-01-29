import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TitleBar } from "@/components/TitleBar";
import { useScheduleStore } from "@/stores/schedule-store";

interface SchedulePageProps {
  onBack: () => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function parseTime(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

export function Schedule({ onBack }: SchedulePageProps) {
  const {
    schedules,
    fetchSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addPresetSchedule,
    isLoading,
  } = useScheduleStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: "",
    days: [] as number[],
    startTime: "09:00",
    endTime: "17:00",
    blockingEnabled: true,
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleAddSchedule = async () => {
    if (!newSchedule.name || newSchedule.days.length === 0) return;

    await addSchedule({
      name: newSchedule.name,
      enabled: true,
      days: newSchedule.days,
      start_minutes: parseTime(newSchedule.startTime),
      end_minutes: parseTime(newSchedule.endTime),
      blocking_enabled: newSchedule.blockingEnabled,
    });

    setNewSchedule({
      name: "",
      days: [],
      startTime: "09:00",
      endTime: "17:00",
      blockingEnabled: true,
    });
    setShowAddForm(false);
  };

  const toggleDay = (day: number) => {
    setNewSchedule((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day].sort(),
    }));
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header - Fluent 2 Custom Title Bar */}
      <TitleBar>
        <div className="flex items-center px-2 gap-1 h-full">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-6 w-6 rounded hover:bg-foreground/10">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-semibold">Schedule</span>
        </div>
      </TitleBar>

      <main className="flex-1 overflow-y-auto scrollable-content">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
        {/* Preset Templates */}
        <Card className="fluent-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Quick Templates</CardTitle>
            <CardDescription className="text-xs">Add a preset schedule</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 px-4 pb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPresetSchedule("school")}
              disabled={isLoading}
              className="rounded-md text-xs h-7"
            >
              <Clock className="h-3 w-3 mr-1.5 text-primary" />
              School Hours
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPresetSchedule("bedtime")}
              disabled={isLoading}
              className="rounded-md text-xs h-7"
            >
              <Clock className="h-3 w-3 mr-1.5 text-primary" />
              Bedtime
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPresetSchedule("weekend")}
              disabled={isLoading}
              className="rounded-md text-xs h-7"
            >
              <Clock className="h-3 w-3 mr-1.5 text-primary" />
              Weekend Gaming
            </Button>
          </CardContent>
        </Card>

        {/* Schedule List */}
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="fluent-card">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-foreground">{schedule.name}</h3>
                      <Badge variant={schedule.blocking_enabled ? "default" : "secondary"} className="text-xs rounded">
                        {schedule.blocking_enabled ? "Blocking ON" : "Blocking OFF"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {DAYS.map((day, i) => (
                        <span
                          key={day}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            schedule.days.includes(i)
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(schedule.start_minutes)} - {formatTime(schedule.end_minutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(enabled) =>
                        updateSchedule({ ...schedule, enabled })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSchedule(schedule.id)}
                      className="h-7 w-7 rounded-md"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {schedules.length === 0 && !showAddForm && (
            <Card className="fluent-card">
              <CardContent className="py-4 px-4 text-center text-muted-foreground text-sm">
                No schedules yet. Add a template or create a custom schedule.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add Schedule Form */}
        {showAddForm ? (
          <Card className="fluent-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">New Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  value={newSchedule.name}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, name: e.target.value })
                  }
                  placeholder="e.g., After School"
                  className="h-8 text-sm rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Days</Label>
                <div className="flex gap-1">
                  {DAYS.map((day, i) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(i)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        newSchedule.days.includes(i)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Time</Label>
                  <Input
                    type="time"
                    value={newSchedule.startTime}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, startTime: e.target.value })
                    }
                    className="h-8 text-sm rounded-md"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Time</Label>
                  <Input
                    type="time"
                    value={newSchedule.endTime}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, endTime: e.target.value })
                    }
                    className="h-8 text-sm rounded-md"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Blocking during this time</Label>
                <Switch
                  checked={newSchedule.blockingEnabled}
                  onCheckedChange={(blockingEnabled) =>
                    setNewSchedule({ ...newSchedule, blockingEnabled })
                  }
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddSchedule} disabled={isLoading} size="sm" className="rounded-md text-xs h-7">
                  Add Schedule
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)} size="sm" className="rounded-md text-xs h-7">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setShowAddForm(true)} size="sm" className="rounded-md text-xs h-7">
            <Plus className="h-3 w-3 mr-1.5" />
            Add Custom Schedule
          </Button>
        )}
        </div>
      </main>
    </div>
  );
}
