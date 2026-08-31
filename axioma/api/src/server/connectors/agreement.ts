/**
 * Agreement between what Axel proposed and what a human decided.
 *
 * Pure. Three statistics are reported together, and the reason is that each
 * one lies on its own:
 *
 * - **Raw agreement** is misleading whenever the base rates are imbalanced,
 *   and Axel's action distribution is imbalanced by design — correct refusal
 *   is one of the three flagship scenarios, so escalation dominates. A rater
 *   that always says the common thing scores well on raw agreement.
 * - **Cohen's kappa** corrects for chance agreement and then fails in the
 *   other direction: under the kappa paradox a skewed distribution produces a
 *   low kappa even when the raters agree closely, so it reports poor
 *   reliability precisely where raw agreement reports excellent.
 * - **Gwet's AC1** is the paradox-resistant coefficient, materially less
 *   affected by prevalence, and is reported alongside rather than instead.
 *
 * And all three are reported alongside the count that decides whether any of
 * them mean anything: how many proposals a human actually opened.
 */

export type ProposalObservation = {
	/** What Axel proposed, as a coarse action class. */
	proposed: string;
	/** What the human did. */
	actual: string;
	opened: boolean;
};

export type AgreementReport = {
	total: number;
	opened: number;
	scored: number;
	rawAgreement: number | null;
	cohensKappa: number | null;
	gwetsAC1: number | null;
	byClass: {
		actionClass: string;
		total: number;
		agreed: number;
		rawAgreement: number;
	}[];
};

const ratio = (numerator: number, denominator: number) =>
	denominator === 0 ? null : numerator / denominator;

/**
 * Computes all three coefficients over the opened proposals only.
 *
 * Unopened proposals are counted and excluded from scoring rather than
 * silently treated as disagreements — a proposal nobody read is evidence about
 * the review process, not about the agent.
 */
export function calculateAgreement(
	observations: readonly ProposalObservation[],
): AgreementReport {
	const opened = observations.filter((observation) => observation.opened);
	const n = opened.length;

	const classes = [
		...new Set(opened.flatMap((o) => [o.proposed, o.actual])),
	].sort();

	const agreed = opened.filter((o) => o.proposed === o.actual).length;
	const observedAgreement = ratio(agreed, n);

	// Chance agreement under Cohen's assumption: raters' marginals are
	// independent.
	let chance = 0;
	for (const actionClass of classes) {
		const proposedShare =
			opened.filter((o) => o.proposed === actionClass).length / (n || 1);
		const actualShare =
			opened.filter((o) => o.actual === actionClass).length / (n || 1);
		chance += proposedShare * actualShare;
	}

	const kappa =
		observedAgreement === null || chance === 1
			? null
			: (observedAgreement - chance) / (1 - chance);

	// Gwet's AC1 uses a different chance term: the probability of agreement by
	// chance is derived from how evenly the categories are used, which is what
	// makes it stable when one category dominates.
	const q = classes.length;
	let ac1Chance = 0;
	if (q > 1) {
		for (const actionClass of classes) {
			const share =
				(opened.filter((o) => o.proposed === actionClass).length +
					opened.filter((o) => o.actual === actionClass).length) /
				(2 * (n || 1));
			ac1Chance += share * (1 - share);
		}
		ac1Chance = ac1Chance / (q - 1);
	}
	const ac1 =
		observedAgreement === null || ac1Chance === 1
			? null
			: (observedAgreement - ac1Chance) / (1 - ac1Chance);

	// Stratified, never pooled. Pooling is what lets a system that only ever
	// escalates look like a system that agrees with its technicians.
	const byClass = classes.map((actionClass) => {
		const rows = opened.filter((o) => o.proposed === actionClass);
		const matched = rows.filter((o) => o.proposed === o.actual).length;
		return {
			actionClass,
			total: rows.length,
			agreed: matched,
			rawAgreement: rows.length === 0 ? 0 : matched / rows.length,
		};
	});

	return {
		total: observations.length,
		opened: n,
		scored: n,
		rawAgreement: observedAgreement,
		cohensKappa: kappa,
		gwetsAC1: ac1,
		byClass,
	};
}
