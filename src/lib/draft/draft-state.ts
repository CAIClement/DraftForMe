import type { EnemyPick } from "@/lib/recommendation/types";
import { ROLES, type Role } from "./roles";

export type Side = "ally" | "enemy";

export type DraftState = {
  yourRole: Role;
  ally: Record<Role, string | null>;
  enemy: Record<Role, string | null>;
  priority: number;
  picker: { side: Side; role: Role } | null;
};

export type DraftAction =
  | { type: "place"; side: Side; role: Role; championId: string }
  | { type: "clear"; side: Side; role: Role }
  | { type: "setYourRole"; role: Role }
  | { type: "setPriority"; priority: number }
  | { type: "openPicker"; side: Side; role: Role }
  | { type: "closePicker" };

function emptyLanes(): Record<Role, string | null> {
  return { top: null, jungle: null, mid: null, adc: null, support: null };
}

export function createDraftState({
  yourRole,
  enemyPicks = [],
  priority = 50
}: {
  yourRole: Role;
  enemyPicks?: EnemyPick[];
  priority?: number;
}): DraftState {
  const enemy = emptyLanes();
  for (const pick of enemyPicks) {
    if (isRoleKey(pick.role)) enemy[pick.role] = pick.championId;
  }

  return { yourRole, ally: emptyLanes(), enemy, priority, picker: null };
}

function isRoleKey(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "place": {
      // Your own lane holds the recommendation, not a stored pick.
      if (action.side === "ally" && action.role === state.yourRole) return state;
      if (excludedChampionIds(state).includes(action.championId)) return state;

      return {
        ...state,
        [action.side]: { ...state[action.side], [action.role]: action.championId },
        picker: null
      };
    }

    case "clear":
      return { ...state, [action.side]: { ...state[action.side], [action.role]: null } };

    case "setYourRole":
      return { ...state, yourRole: action.role, ally: { ...state.ally, [action.role]: null } };

    case "setPriority":
      return { ...state, priority: action.priority };

    case "openPicker":
      return { ...state, picker: { side: action.side, role: action.role } };

    case "closePicker":
      return { ...state, picker: null };
  }
}

export function excludedChampionIds(state: DraftState): string[] {
  return [...Object.values(state.ally), ...Object.values(state.enemy)].filter(
    (championId): championId is string => championId !== null
  );
}

export function enemyPicksWithRoles(state: DraftState): EnemyPick[] {
  return ROLES.flatMap((role) => {
    const championId = state.enemy[role];
    return championId === null ? [] : [{ championId, role }];
  });
}

export function allyPickIds(state: DraftState): string[] {
  return ROLES.flatMap((role) => {
    const championId = state.ally[role];
    return championId === null ? [] : [championId];
  });
}

export function directOpponent(state: DraftState): string | null {
  return state.enemy[state.yourRole];
}
