import { ReactNode } from "react";
import { WindowControls } from "./WindowControls";

interface TitleBarProps {
  children?: ReactNode;
}

export function TitleBar({ children }: TitleBarProps) {
  return (
    <header className="h-8 min-h-8 flex items-center justify-between border-b border-border bg-card select-none">
      {/* Drag region - uses Tauri's data attribute for native dragging */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center h-full"
      >
        {children}
      </div>
      {/* Window controls - not draggable */}
      <WindowControls />
    </header>
  );
}
