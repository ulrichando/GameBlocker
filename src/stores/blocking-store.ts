import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface BlockingStatus {
  gameBlockingEnabled: boolean;
  aiBlockingEnabled: boolean;
  dnsBlockingEnabled: boolean;
  browserBlockingEnabled: boolean;
  currentlyBlocking: boolean;
  firewallBlockingActive: boolean;
}

interface BlockedProcess {
  pid: number;
  name: string;
}

interface BlockingStore {
  gameBlockingEnabled: boolean;
  aiBlockingEnabled: boolean;
  dnsBlockingEnabled: boolean;
  browserBlockingEnabled: boolean;
  currentlyBlocking: boolean;
  firewallBlockingActive: boolean;
  recentlyBlocked: BlockedProcess[];
  isLoading: boolean;
  error: string | null;
  dohDisabled: boolean;
  dohConfiguredBrowsers: string[];

  fetchStatus: () => Promise<void>;
  setGameBlocking: (enabled: boolean) => Promise<void>;
  setAiBlocking: (enabled: boolean) => Promise<void>;
  setDnsBlocking: (enabled: boolean) => Promise<void>;
  setBrowserBlocking: (enabled: boolean) => Promise<void>;
  runBlockingCheck: () => Promise<BlockedProcess[]>;
  disableBrowserDoh: () => Promise<void>;
  enableBrowserDoh: () => Promise<void>;
  enableFirewallBlocking: () => Promise<void>;
  disableFirewallBlocking: () => Promise<void>;
  clearError: () => void;
}

export const useBlockingStore = create<BlockingStore>((set) => ({
  gameBlockingEnabled: false,
  aiBlockingEnabled: false,
  dnsBlockingEnabled: false,
  browserBlockingEnabled: false,
  currentlyBlocking: false,
  firewallBlockingActive: false,
  recentlyBlocked: [],
  isLoading: false,
  error: null,
  dohDisabled: false,
  dohConfiguredBrowsers: [],

  fetchStatus: async () => {
    try {
      set({ isLoading: true, error: null });
      const status = await invoke<BlockingStatus>("get_blocking_status");
      const dohDisabled = await invoke<boolean>("is_doh_disabled");
      set({
        gameBlockingEnabled: status.gameBlockingEnabled,
        aiBlockingEnabled: status.aiBlockingEnabled,
        dnsBlockingEnabled: status.dnsBlockingEnabled,
        browserBlockingEnabled: status.browserBlockingEnabled,
        currentlyBlocking: status.currentlyBlocking,
        firewallBlockingActive: status.firewallBlockingActive,
        dohDisabled,
        isLoading: false,
      });
      // Apply blocking on login (daemon handles it silently, or one pkexec prompt)
      if (status.gameBlockingEnabled || status.aiBlockingEnabled || status.dnsBlockingEnabled) {
        await invoke("apply_blocking").catch((err) => {
          console.error("Failed to apply blocking:", err);
        });
      }
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  setGameBlocking: async (enabled: boolean) => {
    try {
      console.log("[ParentShield] setGameBlocking called with:", enabled);
      set({ isLoading: true, error: null });
      console.log("[ParentShield] Invoking set_game_blocking command...");
      const result = await invoke<boolean>("set_game_blocking", { enabled });
      console.log("[ParentShield] Command result:", result);
      // Refresh currentlyBlocking status after toggle
      const status = await invoke<BlockingStatus>("get_blocking_status");
      set({
        gameBlockingEnabled: enabled,
        currentlyBlocking: status.currentlyBlocking,
        isLoading: false
      });
      console.log("[ParentShield] State updated to:", enabled);
    } catch (error) {
      console.error("[ParentShield] Error in setGameBlocking:", error);
      set({ error: String(error), isLoading: false });
    }
  },

  setAiBlocking: async (enabled: boolean) => {
    try {
      set({ isLoading: true, error: null });
      await invoke<boolean>("set_ai_blocking", { enabled });
      // Refresh currentlyBlocking status after toggle
      const status = await invoke<BlockingStatus>("get_blocking_status");
      set({
        aiBlockingEnabled: enabled,
        currentlyBlocking: status.currentlyBlocking,
        isLoading: false
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  setDnsBlocking: async (enabled: boolean) => {
    try {
      set({ isLoading: true, error: null });
      await invoke<boolean>("set_dns_blocking", { enabled });
      // Refresh currentlyBlocking status after toggle
      const status = await invoke<BlockingStatus>("get_blocking_status");
      set({
        dnsBlockingEnabled: enabled,
        currentlyBlocking: status.currentlyBlocking,
        isLoading: false
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  setBrowserBlocking: async (enabled: boolean) => {
    try {
      set({ isLoading: true, error: null });
      await invoke<boolean>("set_browser_blocking", { enabled });
      // Refresh currentlyBlocking status after toggle
      const status = await invoke<BlockingStatus>("get_blocking_status");
      set({
        browserBlockingEnabled: enabled,
        currentlyBlocking: status.currentlyBlocking,
        isLoading: false
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  runBlockingCheck: async () => {
    try {
      set({ isLoading: true, error: null });
      const blocked = await invoke<BlockedProcess[]>("run_blocking_check");
      set({ recentlyBlocked: blocked, isLoading: false });
      return blocked;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return [];
    }
  },

  clearError: () => {
    set({ error: null });
  },

  disableBrowserDoh: async () => {
    try {
      set({ isLoading: true, error: null });
      const browsers = await invoke<string[]>("disable_browser_doh");
      set({ dohDisabled: true, dohConfiguredBrowsers: browsers, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  enableBrowserDoh: async () => {
    try {
      set({ isLoading: true, error: null });
      await invoke<string[]>("enable_browser_doh");
      set({ dohDisabled: false, dohConfiguredBrowsers: [], isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  enableFirewallBlocking: async () => {
    try {
      set({ isLoading: true, error: null });
      await invoke<boolean>("enable_firewall_blocking");
      set({ firewallBlockingActive: true, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  disableFirewallBlocking: async () => {
    try {
      set({ isLoading: true, error: null });
      await invoke<boolean>("disable_firewall_blocking");
      set({ firewallBlockingActive: false, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
}));
