import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Schedule</h1>
            <p className="text-sm text-muted-foreground">Set blocking time windows</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Preset Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Templates</CardTitle>
            <CardDescription>Add a preset schedule</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPresetSchedule("school")}
              disabled={isLoading}
            >
              <Clock className="h-4 w-4 mr-2" />
              School Hours
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPresetSchedule("bedtime")}
              disabled={isLoading}
            >
              <Clock className="h-4 w-4 mr-2" />
              Bedtime
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPresetSchedule("weekend")}
              disabled={isLoading}
            >
              <Clock className="h-4 w-4 mr-2" />
              Weekend Gaming
            </Button>
          </CardContent>
        </Card>

        {/* Schedule List */}
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{schedule.name}</h3>
                      <Badge variant={schedule.blocking_enabled ? "default" : "secondary"}>
                        {schedule.blocking_enabled ? "Blocking ON" : "Blocking OFF"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {DAYS.map((day, i) => (
                        <span
                          key={day}
                          className={`text-xs px-2 py-1 rounded ${
                            schedule.days.includes(i)
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                          }`}
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(schedule.start_minutes)} - {formatTime(schedule.end_minutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {schedules.length === 0 && !showAddForm && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No schedules yet. Add a template or create a custom schedule.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add Schedule Form */}
        {showAddForm ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newSchedule.name}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, name: e.target.value })
                  }
                  placeholder="e.g., After School"
                />
              </div>

              <div className="space-y-2">
                <Label>Days</Label>
                <div className="flex gap-2">
                  {DAYS.map((day, i) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(i)}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        newSchedule.days.includes(i)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newSchedule.startTime}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, startTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newSchedule.endTime}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Blocking during this time</Label>
                <Switch
                  checked={newSchedule.blockingEnabled}
                  onCheckedChange={(blockingEnabled) =>
                    setNewSchedule({ ...newSchedule, blockingEnabled })
                  }
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddSchedule} disabled={isLoading}>
                  Add Schedule
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Schedule
          </Button>
        )}
      </main>
    </div>
  );
}
