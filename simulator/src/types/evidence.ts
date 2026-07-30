// TypeScript interface contract: evidence + references + citations (Phase 1).
// Types only. Mirrors simulator/src/evidence/evidenceEngine.js and citationEngine.js.

import type { Confidence, SpeciesId } from './biology';

export interface Reference {
  id: string;                  // e.g. 'chen_2012'
  citation?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  licenseClass?:
    | 'PUBLIC_DOMAIN' | 'CC0' | 'CC-BY' | 'CC-BY-SA'
    | 'REFERENCE_ONLY' | 'COPYRIGHTED_DO_NOT_REUSE' | 'UNKNOWN';
  verifyBeforeUse?: boolean;
}

export interface Citation extends Reference {
  use?: string;
  notes?: string;
}

/** Attached to any future visual object to gate rendering/animation. */
export interface EvidenceDescriptor {
  confidence: Confidence;
  referenceIds: string[];
  species?: SpeciesId | string;
  model?: string;
  limitations?: string[];
  unsupportedClaims?: string[];
}
