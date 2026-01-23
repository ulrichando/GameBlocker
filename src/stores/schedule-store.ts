import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  days: number[];
  start_minutes: number;
  end_minutes: number;
  blocking_enabled: boolean;
}

interface ScheduleStore {
  schedules: Schedule[];
  isLoading: boolean;
  error: string | null;

  fetchSchedules: () => Promise<void>;
  addSchedule: (schedule: Omit<Schedule, "id">) => Promise<Schedule | null>;
  updateSchedule: (schedule: Schedule) => Promise<boolean>;
  deleteSchedule: (id: string) => Promise<boolean>;
  addPresetSchedule: (preset: "school" | "bedtime" | "weekend") => Promise<Schedule | null>;
}

export const useScheduleStore = create<ScheduleStore>((set) => ({
  schedules: [],
  isLoading: false,
  error: null,

  fetchSchedules: async () => {
    try {
      set({ isLoading: true, error: null });
      const schedules = await invoke<Schedule[]>("get_schedules");
      set({ schedules, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  addSchedule: async (schedule) => {
    try {
      set({ isLoading: true, error: null });
      const newSchedule = await invoke<Schedule>("add_schedule", { schedule });
      set((state) => ({
        schedules: [...state.schedules, newSchedule],
        isLoading: false,
      }));
      return newSchedule;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return null;
    }
  },

  updateSchedule: async (schedule) => {
    try {
      set({ isLoading: true, error: null });
      const success = await invoke<boolean>("update_schedule", { schedule });
      if (success) {
        set((state) => ({
          schedules: state.schedules.map((s) =>
            s.id === schedule.id ? schedule : s
          ),
          isLoading: false,
        }));
      }
      return success;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return false;
    }
  },

  deleteSchedule: async (id) => {
    try {
      set({ isLoading: true, error: null });
      const success = await invoke<boolean>("delete_schedule", { id });
      if (success) {
        set((state) => ({
          schedules: state.schedules.filter((s) => s.id !== id),
          isLoading: false,
        }));
      }
      return success;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return false;
    }
  },

  addPresetSchedule: async (preset) => {
    try {
      set({ isLoading: true, error: null });
      const schedule = await invoke<Schedule>("add_preset_schedule", { preset });
      set((state) => ({
        schedules: [...state.schedules, schedule],
        isLoading: false,
      }));
      return schedule;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return null;
    }
  },
}));
