

export enum Sex {
  Male = 'male',
  Female = 'female',
}

export enum MeasurementMethod {
  Recumbent = 'recumbent', // Lying down
  Standing = 'standing',
}

export enum GrowthStandard {
  WHO = 'WHO',
  CDC = 'CDC',
}

export enum GrowthHormoneResult {
    NotTested = 'Not Tested',
    Normal = 'Normal',
    Low = 'Low (Deficiency)'
}

export interface UserInput {
  ageYears: number;
  ageMonths: number;
  ageDays?: number; // Optional exact age in days (useful for neonates)
  dob?: string; // Date of Birth YYYY-MM-DD
  measurementDate?: string; // Date of Measurement YYYY-MM-DD
  sex: Sex;
  weightKg: number;
  heightCm: number;
  method: MeasurementMethod;
  motherHeightCm?: number;
  fatherHeightCm?: number;
  boneAgeYears?: number; // Optional Bone Age from X-ray
  growthHormoneResult?: GrowthHormoneResult; // Optional GH Test
  // New fields for Growth Velocity
  previousHeightCm?: number;
  intervalMonths?: number;
}

export interface MetricResult {
  label: string;
  value: number; // The raw input value (e.g., weight)
  zScore: number;
  percentile: number;
  classification: string;
}

export interface GrowthCalculation {
  ageMonths: number;
  ageYears: number;
  exactAgeDays?: number; // Exact age in days for display
  standardUsed: GrowthStandard;
  metrics: {
    weightForAge: MetricResult;
    heightForAge: MetricResult;
    bmiForAge?: MetricResult;
    weightForLength?: MetricResult; // For infants
  };
  bmi?: number;
  mph: number | null; // Mid-parental height
  mphRange: [number, number] | null;
  boneAgeAnalysis?: {
    boneAge: number;
    diffYears: number;
    diffPercent: number;
    interpretation: string;
    isFlagged: boolean;
  };
  growthHormoneResult?: GrowthHormoneResult;
  growthVelocity?: number; // cm/year
}

export interface LMSDataPoint {
  ageMonths: number;
  L: number;
  M: number;
  S: number;
}

export type GrowthDataSet = {
  [key in Sex]: LMSDataPoint[];
};