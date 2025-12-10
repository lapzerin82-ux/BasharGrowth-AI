

import { GrowthCalculation, GrowthStandard, MetricResult, Sex, UserInput } from "../types";
import { interpolateLMS, calculateZScore, zScoreToPercentile } from "./mathUtils";
import * as DATA from "./growthData";

export const calculateGrowth = (input: UserInput): GrowthCalculation => {
    // 1. Determine Age
    let ageMonths = 0;
    let exactAgeDays = 0;

    // Hierarchy: Explicit Days > DOB Calculation > Manual Years/Months
    if (input.ageDays !== undefined && !isNaN(input.ageDays)) {
        // Precise WHO/CDC standard: 1 month = 30.4375 days
        exactAgeDays = input.ageDays;
        ageMonths = input.ageDays / 30.4375;
    } else if (input.dob && input.measurementDate) {
        // Precise Calculation override: If DOB and Measurement Date are available
        const dob = new Date(input.dob);
        const meas = new Date(input.measurementDate);
        if (!isNaN(dob.getTime()) && !isNaN(meas.getTime())) {
            const diffTime = meas.getTime() - dob.getTime();
            // Convert to days
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            exactAgeDays = diffDays;
            if (diffDays >= 0) {
                ageMonths = diffDays / 30.4375;
            }
        } else {
             // Fallback if dates invalid
             ageMonths = (isNaN(input.ageYears) ? 0 : input.ageYears) * 12 + (isNaN(input.ageMonths) ? 0 : input.ageMonths);
             exactAgeDays = ageMonths * 30.4375;
        }
    } else {
        // Default to manual input
        ageMonths = (isNaN(input.ageYears) ? 0 : input.ageYears) * 12 + (isNaN(input.ageMonths) ? 0 : input.ageMonths);
        exactAgeDays = ageMonths * 30.4375;
    }
    
    const ageYears = ageMonths / 12;

    let standard = GrowthStandard.CDC;
    let useBMI = true;

    // Determine Standard logic
    if (ageMonths < 24) {
        standard = GrowthStandard.WHO;
        useBMI = false;
    } else if (ageMonths < 60) {
        standard = GrowthStandard.WHO;
        useBMI = true; // Optional but usually shown
    } else {
        standard = GrowthStandard.CDC;
        useBMI = true;
    }

    // Adjust height if necessary (Standing measured < 24m convert to length, or Recumbent > 24m convert to height)
    let adjustedHeight = input.heightCm;
    if (input.method === 'standing' && ageMonths < 24) { 
        // Standing is shorter than recumbent, so if we need recumbent for WHO < 24, add ~0.7
        adjustedHeight += 0.7;
    }

    // Calculate BMI
    const bmi = input.weightKg / Math.pow(adjustedHeight / 100, 2);

    // --- LMS Lookups ---
    const sexKey = input.sex;
    
    // 1. Weight-for-Age
    let wfaData = standard === GrowthStandard.WHO ? DATA.WHO_WEIGHT_AGE[sexKey] : DATA.CDC_WEIGHT_AGE[sexKey];
    const wfaLMS = interpolateLMS(wfaData, ageMonths);
    const zWFA = calculateZScore(input.weightKg, wfaLMS);
    
    // 2. Height/Length-for-Age
    let hfaData = standard === GrowthStandard.WHO ? DATA.WHO_LENGTH_AGE[sexKey] : DATA.CDC_HEIGHT_AGE[sexKey];
    const hfaLMS = interpolateLMS(hfaData, ageMonths);
    const zHFA = calculateZScore(adjustedHeight, hfaLMS);

    // 3. BMI-for-Age (if applicable)
    let bmiResult: MetricResult | undefined;
    if (useBMI) {
        // Simplify: Using CDC BMI data for > 2y for this demo as WHO BMI data is complex to embed fully
        const bmiLMS = interpolateLMS(DATA.CDC_BMI_AGE[sexKey], ageMonths);
        const zBMI = calculateZScore(bmi, bmiLMS);
        bmiResult = {
            label: `BMI-for-Age (${standard})`,
            value: parseFloat(bmi.toFixed(2)),
            zScore: zBMI,
            percentile: zScoreToPercentile(zBMI),
            classification: getBMIClassification(zScoreToPercentile(zBMI), standard)
        };
    }

    // 4. Weight-for-Length (WHO < 24m or < 60m) - Simplified
    let wflResult: MetricResult | undefined;
    if (standard === GrowthStandard.WHO) {
        // Using length as the xValue for interpolation
        const wflLMS = interpolateLMS(DATA.WHO_WEIGHT_LENGTH[sexKey], adjustedHeight);
        const zWFL = calculateZScore(input.weightKg, wflLMS);
        wflResult = {
            label: ageMonths < 24 ? "Weight-for-Length (WHO)" : "Weight-for-Height (WHO)",
            value: input.weightKg,
            zScore: zWFL,
            percentile: zScoreToPercentile(zWFL),
            classification: getWFLClassification(zWFL)
        };
    }

    // Mid-parental height
    let mph: number | null = null;
    let mphRange: [number, number] | null = null;
    
    // Only calculate if both parents' height is provided and valid numbers
    if (input.motherHeightCm && input.fatherHeightCm && !isNaN(input.motherHeightCm) && !isNaN(input.fatherHeightCm)) {
        const offset = input.sex === Sex.Male ? 13 : -13;
        mph = (input.fatherHeightCm + input.motherHeightCm + offset) / 2;
        mphRange = [mph - 8.5, mph + 8.5];
    }

    // Bone Age Analysis
    let boneAgeAnalysis: GrowthCalculation['boneAgeAnalysis'] | undefined;
    if (input.boneAgeYears && !isNaN(input.boneAgeYears) && ageYears > 0) {
        const diff = input.boneAgeYears - ageYears;
        const diffPercent = (diff / ageYears) * 100;
        
        let interpretation = "Consistent with chronological age";
        let isFlagged = false;

        if (diffPercent < -20) {
            interpretation = "Significant Delay (>20%)";
            isFlagged = true;
        } else if (diffPercent > 20) {
            interpretation = "Significant Advancement (>20%)";
            isFlagged = true;
        }

        boneAgeAnalysis = {
            boneAge: input.boneAgeYears,
            diffYears: diff,
            diffPercent,
            interpretation,
            isFlagged
        };
    }

    // Growth Velocity Calculation
    let growthVelocity: number | undefined;
    if (input.previousHeightCm && input.intervalMonths && input.intervalMonths > 0) {
        const growthCm = adjustedHeight - input.previousHeightCm;
        const intervalYears = input.intervalMonths / 12;
        // Avoid division by zero or negative time
        if (intervalYears > 0) {
            growthVelocity = growthCm / intervalYears;
        }
    }

    return {
        ageMonths,
        ageYears,
        exactAgeDays,
        standardUsed: standard,
        bmi,
        mph,
        mphRange,
        boneAgeAnalysis,
        growthHormoneResult: input.growthHormoneResult,
        growthVelocity,
        metrics: {
            weightForAge: {
                label: `Weight-for-Age (${standard})`,
                value: input.weightKg,
                zScore: zWFA,
                percentile: zScoreToPercentile(zWFA),
                classification: getWeightClassification(zWFA)
            },
            heightForAge: {
                label: standard === GrowthStandard.WHO ? "Length-for-Age" : "Stature-for-Age",
                value: adjustedHeight,
                zScore: zHFA,
                percentile: zScoreToPercentile(zHFA),
                classification: getHeightClassification(zHFA)
            },
            bmiForAge: bmiResult,
            weightForLength: wflResult,
        }
    };
};

// --- Classification Helpers ---

function getWeightClassification(z: number): string {
    if (z < -3) return "Severe Underweight";
    if (z < -2) return "Underweight";
    if (z > 2) return "High weight-for-age";
    return "Normal weight";
}

function getHeightClassification(z: number): string {
    if (z < -3) return "Severely Stunted";
    if (z < -2) return "Stunted";
    if (z > 2) return "Tall";
    return "Normal height";
}

function getWFLClassification(z: number): string {
    if (z < -3) return "Severely Wasted";
    if (z < -2) return "Wasted";
    if (z > 3) return "Obese";
    if (z > 2) return "Overweight";
    return "Normal";
}

function getBMIClassification(percentile: number, standard: GrowthStandard): string {
    if (standard === GrowthStandard.CDC) {
        if (percentile < 5) return "Underweight";
        if (percentile < 85) return "Healthy weight";
        if (percentile < 95) return "Overweight";
        return "Obesity";
    }
    return "N/A";
}