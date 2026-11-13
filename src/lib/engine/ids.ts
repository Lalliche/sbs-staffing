import type { AppState } from "../store/types";
/** Deterministic runtime ids (no randomness, no clock). */
export const nextId = (state: Pick<AppState, "idSeq">, prefix: string): string => `${prefix}-${++state.idSeq}`;
