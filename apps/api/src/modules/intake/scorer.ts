import type { QualificationCriteria } from "@recruitment-os/types";

const CONFIDENCE_WEIGHT: Record<string, number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.3,
};

export type AnswerMap = Record<string, { value: unknown; confidence: string }>;

function getMustHaveKeys(criteria: QualificationCriteria): string[] {
  const keys: string[] = [];
  const mh = criteria.mustHave;
  if ((mh.licenses ?? []).length > 0) keys.push("licenses");
  if (mh.availability) keys.push("availability");
  if (mh.vertical) keys.push("vertical");
  if (mh.locationRadiusKm !== undefined) keys.push("locationRadiusKm");
  if (mh.rightToWork !== undefined) keys.push("rightToWork");
  if (mh.minAge !== undefined) keys.push("minAge");
  for (const ck of mh.customKeys ?? []) {
    if (ck.required) keys.push(ck.key);
  }
  return keys;
}

function getNiceToHaveKeys(criteria: QualificationCriteria): string[] {
  const keys: string[] = [];
  const nth = criteria.niceToHave;
  if (nth.experienceYearsMin !== undefined) keys.push("experienceYearsMin");
  if ((nth.certifications ?? []).length > 0) keys.push("certifications");
  if ((nth.preferredLanguages ?? []).length > 0) keys.push("preferredLanguages");
  if (nth.freeText) keys.push("freeText");
  return keys;
}

export function calculateMatchScore(
  verdict: "qualified" | "rejected" | "unsure",
  answers: AnswerMap,
  criteria: QualificationCriteria,
): number {
  const mhKeys = getMustHaveKeys(criteria);
  const nthKeys = getNiceToHaveKeys(criteria);

  let mhEarned = 0;
  for (const key of mhKeys) {
    const ans = answers[key];
    if (ans) mhEarned += CONFIDENCE_WEIGHT[ans.confidence] ?? 0.5;
  }
  const mhScore = mhKeys.length > 0 ? (mhEarned / mhKeys.length) * 70 : 70;

  let nthEarned = 0;
  for (const key of nthKeys) {
    const ans = answers[key];
    if (ans) nthEarned += CONFIDENCE_WEIGHT[ans.confidence] ?? 0.5;
  }
  const nthScore = nthKeys.length > 0 ? (nthEarned / nthKeys.length) * 20 : 0;

  const verdictBonus = verdict === "qualified" ? 10 : verdict === "unsure" ? 5 : 0;

  const raw = Math.round(mhScore + nthScore + verdictBonus);

  return verdict === "rejected" ? Math.min(raw, 35) : Math.min(raw, 100);
}
