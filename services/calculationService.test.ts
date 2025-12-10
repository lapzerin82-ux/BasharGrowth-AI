
import { describe, it, expect } from 'vitest';
import { calculateGrowth } from './calculationService';
import { Sex, MeasurementMethod, GrowthStandard, UserInput } from '../types';
import * as DATA from './growthData';

// Mock data points based on services/growthData.ts to ensure test accuracy
// WHO Male 0 months: Weight M=3.346, Length M=49.88
// CDC Male 60 months (5 years): Weight M=18.3, Height M=109.2

describe('calculateGrowth Service', () => {

    const baseInput: UserInput = {
        ageYears: 0,
        ageMonths: 0,
        sex: Sex.Male,
        weightKg: 3.346, // Median for WHO Male 0mo
        heightCm: 49.88, // Median for WHO Male 0mo
        method: MeasurementMethod.Recumbent,
        motherHeightCm: undefined,
        fatherHeightCm: undefined
    };

    describe('Standard Selection Logic', () => {
        it('should use WHO standard for infants < 24 months', () => {
            const result = calculateGrowth({ ...baseInput, ageYears: 1, ageMonths: 0 });
            expect(result.standardUsed).toBe(GrowthStandard.WHO);
            expect(result.metrics.weightForAge.label).toContain('WHO');
        });

        it('should use WHO standard for children 24-60 months', () => {
            const result = calculateGrowth({ ...baseInput, ageYears: 3, ageMonths: 0 });
            expect(result.standardUsed).toBe(GrowthStandard.WHO);
        });

        it('should use CDC standard for children >= 60 months (5 years)', () => {
            // CDC Male 5yr median: 18.3kg, 109.2cm
            const result = calculateGrowth({
                ...baseInput,
                ageYears: 5,
                ageMonths: 0,
                weightKg: 18.3,
                heightCm: 109.2
            });
            expect(result.standardUsed).toBe(GrowthStandard.CDC);
            expect(result.metrics.weightForAge.label).toContain('CDC');
        });
    });

    describe('Measurement Method Adjustment', () => {
        it('should add 0.7cm to height if standing and < 24 months', () => {
            const inputHeight = 80;
            const result = calculateGrowth({
                ...baseInput,
                ageYears: 1, 
                ageMonths: 6, // 18 months (< 24)
                heightCm: inputHeight,
                method: MeasurementMethod.Standing // Should trigger adjustment
            });

            // The Z-score calculation uses the adjusted height.
            // We can verify this by checking the value passed to the result metric
            expect(result.metrics.heightForAge.value).toBe(inputHeight + 0.7);
        });

        it('should NOT adjust height if recumbent and < 24 months', () => {
            const inputHeight = 80;
            const result = calculateGrowth({
                ...baseInput,
                ageYears: 1, 
                ageMonths: 6,
                heightCm: inputHeight,
                method: MeasurementMethod.Recumbent
            });
            expect(result.metrics.heightForAge.value).toBe(inputHeight);
        });

        it('should NOT adjust height if standing and >= 24 months', () => {
            const inputHeight = 90;
            const result = calculateGrowth({
                ...baseInput,
                ageYears: 2, 
                ageMonths: 1, // 25 months
                heightCm: inputHeight,
                method: MeasurementMethod.Standing
            });
            expect(result.metrics.heightForAge.value).toBe(inputHeight);
        });
    });

    describe('Z-Score Accuracy (Exact Match)', () => {
        it('should return Z-score ~0 when input matches the Median (M) exactly', () => {
            // WHO Male 0 months Median Weight is 3.346
            const result = calculateGrowth({
                ...baseInput,
                ageYears: 0,
                ageMonths: 0,
                sex: Sex.Male,
                weightKg: 3.346
            });
            
            // Floating point precision check
            expect(Math.abs(result.metrics.weightForAge.zScore)).toBeLessThan(0.001);
            expect(Math.abs(result.metrics.weightForAge.percentile - 50)).toBeLessThan(0.1);
        });

        it('should calculate positive Z-score for values above median', () => {
            const result = calculateGrowth({
                ...baseInput,
                ageYears: 0,
                ageMonths: 0,
                weightKg: 4.0 // Higher than 3.346
            });
            expect(result.metrics.weightForAge.zScore).toBeGreaterThan(0);
            expect(result.metrics.weightForAge.percentile).toBeGreaterThan(50);
        });

        it('should calculate negative Z-score for values below median', () => {
            const result = calculateGrowth({
                ...baseInput,
                ageYears: 0,
                ageMonths: 0,
                weightKg: 2.5 // Lower than 3.346
            });
            expect(result.metrics.weightForAge.zScore).toBeLessThan(0);
            expect(result.metrics.weightForAge.percentile).toBeLessThan(50);
        });
    });

    describe('BMI Calculation', () => {
        it('should calculate BMI correctly', () => {
            const weight = 20;
            const height = 100; // 1 meter
            const result = calculateGrowth({
                ...baseInput,
                ageYears: 5, // Old enough for BMI check
                ageMonths: 0,
                weightKg: weight,
                heightCm: height
            });
            
            // BMI = kg / m^2 = 20 / (1)^2 = 20
            expect(result.bmi).toBeCloseTo(20);
        });

        it('should provide BMI metrics for children >= 2 years', () => {
             const result = calculateGrowth({
                ...baseInput,
                ageYears: 2,
                ageMonths: 0
            });
            expect(result.metrics.bmiForAge).toBeDefined();
        });
    });

    describe('Mid-Parental Height (MPH)', () => {
        const father = 180;
        const mother = 160;

        it('should calculate MPH for Male correctly (+13cm offset)', () => {
            const result = calculateGrowth({
                ...baseInput,
                sex: Sex.Male,
                fatherHeightCm: father,
                motherHeightCm: mother
            });
            
            // (180 + 160 + 13) / 2 = 353 / 2 = 176.5
            expect(result.mph).toBe(176.5);
            expect(result.mphRange).toEqual([176.5 - 8.5, 176.5 + 8.5]);
        });

        it('should calculate MPH for Female correctly (-13cm offset)', () => {
             const result = calculateGrowth({
                ...baseInput,
                sex: Sex.Female,
                fatherHeightCm: father,
                motherHeightCm: mother
            });
            
            // (180 + 160 - 13) / 2 = 327 / 2 = 163.5
            expect(result.mph).toBe(163.5);
        });

        it('should return null MPH if parents are missing', () => {
            const result = calculateGrowth({
                ...baseInput,
                fatherHeightCm: undefined,
                motherHeightCm: undefined
            });
            expect(result.mph).toBeNull();
        });
    });

    describe('Classifications', () => {
        it('should classify severe underweight correctly (Z < -3)', () => {
            // Force a very low weight
            const result = calculateGrowth({
                ...baseInput,
                weightKg: 1.5 // Way below median of 3.346
            });
            expect(result.metrics.weightForAge.zScore).toBeLessThan(-3);
            expect(result.metrics.weightForAge.classification).toBe("Severe Underweight");
        });

        it('should classify stunted correctly (Z < -2)', () => {
             // WHO Male 0mo Length Median 49.88, S=0.038 (~1.9cm SD)
             // -2 SD approx 46cm
             const result = calculateGrowth({
                ...baseInput,
                heightCm: 45 
            });
            expect(result.metrics.heightForAge.zScore).toBeLessThan(-2);
            expect(result.metrics.heightForAge.classification).toMatch(/Stunted/);
        });
    });
});