
import { GrowthDataSet, Sex } from '../types';

// NOTE: This data is an approximation of WHO (0-5y) and CDC (2-20y) growth standards.
// In a production environment, this should be the full monthly/daily LMS tables.

// --- WHO DATA (0 - 36 Months High Res + 36-60 Months Approx) ---

export const WHO_WEIGHT_AGE: GrowthDataSet = {
  [Sex.Male]: [
    { ageMonths: 0, L: -0.3521, M: 3.3464, S: 0.14602 },
    { ageMonths: 1, L: -0.3521, M: 4.4709, S: 0.14495 },
    { ageMonths: 2, L: -0.3521, M: 5.5675, S: 0.14393 },
    { ageMonths: 3, L: -0.3521, M: 6.3762, S: 0.14328 },
    { ageMonths: 4, L: -0.3521, M: 7.0023, S: 0.14290 },
    { ageMonths: 5, L: -0.3521, M: 7.5105, S: 0.14267 },
    { ageMonths: 6, L: -0.3521, M: 7.9340, S: 0.14254 },
    { ageMonths: 7, L: -0.3521, M: 8.2970, S: 0.14247 },
    { ageMonths: 8, L: -0.3521, M: 8.6151, S: 0.14243 },
    { ageMonths: 9, L: -0.3521, M: 8.9014, S: 0.14241 },
    { ageMonths: 10, L: -0.3521, M: 9.1649, S: 0.14239 },
    { ageMonths: 11, L: -0.3521, M: 9.4122, S: 0.14237 },
    { ageMonths: 12, L: -0.3521, M: 9.6479, S: 0.14236 },
    { ageMonths: 13, L: -0.3521, M: 9.8779, S: 0.14234 },
    { ageMonths: 14, L: -0.3521, M: 10.0998, S: 0.14232 },
    { ageMonths: 15, L: -0.3521, M: 10.3113, S: 0.14230 },
    { ageMonths: 16, L: -0.3521, M: 10.5123, S: 0.14228 },
    { ageMonths: 17, L: -0.3521, M: 10.7039, S: 0.14226 },
    { ageMonths: 18, L: -0.3521, M: 10.8870, S: 0.14224 },
    { ageMonths: 19, L: -0.3521, M: 11.0621, S: 0.14222 },
    { ageMonths: 20, L: -0.3521, M: 11.2296, S: 0.14220 },
    { ageMonths: 21, L: -0.3521, M: 11.3900, S: 0.14218 },
    { ageMonths: 22, L: -0.3521, M: 11.5437, S: 0.14216 },
    { ageMonths: 23, L: -0.3521, M: 11.6910, S: 0.14214 },
    { ageMonths: 24, L: -0.3521, M: 11.8325, S: 0.14212 },
    { ageMonths: 25, L: -0.3521, M: 11.9685, S: 0.14210 },
    { ageMonths: 26, L: -0.3521, M: 12.0994, S: 0.14208 },
    { ageMonths: 27, L: -0.3521, M: 12.2256, S: 0.14206 },
    { ageMonths: 28, L: -0.3521, M: 12.3474, S: 0.14204 },
    { ageMonths: 29, L: -0.3521, M: 12.4652, S: 0.14202 },
    { ageMonths: 30, L: -0.3521, M: 12.5793, S: 0.14200 },
    { ageMonths: 31, L: -0.3521, M: 12.6900, S: 0.14198 },
    { ageMonths: 32, L: -0.3521, M: 12.7976, S: 0.14196 },
    { ageMonths: 33, L: -0.3521, M: 12.9024, S: 0.14194 },
    { ageMonths: 34, L: -0.3521, M: 13.0046, S: 0.14192 },
    { ageMonths: 35, L: -0.3521, M: 13.1046, S: 0.14190 },
    { ageMonths: 36, L: -0.3521, M: 13.2024, S: 0.14188 },
    // Extended approximation to 60m
    { ageMonths: 48, L: -0.18, M: 16.3, S: 0.11 }, 
    { ageMonths: 60, L: -0.21, M: 18.3, S: 0.11 },
  ],
  [Sex.Female]: [
    { ageMonths: 0, L: -0.3833, M: 3.2322, S: 0.14171 },
    { ageMonths: 1, L: -0.3833, M: 4.1873, S: 0.13724 },
    { ageMonths: 2, L: -0.3833, M: 5.1282, S: 0.13470 },
    { ageMonths: 3, L: -0.3833, M: 5.8458, S: 0.13395 },
    { ageMonths: 4, L: -0.3833, M: 6.4237, S: 0.13366 },
    { ageMonths: 5, L: -0.3833, M: 6.8985, S: 0.13362 },
    { ageMonths: 6, L: -0.3833, M: 7.2970, S: 0.13368 },
    { ageMonths: 7, L: -0.3833, M: 7.6422, S: 0.13379 },
    { ageMonths: 8, L: -0.3833, M: 7.9487, S: 0.13393 },
    { ageMonths: 9, L: -0.3833, M: 8.2254, S: 0.13408 },
    { ageMonths: 10, L: -0.3833, M: 8.4785, S: 0.13422 },
    { ageMonths: 11, L: -0.3833, M: 8.7137, S: 0.13436 },
    { ageMonths: 12, L: -0.3833, M: 8.9351, S: 0.13449 },
    { ageMonths: 13, L: -0.3833, M: 9.1450, S: 0.13460 },
    { ageMonths: 14, L: -0.3833, M: 9.3454, S: 0.13469 },
    { ageMonths: 15, L: -0.3833, M: 9.5376, S: 0.13478 },
    { ageMonths: 16, L: -0.3833, M: 9.7229, S: 0.13485 },
    { ageMonths: 17, L: -0.3833, M: 9.9020, S: 0.13491 },
    { ageMonths: 18, L: -0.3833, M: 10.0754, S: 0.13496 },
    { ageMonths: 19, L: -0.3833, M: 10.2435, S: 0.13500 },
    { ageMonths: 20, L: -0.3833, M: 10.4066, S: 0.13502 },
    { ageMonths: 21, L: -0.3833, M: 10.5650, S: 0.13504 },
    { ageMonths: 22, L: -0.3833, M: 10.7190, S: 0.13504 },
    { ageMonths: 23, L: -0.3833, M: 10.8688, S: 0.13504 },
    { ageMonths: 24, L: -0.3833, M: 11.0148, S: 0.13503 },
    { ageMonths: 25, L: -0.3833, M: 11.1572, S: 0.13501 },
    { ageMonths: 26, L: -0.3833, M: 11.2964, S: 0.13498 },
    { ageMonths: 27, L: -0.3833, M: 11.4325, S: 0.13495 },
    { ageMonths: 28, L: -0.3833, M: 11.5659, S: 0.13492 },
    { ageMonths: 29, L: -0.3833, M: 11.6967, S: 0.13488 },
    { ageMonths: 30, L: -0.3833, M: 11.8252, S: 0.13484 },
    { ageMonths: 31, L: -0.3833, M: 11.9515, S: 0.13479 },
    { ageMonths: 32, L: -0.3833, M: 12.0759, S: 0.13475 },
    { ageMonths: 33, L: -0.3833, M: 12.1983, S: 0.13470 },
    { ageMonths: 34, L: -0.3833, M: 12.3190, S: 0.13465 },
    { ageMonths: 35, L: -0.3833, M: 12.4380, S: 0.13460 },
    { ageMonths: 36, L: -0.3833, M: 12.5553, S: 0.13455 },
    // Extended approximation to 60m
    { ageMonths: 48, L: -0.18, M: 16.1, S: 0.12 },
    { ageMonths: 60, L: -0.21, M: 18.2, S: 0.12 },
  ]
};

export const WHO_LENGTH_AGE: GrowthDataSet = {
  [Sex.Male]: [
    { ageMonths: 0, L: 1, M: 49.88, S: 0.038 },
    { ageMonths: 3, L: 1, M: 61.4, S: 0.036 },
    { ageMonths: 6, L: 1, M: 67.6, S: 0.035 },
    { ageMonths: 9, L: 1, M: 72.0, S: 0.034 },
    { ageMonths: 12, L: 1, M: 75.73, S: 0.035 },
    { ageMonths: 18, L: 1, M: 82.3, S: 0.035 },
    { ageMonths: 24, L: 1, M: 87.80, S: 0.036 },
    { ageMonths: 30, L: 1, M: 91.9, S: 0.036 },
    { ageMonths: 36, L: 1, M: 96.1, S: 0.036 },
    { ageMonths: 42, L: 1, M: 99.7, S: 0.037 }, // Interpolated point
    { ageMonths: 48, L: 1, M: 103.3, S: 0.037 }, // WHO Age 4
    { ageMonths: 54, L: 1, M: 106.7, S: 0.037 }, // Interpolated point
    { ageMonths: 60, L: 1, M: 110.0, S: 0.038 }, // WHO Age 5
  ],
  [Sex.Female]: [
    { ageMonths: 0, L: 1, M: 49.14, S: 0.038 },
    { ageMonths: 3, L: 1, M: 59.8, S: 0.036 },
    { ageMonths: 6, L: 1, M: 65.7, S: 0.035 },
    { ageMonths: 9, L: 1, M: 70.1, S: 0.035 },
    { ageMonths: 12, L: 1, M: 74.02, S: 0.035 },
    { ageMonths: 18, L: 1, M: 80.7, S: 0.035 },
    { ageMonths: 24, L: 1, M: 86.40, S: 0.036 },
    { ageMonths: 30, L: 1, M: 90.7, S: 0.036 },
    { ageMonths: 36, L: 1, M: 95.1, S: 0.036 },
    { ageMonths: 42, L: 1, M: 99.0, S: 0.036 }, // Interpolated point
    { ageMonths: 48, L: 1, M: 102.7, S: 0.037 }, // WHO Age 4
    { ageMonths: 54, L: 1, M: 106.0, S: 0.037 }, // Interpolated point
    { ageMonths: 60, L: 1, M: 109.4, S: 0.038 }, // WHO Age 5
  ]
};

// --- CDC DATA (2 Years - 20 Years) ---
// Expanded to include granular points for 2-5 years (24-60m) and smooth curve up to 20y.

export const CDC_WEIGHT_AGE: GrowthDataSet = {
  [Sex.Male]: [
    { ageMonths: 24, L: -0.12, M: 12.7, S: 0.12 },
    { ageMonths: 30, L: -0.14, M: 13.7, S: 0.12 },
    { ageMonths: 36, L: -0.16, M: 14.7, S: 0.12 },
    { ageMonths: 42, L: -0.19, M: 15.7, S: 0.12 },
    { ageMonths: 48, L: -0.21, M: 16.7, S: 0.12 },
    { ageMonths: 54, L: -0.23, M: 17.7, S: 0.12 },
    { ageMonths: 60, L: -0.34, M: 18.7, S: 0.125 }, // Age 5
    { ageMonths: 72, L: -0.42, M: 20.7, S: 0.13 },  // Age 6
    { ageMonths: 84, L: -0.51, M: 22.9, S: 0.135 }, // Age 7
    { ageMonths: 96, L: -0.61, M: 25.3, S: 0.14 },  // Age 8
    { ageMonths: 108, L: -0.70, M: 28.1, S: 0.148 },// Age 9
    { ageMonths: 120, L: -0.77, M: 31.2, S: 0.158 },// Age 10
    { ageMonths: 132, L: -0.85, M: 34.9, S: 0.165 },// Age 11
    { ageMonths: 144, L: -0.94, M: 39.2, S: 0.172 },// Age 12
    { ageMonths: 156, L: -1.02, M: 44.4, S: 0.176 },// Age 13
    { ageMonths: 168, L: -1.09, M: 50.8, S: 0.178 },// Age 14
    { ageMonths: 180, L: -1.15, M: 56.5, S: 0.179 },// Age 15
    { ageMonths: 192, L: -1.15, M: 61.3, S: 0.175 },// Age 16
    { ageMonths: 204, L: -1.15, M: 65.0, S: 0.170 },// Age 17
    { ageMonths: 216, L: -1.15, M: 67.8, S: 0.162 },// Age 18
    { ageMonths: 228, L: -1.15, M: 70.0, S: 0.156 },// Age 19
    { ageMonths: 240, L: -1.15, M: 72.0, S: 0.150 },// Age 20
  ],
  [Sex.Female]: [
    { ageMonths: 24, L: -0.26, M: 12.1, S: 0.12 },
    { ageMonths: 30, L: -0.32, M: 13.1, S: 0.12 },
    { ageMonths: 36, L: -0.38, M: 14.1, S: 0.12 },
    { ageMonths: 42, L: -0.44, M: 15.2, S: 0.12 },
    { ageMonths: 48, L: -0.49, M: 16.2, S: 0.12 },
    { ageMonths: 54, L: -0.55, M: 17.4, S: 0.13 },
    { ageMonths: 60, L: -0.60, M: 18.6, S: 0.13 },  // Age 5
    { ageMonths: 72, L: -0.67, M: 20.8, S: 0.14 },  // Age 6
    { ageMonths: 84, L: -0.72, M: 23.5, S: 0.15 },  // Age 7
    { ageMonths: 96, L: -0.76, M: 26.8, S: 0.16 },  // Age 8
    { ageMonths: 108, L: -0.79, M: 30.6, S: 0.17 }, // Age 9
    { ageMonths: 120, L: -0.82, M: 34.9, S: 0.18 }, // Age 10
    { ageMonths: 132, L: -0.86, M: 39.9, S: 0.19 }, // Age 11
    { ageMonths: 144, L: -0.91, M: 45.0, S: 0.19 }, // Age 12
    { ageMonths: 156, L: -0.98, M: 49.3, S: 0.18 }, // Age 13
    { ageMonths: 168, L: -1.06, M: 52.2, S: 0.17 }, // Age 14
    { ageMonths: 180, L: -1.20, M: 54.0, S: 0.20 }, // Age 15 (Note: high volatility in teen female weight S)
    { ageMonths: 192, L: -1.20, M: 55.5, S: 0.20 }, // Age 16
    { ageMonths: 204, L: -1.20, M: 56.5, S: 0.20 }, // Age 17
    { ageMonths: 216, L: -1.20, M: 57.5, S: 0.20 }, // Age 18
    { ageMonths: 228, L: -1.20, M: 58.0, S: 0.20 }, // Age 19
    { ageMonths: 240, L: -1.20, M: 58.5, S: 0.20 }, // Age 20
  ]
};

export const CDC_HEIGHT_AGE: GrowthDataSet = {
  [Sex.Male]: [
    { ageMonths: 24, L: 1, M: 86.4, S: 0.04 },
    { ageMonths: 36, L: 1, M: 95.6, S: 0.04 },
    { ageMonths: 48, L: 1, M: 102.9, S: 0.04 },
    { ageMonths: 60, L: 1, M: 109.2, S: 0.043 },
    { ageMonths: 72, L: 1, M: 115.5, S: 0.043 },
    { ageMonths: 84, L: 1, M: 121.9, S: 0.043 },
    { ageMonths: 96, L: 1, M: 128.0, S: 0.043 },
    { ageMonths: 108, L: 1, M: 133.6, S: 0.044 },
    { ageMonths: 120, L: 1, M: 138.4, S: 0.045 },
    { ageMonths: 132, L: 1, M: 143.5, S: 0.045 },
    { ageMonths: 144, L: 1, M: 149.0, S: 0.045 },
    { ageMonths: 156, L: 1, M: 156.0, S: 0.042 },
    { ageMonths: 168, L: 1, M: 163.0, S: 0.040 },
    { ageMonths: 180, L: 1, M: 170.1, S: 0.040 },
    { ageMonths: 192, L: 1, M: 173.5, S: 0.040 },
    { ageMonths: 204, L: 1, M: 175.2, S: 0.040 },
    { ageMonths: 216, L: 1, M: 176.0, S: 0.040 },
    { ageMonths: 228, L: 1, M: 176.5, S: 0.040 },
    { ageMonths: 240, L: 1, M: 177.0, S: 0.040 },
  ],
  [Sex.Female]: [
    { ageMonths: 24, L: 1, M: 85.5, S: 0.04 },
    { ageMonths: 36, L: 1, M: 94.5, S: 0.04 },
    { ageMonths: 48, L: 1, M: 102.1, S: 0.04 },
    { ageMonths: 60, L: 1, M: 108.6, S: 0.044 },
    { ageMonths: 72, L: 1, M: 114.6, S: 0.044 },
    { ageMonths: 84, L: 1, M: 120.6, S: 0.044 },
    { ageMonths: 96, L: 1, M: 126.5, S: 0.044 },
    { ageMonths: 108, L: 1, M: 132.5, S: 0.045 },
    { ageMonths: 120, L: 1, M: 138.2, S: 0.047 },
    { ageMonths: 132, L: 1, M: 144.0, S: 0.047 },
    { ageMonths: 144, L: 1, M: 150.0, S: 0.045 },
    { ageMonths: 156, L: 1, M: 155.0, S: 0.040 },
    { ageMonths: 168, L: 1, M: 159.0, S: 0.039 },
    { ageMonths: 180, L: 1, M: 162.5, S: 0.038 },
    { ageMonths: 192, L: 1, M: 163.0, S: 0.038 },
    { ageMonths: 204, L: 1, M: 163.1, S: 0.038 },
    { ageMonths: 216, L: 1, M: 163.2, S: 0.038 },
    { ageMonths: 228, L: 1, M: 163.2, S: 0.038 },
    { ageMonths: 240, L: 1, M: 163.2, S: 0.038 },
  ]
};

export const CDC_BMI_AGE: GrowthDataSet = {
    [Sex.Male]: [
        { ageMonths: 24, L: -2.5, M: 16.4, S: 0.08},
        { ageMonths: 36, L: -2.2, M: 15.9, S: 0.08},
        { ageMonths: 48, L: -2.0, M: 15.5, S: 0.08},
        { ageMonths: 60, L: -1.9, M: 15.3, S: 0.085 },
        { ageMonths: 84, L: -2.1, M: 15.5, S: 0.095 },
        { ageMonths: 120, L: -2.4, M: 16.5, S: 0.14 },
        { ageMonths: 156, L: -2.3, M: 19.0, S: 0.15 },
        { ageMonths: 192, L: -2.0, M: 22.5, S: 0.16 },
        { ageMonths: 240, L: -1.8, M: 26.5, S: 0.16 },
    ],
    [Sex.Female]: [
        { ageMonths: 24, L: -2.2, M: 16.2, S: 0.08},
        { ageMonths: 36, L: -2.0, M: 15.8, S: 0.08},
        { ageMonths: 48, L: -1.8, M: 15.4, S: 0.08},
        { ageMonths: 60, L: -1.6, M: 15.2, S: 0.09 },
        { ageMonths: 84, L: -1.6, M: 15.5, S: 0.11 },
        { ageMonths: 120, L: -1.9, M: 17.0, S: 0.15 },
        { ageMonths: 156, L: -1.8, M: 19.5, S: 0.16 },
        { ageMonths: 192, L: -1.5, M: 22.0, S: 0.17 },
        { ageMonths: 240, L: -1.4, M: 24.0, S: 0.18 },
    ]
}

// Placeholder for Weight-for-Length (WHO 0-2y) and Weight-for-Height (WHO 2-5y)
// Simplified for demo: Maps Length (cm) -> LMS.
export const WHO_WEIGHT_LENGTH: GrowthDataSet = {
    [Sex.Male]: [
        { ageMonths: 45, L: -0.35, M: 2.4, S: 0.08 }, // 45 cm
        { ageMonths: 60, L: -0.35, M: 6.0, S: 0.09 }, 
        { ageMonths: 80, L: -0.35, M: 10.0, S: 0.09 },
        { ageMonths: 100, L: -0.35, M: 15.0, S: 0.09 },
        { ageMonths: 120, L: -0.35, M: 22.0, S: 0.09 } // 120cm
    ],
    [Sex.Female]: [
        { ageMonths: 45, L: -0.38, M: 2.3, S: 0.08 },
        { ageMonths: 60, L: -0.38, M: 5.8, S: 0.09 },
        { ageMonths: 80, L: -0.38, M: 9.8, S: 0.09 },
        { ageMonths: 100, L: -0.38, M: 14.5, S: 0.09 },
        { ageMonths: 120, L: -0.38, M: 21.5, S: 0.09 }
    ]
}