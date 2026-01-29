import { create } from "zustand";
import { apiService } from "@/services/api";

export interface ActivityEvent {
  id: string;
  type: "blocked_site" | "blocked_app" | "screen_time" | "tamper_attempt" | "login" | "setting_change";
  title: string;
  description: string;
  timestamp: string;
  severity: "info" | "warning" | "critical";
  details?: Record<string, unknown>;
}

export interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  details: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  device_name?: string;
}

interface ActivityState {
  activities: ActivityEvent[];
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;
  unreadAlertCount: number;

  // Actions
  addActivity: (event: Omit<ActivityEvent, "id" | "timestamp">) => void;
  fetchAlerts: () => Promise<void>;
  markAlertRead: (alertId: string) => Promise<void>;
  markAllAlertsRead: () => Promise<void>;
  clearActivities: () => void;
}

// Generate a simple UUID
const generateId = () => Math.random().toString(36).substring(2, 15);

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  alerts: [],
  isLoading: false,
  error: null,
  unreadAlertCount: 0,

  addActivity: (event) => {
    const newActivity: ActivityEvent = {
      ...event,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      activities: [newActivity, ...state.activities].slice(0, 100), // Keep last 100
    }));
  },

  fetchAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      // This would call the backend API
      // For now, we'll use mock data or the real API when available
      const response = await fetch(`${getApiUrl()}/parental-controls/alerts`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const alerts = data.alerts || [];
        set({
          alerts,
          unreadAlertCount: alerts.filter((a: Alert) => !a.is_read).length,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
      set({ isLoading: false, error: "Failed to fetch alerts" });
    }
  },

  markAlertRead: async (alertId) => {
    try {
      await fetch(`${getApiUrl()}/parental-controls/alerts/${alertId}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === alertId ? { ...a, is_read: true } : a
        ),
        unreadAlertCount: Math.max(0, state.unreadAlertCount - 1),
      }));
    } catch (error) {
      console.error("Failed to mark alert read:", error);
    }
  },

  markAllAlertsRead: async () => {
    try {
      await fetch(`${getApiUrl()}/parental-controls/alerts/read-all`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      set((state) => ({
        alerts: state.alerts.map((a) => ({ ...a, is_read: true })),
        unreadAlertCount: 0,
      }));
    } catch (error) {
      console.error("Failed to mark all alerts read:", error);
    }
  },

  clearActivities: () => {
    set({ activities: [] });
  },
}));

function getApiUrl(): string {
  return "http://localhost:8000";
}
