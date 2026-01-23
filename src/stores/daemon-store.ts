import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface DaemonStatus {
  installed: boolean;
  running: boolean;
  blockingActive: boolean;
  gameBlocking: boolean;
  aiBlocking: boolean;
  dnsBlocking: boolean;
  browserBlocking: boolean;
  firewallActive: boolean;
  blockedCount: number;
  uptimeSecs: number;
}

interface DaemonStore {
  status: DaemonStatus | null;
  isLoading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  installDaemon: () => Promise<boolean>;
  uninstallDaemon: () => Promise<boolean>;
  startDaemon: () => Promise<boolean>;
  stopDaemon: () => Promise<boolean>;
  clearError: () => void;
}

const defaultStatus: DaemonStatus = {
  installed: false,
  running: false,
  blockingActive: false,
  gameBlocking: false,
  aiBlocking: false,
  dnsBlocking: false,
  browserBlocking: false,
  firewallActive: false,
  blockedCount: 0,
  uptimeSecs: 0,
};

export const useDaemonStore = create<DaemonStore>((set) => ({
  status: null,
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await invoke<DaemonStatus>("get_daemon_status");
      set({ status, isLoading: false });
    } catch (error) {
      console.error("Failed to fetch daemon status:", error);
      set({
        status: defaultStatus,
        isLoading: false,
        error: String(error),
      });
    }
  },

  installDaemon: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke("install_daemon");
      // After install, try to start the daemon
      await invoke("start_daemon");
      // Refresh status
      const status = await invoke<DaemonStatus>("get_daemon_status");
      set({ status, isLoading: false });
      return true;
    } catch (error) {
      console.error("Failed to install daemon:", error);
      set({ isLoading: false, error: String(error) });
      return false;
    }
  },

  uninstallDaemon: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke("uninstall_daemon");
      const status = await invoke<DaemonStatus>("get_daemon_status");
      set({ status, isLoading: false });
      return true;
    } catch (error) {
      console.error("Failed to uninstall daemon:", error);
      set({ isLoading: false, error: String(error) });
      return false;
    }
  },

  startDaemon: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke("start_daemon");
      const status = await invoke<DaemonStatus>("get_daemon_status");
      set({ status, isLoading: false });
      return true;
    } catch (error) {
      console.error("Failed to start daemon:", error);
      set({ isLoading: false, error: String(error) });
      return false;
    }
  },

  stopDaemon: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke("stop_daemon");
      const status = await invoke<DaemonStatus>("get_daemon_status");
      set({ status, isLoading: false });
      return true;
    } catch (error) {
      console.error("Failed to stop daemon:", error);
      set({ isLoading: false, error: String(error) });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
