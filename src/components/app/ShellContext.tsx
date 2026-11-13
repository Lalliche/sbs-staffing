"use client";
import { createContext, useContext } from "react";

export interface ShellApi {
  openPalette: () => void;
  openHelp: () => void;
  openAssistant: (prompt?: string) => void;
  openProfile: () => void;
  startTour: () => void;
  /** Small « Aperçu » overlay for features that are out of the prototype's scope. */
  preview: (title: string, description: string) => void;
}
const noop = () => {};
export const ShellContext = createContext<ShellApi>({ openPalette: noop, openHelp: noop, openAssistant: noop, openProfile: noop, startTour: noop, preview: noop });
export const useShell = () => useContext(ShellContext);
