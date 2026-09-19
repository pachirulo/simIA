import type { Action, Perception } from "@unwatched/protocol";
import type { SemanticIssue } from "./quality.ts";

/** Only supplied contradictions. Unknown ownership, hidden stock and wages are
 * left to the engine, as are changes after this perception was produced. */
export function observablePrecondition(action: Action, p: Perception): SemanticIssue | null {
  const fail = (code: string, message: string): SemanticIssue => ({ code, path: "action", message });
  if (action.kind === "apply") {
    if (p.self.job) return fail("apply_already_employed", "You already hold a job. Applying does not quit it; reconsider explicitly before changing employment.");
    if (!p.place.jobs_open.length) return fail("apply_no_local_opening", "No opening is currently observed here. Asking, travelling or waiting are different actions; do not invent an available job.");
    // Job titles may be resolved by the engine. Do not make exact IDs an allowlist.
  }
  if (action.kind === "quit" && !p.self.job) return fail("quit_no_job", "There is no current job to quit.");
  if (action.kind === "give") {
    const target = action.to.trim().toLowerCase();
    const present = target === p.agent_id || p.nearby.some(person => person.agent === action.to
      || person.name.toLowerCase() === target || person.name.toLowerCase().startsWith(target + " "));
    if (!present) return fail("give_not_present", "The recipient is not currently nearby. An agreement or remembered name does not establish presence.");
    if (action.item !== undefined && !p.self.inventory.includes(action.item)) return fail("give_not_carried", "The item to give is not in the current inventory. A promised or proposed purchase is not possession.");
    if (action.coins !== undefined && action.coins > p.self.coins) return fail("give_insufficient_coins", "The proposed gift exceeds your own coins. Public or another person's money is not yours to give.");
    if (action.coins === undefined && action.item === undefined) return fail("give_empty", "Specify carried goods or your own coins to give.");
  }
  if (action.kind === "repair") {
    if (p.place.broken === false) return fail("repair_not_damaged", "The current place is explicitly observed without damage. Do not invent damage from a rumor.");
    if (p.self.inventory.filter(item => item === "planks").length < 2) return fail("repair_materials", "A repair requires two carried planks; a shop's stock is not your inventory.");
  }
  if (action.kind === "hire" || action.kind === "found_institution") {
    if (p.place.owner !== undefined && p.place.owner !== p.agent_id) return fail("ownership_required", "This operation requires owning the current place; its observed owner is not you.");
  }
  if (action.kind === "fund" && p.place.council) {
    const offer = p.place.council.can_fund.find(item => item.what === action.what.trim().toLowerCase());
    if (!offer) return fail("fund_not_authorized", "This public work is not among the council funding actions supplied for you. A title or narrative promise does not grant spending authority.");
    if (offer.coins > p.place.council.treasury) return fail("fund_insufficient_treasury", "The observed treasury cannot cover this public work. Personal coins and public funds are separate.");
  }
  return null;
}
