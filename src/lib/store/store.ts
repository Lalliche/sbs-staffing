"use client";
/* Tiny external store persisted to localStorage (no backend — prototype). All writes go through `act()`. */
import { useSyncExternalStore } from "react";
import { buildSeed, SCENARIO_NOW } from "./seed";
import { STATE_VERSION } from "./blank";
import { advanceTime, refreshStatuses } from "./actions/time";
import type { AppState, Scenario } from "./types";

const KEY = "sbs-staffing:state";

let state: AppState = buildSeed(2);
let hydrated = false;
const listeners = new Set<() => void>();
const hydrationListeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((l) => l());
}
function persist() {
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable: the prototype keeps working in memory */
    }
  }, 300);
}
/** Flush pending persistence now (tests, page unload). */
export function flushPersist() {
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.v === STATE_VERSION) state = parsed;
    }
  } catch {
    /* corrupted: fall back to the seed */
  }
  window.addEventListener("beforeunload", flushPersist);
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const next = JSON.parse(e.newValue) as AppState;
      if (next.v === STATE_VERSION) {
        state = next;
        emit();
      }
    } catch {
      /* ignore */
    }
  });
  hydrationListeners.forEach((l) => l());
  emit();
}

/** Apply a mutation to a clone of the state, then persist and notify. */
export function act<T = void>(fn: (draft: AppState) => T): T {
  const draft = structuredClone(state);
  const out = fn(draft);
  state = draft;
  persist();
  emit();
  return out;
}
export const getState = () => state;

export function useApp(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => {
      hydrationListeners.add(cb);
      return () => hydrationListeners.delete(cb);
    },
    () => hydrated,
    () => false,
  );
}

/* ---------- demo controls ---------- */
export function setScenario(n: Scenario) {
  state = buildSeed(n, state.session.userId);
  persist();
  emit();
}
export const resetDemo = () => setScenario(state.scenario);
export function enterAs(userId: string | null) {
  act((s) => {
    s.session.userId = userId;
    const u = s.users.find((x) => x.id === userId);
    if (u) u.lastLoginAt = s.now;
  });
}
/** Move the demo clock forward. Triggers reminders, expiries, status transitions (see actions/time.ts). */
export const travel = (days: number) => act((s) => advanceTime(s, days));
export const syncClock = () => act((s) => refreshStatuses(s));
export { SCENARIO_NOW };
