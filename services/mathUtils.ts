import { LMSDataPoint } from "../types";

/**
 * Linear Interpolation for LMS parameters.
 * Finds the two closest data points by age and interpolates L, M, S values.
 */
export const interpolateLMS = (data: LMSDataPoint[], xValue: number): LMSDataPoint => {
    // Sort by age/length
    const sorted = [...data].sort((a, b) => a.ageMonths - b.ageMonths);
    
    // Handle out of bounds
    if (xValue <= sorted[0].ageMonths) return sorted[0];
    if (xValue >= sorted[sorted.length - 1].ageMonths) return sorted[sorted.length - 1];

    // Find neighbors
    let lower = sorted[0];
    let upper = sorted[1];
    
    for (let i = 0; i < sorted.length - 1; i++) {
        if (xValue >= sorted[i].ageMonths && xValue < sorted[i+1].ageMonths) {
            lower = sorted[i];
            upper = sorted[i+1];
            break;
        }
    }

    const fraction = (xValue - lower.ageMonths) / (upper.ageMonths - lower.ageMonths);

    return {
        ageMonths: xValue,
        L: lower.L + (upper.L - lower.L) * fraction,
        M: lower.M + (upper.M - lower.M) * fraction,
        S: lower.S + (upper.S - lower.S) * fraction,
    };
};

/**
 * Calculates Z-Score using the LMS method.
 * Z = ((X/M)^L - 1) / (L*S)
 * If L is close to 0, Z = ln(X/M) / S
 */
export const calculateZScore = (value: number, lms: LMSDataPoint): number => {
    const { L, M, S } = lms;
    if (Math.abs(L) < 0.01) {
        return Math.log(value / M) / S;
    }
    return (Math.pow(value / M, L) - 1) / (L * S);
};

/**
 * Inverse LMS: Calculates the measurement value (X) for a given Z-score.
 * X = M * (1 + L*S*Z)^(1/L)
 * Used for plotting chart curves.
 */
export const calculateValueFromZ = (z: number, lms: LMSDataPoint): number => {
    const { L, M, S } = lms;
    if (Math.abs(L) < 0.01) {
        return M * Math.exp(z * S);
    }
    const base = 1 + L * S * z;
    // Avoid complex numbers if base is negative (unlikely in growth data ranges)
    if (base <= 0) return 0; 
    return M * Math.pow(base, 1 / L);
};

/**
 * Standard Normal Cumulative Distribution Function (CDF)
 * Uses error function approximation.
 */
export const normalCDF = (z: number): number => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) prob = 1 - prob;
    return prob;
};

export const zScoreToPercentile = (z: number): number => {
    return normalCDF(z) * 100;
};