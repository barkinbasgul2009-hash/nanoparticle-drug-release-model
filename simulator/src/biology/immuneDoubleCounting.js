// Phase-7C double-counting protection (Part 1 - Section 2). Actively prevents the same biological
// effect from being applied twice through different labels (e.g. hypoxia reducing CD8 activity twice,
// checkpoint pressure applied multiple times, tumour visibility recounted inside antigen presentation,
// suppression recounted inside escape). Wraps the Section-1 ImmuneContributionLedger and records an
// explicit ExclusionRecord for every rejected/replaced contribution. Supports priority + mutually-
// exclusive groups. Deterministic; frame-indexed.
//
// Part 2 remediation: exclusion ids are CONTENT-DERIVED from the canonical identity payload (record
// type + frame + reason code + excluded/replacement contributor + aggregation target + registry rule),
// never a module-global counter. Identical exclusion events therefore share one deterministic id
// (duplicate policy = DEDUPLICATE); a same-id-with-different-payload is an integrity collision.

import { deterministicId, registerIdentity } from './immuneSerialization.js';

/** A record of one excluded (or replaced) contribution and why. Identity is content-derived. */
export class ExclusionRecord {
  constructor(def = {}) {
    this.reason = def.reason || 'duplicate';
    this.excludedContributor = def.excludedContributor || null;
    this.replacementContributor = def.replacementContributor || null;
    this.registryRule = def.registryRule || null;
    this.aggregationTarget = def.aggregationTarget || null;
    this.frameIndex = Number.isInteger(def.frameIndex) ? def.frameIndex : 0;
    // identity-BEARING payload only (no prose / labels / timestamps)
    this.exclusionId = def.exclusionId || deterministicId('imx', {
      recordType: 'exclusion', frameIndex: this.frameIndex, reasonCode: this.reason,
      excludedContributor: this.excludedContributor, replacementContributor: this.replacementContributor,
      aggregationTarget: this.aggregationTarget, registryRule: this.registryRule,
    }, `f${this.frameIndex}`);
    this.metadata = def.metadata || {};
  }
  /** The canonical identity payload (used for collision detection). */
  identityPayload() { return { recordType: 'exclusion', frameIndex: this.frameIndex, reasonCode: this.reason, excludedContributor: this.excludedContributor, replacementContributor: this.replacementContributor, aggregationTarget: this.aggregationTarget, registryRule: this.registryRule }; }
  toSerializable() { return { exclusionId: this.exclusionId, reason: this.reason, excludedContributor: this.excludedContributor, replacementContributor: this.replacementContributor, registryRule: this.registryRule, aggregationTarget: this.aggregationTarget, frameIndex: this.frameIndex, metadata: { ...this.metadata } }; }
}

/**
 * Guards a set of contributions against double counting. A contribution's identity is its
 * `effectKey` (defaults to `${targetMetric}|${sourceMetric}|${sourceModule}`); a second contribution
 * with the same effectKey is excluded unless it has strictly higher priority, in which case it
 * REPLACES the earlier one (recorded either way). Mutually-exclusive groups reject the second member.
 */
export class ImmuneContributionGuard {
  /** @param {object} [ledger] a Section-1 ImmuneContributionLedger (optional) */
  constructor(ledger = null) {
    this.ledger = ledger;
    this.appliedByKey = new Map();      // effectKey -> applied contribution
    this.appliedGroups = new Map();     // mutuallyExclusiveGroup -> effectKey
    this.exclusions = [];
    this.applied = [];
  }

  _key(c) { return c.effectKey || `${c.targetMetric}|${c.sourceMetric}|${c.sourceModule}`; }

  /**
   * Attempt to apply a contribution. Returns { applied:boolean, record|exclusion }.
   * @param {{ targetMetric:string, sourceMetric:string, sourceModule:string, value?:number,
   *   priority?:number, mutuallyExclusiveGroup?:string, effectKey?:string, registryRule?:string, frameIndex?:number }} c
   */
  apply(c) {
    const key = this._key(c);
    const priority = Number.isFinite(c.priority) ? c.priority : 0;

    // mutually-exclusive group check
    if (c.mutuallyExclusiveGroup && this.appliedGroups.has(c.mutuallyExclusiveGroup)) {
      const existingKey = this.appliedGroups.get(c.mutuallyExclusiveGroup);
      const ex = new ExclusionRecord({ reason: 'mutually_exclusive_group', excludedContributor: key, replacementContributor: existingKey, registryRule: c.registryRule || c.mutuallyExclusiveGroup, aggregationTarget: c.targetMetric, frameIndex: c.frameIndex });
      this.exclusions.push(ex); return { applied: false, exclusion: ex };
    }

    if (this.appliedByKey.has(key)) {
      const prev = this.appliedByKey.get(key);
      const prevPriority = Number.isFinite(prev.priority) ? prev.priority : 0;
      if (priority > prevPriority) {
        // replace the earlier lower-priority contribution
        const ex = new ExclusionRecord({ reason: 'replaced_by_higher_priority', excludedContributor: this._key(prev), replacementContributor: key, registryRule: c.registryRule, aggregationTarget: c.targetMetric, frameIndex: c.frameIndex });
        this.exclusions.push(ex);
        this.applied = this.applied.filter((a) => this._key(a) !== key);
        this._record(c, key);
        return { applied: true, replaced: true, exclusion: ex };
      }
      // duplicate of equal/lower priority -> excluded
      const ex = new ExclusionRecord({ reason: 'duplicate_effect', excludedContributor: key, replacementContributor: this._key(prev), registryRule: c.registryRule, aggregationTarget: c.targetMetric, frameIndex: c.frameIndex });
      this.exclusions.push(ex); return { applied: false, exclusion: ex };
    }

    this._record(c, key);
    return { applied: true };
  }

  _record(c, key) {
    this.appliedByKey.set(key, c);
    if (c.mutuallyExclusiveGroup) this.appliedGroups.set(c.mutuallyExclusiveGroup, key);
    this.applied.push(c);
    if (this.ledger && typeof this.ledger.add === 'function') this.ledger.add({ targetMetric: c.targetMetric, sourceModule: c.sourceModule, sourceMetric: c.sourceMetric, rawValue: c.value ?? null, applied: true, registryEntryId: c.registryRule || null });
  }

  /**
   * Serialized exclusions with an explicit duplicate/collision policy (deterministic, order-independent):
   * identical identity payload -> DEDUPLICATE (one record); same id with a DIFFERENT payload -> integrity
   * collision (throws). Records are returned sorted by exclusionId so output never depends on push order.
   */
  getExclusions() {
    const seen = new Map(); const out = [];
    for (const e of this.exclusions) {
      const status = registerIdentity(seen, e.exclusionId, e.identityPayload());
      if (status === 'collision') throw new Error(`IMMUNE_IDENTITY_COLLISION: exclusion id ${e.exclusionId} maps to two different payloads`);
      if (status === 'new') out.push(e.toSerializable());   // 'duplicate' -> dedup (same accounting event)
    }
    return out.sort((a, b) => (a.exclusionId < b.exclusionId ? -1 : a.exclusionId > b.exclusionId ? 1 : 0));
  }
  getApplied() { return this.applied.slice(); }
}

export default ImmuneContributionGuard;
