import 'dart:math';

class LMSParameters {
  final double l;
  final double m;
  final double s;

  LMSParameters({required this.l, required this.m, required this.s});
}

class GrowthResult {
  final double zScore;
  final double percentile;
  final String classification;

  GrowthResult({
    required this.zScore,
    required this.percentile,
    required this.classification,
  });
}

/// Calculates accurate age in decimal months
double calculateAgeMonths(DateTime dob, DateTime measurementDate) {
  final difference = measurementDate.difference(dob);
  return difference.inDays / 30.4375; // Average days per month
}

/// Calculates Z-score using LMS method
double calculateZScore(double value, LMSParameters lms) {
  if (lms.l == 0) {
    return log(value / lms.m) / lms.s;
  } else {
    return (pow(value / lms.m, lms.l) - 1) / (lms.l * lms.s);
  }
}

/// Approximation of standard normal CDF to calculate percentile
double calculatePercentile(double z) {
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  final sign = z < 0 ? -1 : 1;
  final x = z.abs() / sqrt(2.0);
  final t = 1.0 / (1.0 + p * x);
  final erf = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * exp(-x * x));

  return 0.5 * (1.0 + sign * erf) * 100;
}

/// Calculates BMI
double calculateBMI(double weightKg, double heightCm) {
  if (heightCm <= 0) return 0;
  return weightKg / pow(heightCm / 100, 2);
}

/// Calculates Mid-Parental Height
Map<String, double> calculateMidParentalHeight(
  double motherCm,
  double fatherCm,
  String sex,
) {
  final sum = motherCm + fatherCm;
  final mph = sex == 'M' ? (sum + 13) / 2 : (sum - 13) / 2;
  return {
    'mph': mph,
    'rangeLow': mph - 8.5,
    'rangeHigh': mph + 8.5,
  };
}

/// Analyzes bone age discrepancy
Map<String, dynamic>? analyzeBoneAge(
  double chronologicalAgeMonths,
  double? boneAgeMonths,
) {
  if (boneAgeMonths == null || chronologicalAgeMonths == 0) return null;
  
  final diff = boneAgeMonths - chronologicalAgeMonths;
  final threshold = chronologicalAgeMonths * 0.20;

  String status = 'Normal';
  if (diff.abs() > threshold) {
    status = diff > 0 ? 'Advanced' : 'Delayed';
  }
  
  return {'status': status, 'diff': diff};
}

/// Interprets Weight-for-Age Z-score
String interpretWeightForAge(double z) {
  if (z < -3) return 'Severe Underweight';
  if (z < -2) return 'Underweight';
  return 'Normal';
}

/// Interprets Length/Height-for-Age Z-score
String interpretLengthHeightForAge(double z) {
  if (z < -3) return 'Severe Stunting';
  if (z < -2) return 'Stunted';
  if (z > 2) return 'Tall Stature';
  return 'Normal';
}

/// Interprets Weight-for-Length Z-score (WHO < 5y)
String interpretWeightForLength(double z) {
  if (z < -3) return 'Severe Wasting';
  if (z < -2) return 'Wasting';
  if (z > 3) return 'Severe Overweight';
  if (z > 2) return 'Overweight';
  return 'Normal';
}

/// Interprets BMI-for-Age Percentile (CDC >= 2y)
String interpretBMIForAgeCDC(double percentile) {
  if (percentile < 5) return 'Underweight';
  if (percentile < 85) return 'Healthy weight';
  if (percentile < 95) return 'Overweight';
  return 'Obese';
}
