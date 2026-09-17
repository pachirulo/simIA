import { ActionProposal, type Perception } from "@unwatched/protocol";

/** Schema selection boundary. options is not an exhaustive allowlist today: offer,
 * accept, refuse and settle are supported by Action/engine but absent from ActionKind.
 * Filtering would break deals. Keep protocol as the only schema authority until that
 * contract is reconciled; never add permissive branches or duplicate action schemas. */
export function actionProposalSchema(_p: Perception): typeof ActionProposal { return ActionProposal; }
