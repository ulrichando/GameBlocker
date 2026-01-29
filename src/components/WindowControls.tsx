import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (e) {
        console.error("Failed to check maximized state:", e);
      }
    };
    checkMaximized();

    // Listen for window resize to update maximize state
    const unlisten = appWindow.onResized(async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (e) {
        console.error("Failed to check maximized state:", e);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (e) {
      console.error("Failed to minimize:", e);
    }
  };

  const handleMaximize = async () => {
    try {
      await appWindow.toggleMaximize();
    } catch (e) {
      console.error("Failed to toggle maximize:", e);
    }
  };

  const handleClose = async () => {
    try {
      // Emit quit-requested event instead of closing directly
      // This triggers the password protection flow
      await appWindow.emit("quit-requested");
    } catch (e) {
      console.error("Failed to emit quit-requested:", e);
    }
  };

  // Windows 11 style caption button dimensions: 46px width x 32px height
  const buttonBase = "w-[46px] h-8 inline-flex items-center justify-center transition-colors duration-100";

  return (
    <div className="flex items-center h-8">
      {/* Minimize */}
      <button
        type="button"
        className={`${buttonBase} hover:bg-black/10 dark:hover:bg-white/10`}
        onClick={handleMinimize}
        aria-label="Minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" className="opacity-80">
          <rect width="10" height="1" />
        </svg>
      </button>

      {/* Maximize/Restore */}
      <button
        type="button"
        className={`${buttonBase} hover:bg-black/10 dark:hover:bg-white/10`}
        onClick={handleMaximize}
        aria-label={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-80">
            <path d="M2 3h5v5H2V3M3 2V1h5v5h-1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-80">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        )}
      </button>

      {/* Close */}
      <button
        type="button"
        className={`${buttonBase} hover:bg-[#E81123] hover:text-white`}
        onClick={handleClose}
        aria-label="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="opacity-80">
          <path d="M1 1l8 8M9 1l-8 8" />
        </svg>
      </button>
    </div>
  );
}
