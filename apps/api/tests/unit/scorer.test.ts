import { describe, it, expect } from "vitest";
import { calculateMatchScore } from "../../src/modules/intake/scorer.js";
import type { QualificationCriteria } from "@recruitment-os/types";

const baseCriteria: QualificationCriteria = {
  mustHave: {
    licenses: ["CE"],
    rightToWork: true,
    customKeys: [{ key: "code95", question: "Heb je Code 95?", expectedFormat: "yes_no", required: true }],
  },
  niceToHave: { experienceYearsMin: 3 },
};

describe("calculateMatchScore", () => {
  it("returns 100 when all must-haves answered with high confidence + qualified", () => {
    const answers = {
      licenses: { value: "CE", confidence: "high" },
      rightToWork: { value: true, confidence: "high" },
      code95: { value: "ja", confidence: "high" },
      experienceYearsMin: { value: 5, confidence: "high" },
    };
    const score = calculateMatchScore("qualified", answers, baseCriteria);
    expect(score).toBe(100);
  });

  it("caps rejected verdict at 35 regardless of coverage", () => {
    const answers = {
      licenses: { value: "CE", confidence: "high" },
      rightToWork: { value: true, confidence: "high" },
      code95: { value: "ja", confidence: "high" },
    };
    const score = calculateMatchScore("rejected", answers, baseCriteria);
    expect(score).toBeLessThanOrEqual(35);
  });

  it("returns lower score when must-haves answered with low confidence", () => {
    const answersLow = {
      licenses: { value: "CE", confidence: "low" },
      rightToWork: { value: true, confidence: "low" },
      code95: { value: "ja", confidence: "low" },
    };
    const answersHigh = {
      licenses: { value: "CE", confidence: "high" },
      rightToWork: { value: true, confidence: "high" },
      code95: { value: "ja", confidence: "high" },
    };
    const highScore = calculateMatchScore("qualified", answersHigh, baseCriteria);
    const lowScore = calculateMatchScore("qualified", answersLow, baseCriteria);
    expect(lowScore).toBeLessThan(highScore);
  });

  it("returns 0 when no must-haves answered and verdict is rejected", () => {
    const score = calculateMatchScore("rejected", {}, baseCriteria);
    expect(score).toBe(0);
  });

  it("returns 80 for qualified verdict with all must-haves high-confidence and no niceToHave defined", () => {
    const criteriaNoNth: QualificationCriteria = {
      mustHave: { licenses: ["CE"] },
      niceToHave: {},
    };
    const answers = { licenses: { value: "CE", confidence: "high" } };
    const score = calculateMatchScore("qualified", answers, criteriaNoNth);
    // 70 (mh full) + 0 (no nth defined) + 10 (qualified bonus) = 80
    expect(score).toBe(80);
  });

  it("handles empty criteria gracefully — returns 80 for qualified with empty criteria", () => {
    const emptyCriteria: QualificationCriteria = { mustHave: {}, niceToHave: {} };
    const score = calculateMatchScore("qualified", {}, emptyCriteria);
    // No must-haves → mhScore = 70 (default), no nth → nthScore = 0, qualified bonus = 10 → 80
    expect(score).toBe(80);
  });

  it("handles unsure verdict — returns value between 0 and 100", () => {
    const answers = {
      licenses: { value: "C", confidence: "medium" },
      rightToWork: { value: true, confidence: "high" },
      code95: { value: "nee", confidence: "high" },
    };
    const score = calculateMatchScore("unsure", answers, baseCriteria);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
