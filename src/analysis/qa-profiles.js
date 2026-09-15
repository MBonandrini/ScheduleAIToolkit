/**
 * Configurable schedule-quality profiles.
 *
 * The "dcma-standard" profile follows the conventional DCMA/NASA-style
 * thresholds used by the 14-point schedule assessment. Other profiles are
 * deliberately identified as internal/custom screening profiles rather than
 * official standards.
 */
export const QA_PROFILES = {
  "dcma-standard": {
    id: "dcma-standard",
    name: "DCMA / NASA-style",
    description: "Conventional 14-point screening thresholds.",
    thresholds: {
      logicMissingPctMax: 5,
      leadPctMax: 0,
      lagPctMax: 5,
      fsPctMin: 90,
      sfCountMax: 0,
      hardConstraintPctMax: 5,
      highFloatPctMax: 5,
      negativeFloatPctMax: 0,
      highDurationPctMax: 5,
      invalidDateCountMax: 0,
      resourceMissingPctMax: 0,
      missedTaskPctMax: 5,
      cpliMin: 1,
      beiMin: 0.95,
      durationLimitDays: 44,
      highFloatLimitDays: 44
    }
  },
  "data-centre-strict": {
    id: "data-centre-strict",
    name: "Data Centre · Strict",
    description: "Tighter internal controls for high-density installation and commissioning programmes.",
    thresholds: {
      logicMissingPctMax: 2,
      leadPctMax: 0,
      lagPctMax: 3,
      fsPctMin: 92,
      sfCountMax: 0,
      hardConstraintPctMax: 2,
      highFloatPctMax: 3,
      negativeFloatPctMax: 0,
      highDurationPctMax: 3,
      invalidDateCountMax: 0,
      resourceMissingPctMax: 0,
      missedTaskPctMax: 3,
      cpliMin: 1,
      beiMin: 0.98,
      durationLimitDays: 30,
      highFloatLimitDays: 30
    }
  },
  "pharma-cqv": {
    id: "pharma-cqv",
    name: "Life Sciences / Pharma",
    description: "Internal profile emphasising short executable work packages and reliable turnover logic.",
    thresholds: {
      logicMissingPctMax: 2,
      leadPctMax: 0,
      lagPctMax: 3,
      fsPctMin: 90,
      sfCountMax: 0,
      hardConstraintPctMax: 3,
      highFloatPctMax: 4,
      negativeFloatPctMax: 0,
      highDurationPctMax: 3,
      invalidDateCountMax: 0,
      resourceMissingPctMax: 0,
      missedTaskPctMax: 3,
      cpliMin: 1,
      beiMin: 0.97,
      durationLimitDays: 30,
      highFloatLimitDays: 44
    }
  },
  "internal-strict": {
    id: "internal-strict",
    name: "Internal · Very Strict",
    description: "Zero-tolerance logic/date controls with tighter duration and float thresholds.",
    thresholds: {
      logicMissingPctMax: 0,
      leadPctMax: 0,
      lagPctMax: 2,
      fsPctMin: 95,
      sfCountMax: 0,
      hardConstraintPctMax: 1,
      highFloatPctMax: 2,
      negativeFloatPctMax: 0,
      highDurationPctMax: 2,
      invalidDateCountMax: 0,
      resourceMissingPctMax: 0,
      missedTaskPctMax: 2,
      cpliMin: 1,
      beiMin: 0.98,
      durationLimitDays: 20,
      highFloatLimitDays: 30
    }
  }
};

export const DEFAULT_QA_PROFILE_ID = "dcma-standard";

export function qaProfile(id = DEFAULT_QA_PROFILE_ID, customThresholds = null) {
  const base = QA_PROFILES[id] || QA_PROFILES[DEFAULT_QA_PROFILE_ID];
  return {
    ...base,
    thresholds: {
      ...base.thresholds,
      ...(customThresholds && typeof customThresholds === "object" ? customThresholds : {})
    }
  };
}
