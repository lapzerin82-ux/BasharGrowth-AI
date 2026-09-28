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

class GrowthResultData {
  final String measure;
  final double value;
  final double? zScore;
  final double? percentile;
  final String classification;
  final String standard;

  GrowthResultData({
    required this.measure,
    required this.value,
    this.zScore,
    this.percentile,
    required this.classification,
    required this.standard,
  });
}

/// Whole days between two calendar dates, ignoring time of day and DST shifts.
int calculateAgeDays(DateTime dob, DateTime measurementDate) {
  final start = DateTime.utc(dob.year, dob.month, dob.day);
  final end = DateTime.utc(measurementDate.year, measurementDate.month, measurementDate.day);
  return end.difference(start).inDays;
}

/// Calendar age as "Xy Ym Zd": completed months since [dob], then days since
/// the last monthly anniversary (clamped to the end of short months).
String formatAge(DateTime dob, DateTime date) {
  DateTime anniversary(int months) {
    final year = dob.year + (dob.month - 1 + months) ~/ 12;
    final month = (dob.month - 1 + months) % 12 + 1;
    final lastDay = DateTime.utc(year, month + 1, 0).day;
    return DateTime.utc(year, month, dob.day < lastDay ? dob.day : lastDay);
  }

  final end = DateTime.utc(date.year, date.month, date.day);
  var months = (date.year - dob.year) * 12 + date.month - dob.month;
  while (months > 0 && anniversary(months).isAfter(end)) {
    months -= 1;
  }
  final days = end.difference(anniversary(months)).inDays;
  return '${months ~/ 12}y ${months % 12}m ${days}d';
}

/// Gestational age in weeks without a trailing ".0".
String formatWeeks(double weeks) => weeks.toStringAsFixed(weeks == weeks.roundToDouble() ? 0 : 1);

/// Age in days as "Xm Yd", using 30.4375-day months.
String formatAgeDays(int ageDays) {
  final months = (ageDays / 30.4375).floor();
  final days = (ageDays - months * 30.4375).round();
  return '${months}m ${days}d';
}

/// Term gestation in weeks used for age correction.
const int termGestationWeeks = 40;

/// Prematurity correction applies below 37 weeks' gestation, until a
/// chronological age of 24 months (730 days).
const int pretermBelowWeeks = 37;
const int correctAgeUntilDays = 730;

/// Age in days to plot against the growth standard. For infants born before
/// 37 weeks, subtracts the weeks born early ((40 - GA) x 7 days) until 24
/// months of chronological age. May be negative before term-equivalent age.
int correctedAgeDays(int chronologicalAgeDays, double? gestationalAgeWeeks) {
  if (gestationalAgeWeeks == null ||
      gestationalAgeWeeks >= pretermBelowWeeks ||
      chronologicalAgeDays > correctAgeUntilDays) {
    return chronologicalAgeDays;
  }
  return chronologicalAgeDays - ((termGestationWeeks - gestationalAgeWeeks) * 7).round();
}

/// Calculates accurate age in decimal months
double calculateAgeMonths(DateTime dob, DateTime measurementDate) {
  return calculateAgeDays(dob, measurementDate) / 30.4375; // Average days per month
}

/// Calculates Z-score using LMS method
double calculateZScore(double value, LMSParameters lms) {
  if (lms.l == 0) {
    return log(value / lms.m) / lms.s;
  } else {
    return (pow(value / lms.m, lms.l) - 1) / (lms.l * lms.s);
  }
}

/// Measurement value at a given Z-score (inverse LMS).
double valueAtZScore(double z, LMSParameters lms) {
  if (lms.l == 0) return lms.m * exp(lms.s * z);
  return lms.m * pow(1 + lms.l * lms.s * z, 1 / lms.l);
}

/// WHO restricted Z-score for weight-based indicators (weight-for-age,
/// weight-for-length/height, BMI-for-age). Beyond +/-3 SD the LMS curve is
/// replaced by a linear extension using the distance between the 2 and 3 SD
/// curves (WHO Child Growth Standards, 2006, ch. 7).
double calculateWhoAdjustedZScore(double value, LMSParameters lms) {
  final z = calculateZScore(value, lms);
  if (z > 3) {
    final sd3 = valueAtZScore(3, lms);
    final sd23 = sd3 - valueAtZScore(2, lms);
    return 3 + (value - sd3) / sd23;
  }
  if (z < -3) {
    final sd3 = valueAtZScore(-3, lms);
    final sd23 = valueAtZScore(-2, lms) - sd3;
    return -3 + (value - sd3) / sd23;
  }
  return z;
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

/// Interprets Length/Height-for-Age Z-score. WHO (< 5y) uses stunting
/// terminology; for CDC ages below -2 SD is reported as short stature.
String interpretLengthHeightForAge(double z, {bool isWHO = true}) {
  if (isWHO) {
    if (z < -3) return 'Severe Stunting';
    if (z < -2) return 'Stunted';
  } else if (z < -2) {
    return 'Short Stature';
  }
  if (z > 2) return 'Tall Stature';
  return 'Normal';
}

/// Interprets Weight-for-Length/Height or BMI-for-Age Z-score (WHO < 5y)
String interpretWeightForLength(double z) {
  if (z < -3) return 'Severe Wasting';
  if (z < -2) return 'Wasting';
  if (z > 3) return 'Obese';
  if (z > 2) return 'Overweight';
  if (z > 1) return 'Possible Risk of Overweight';
  return 'Normal';
}

/// Interprets BMI-for-Age Percentile (CDC >= 2y)
String interpretBMIForAgeCDC(double percentile) {
  if (percentile < 5) return 'Underweight';
  if (percentile < 85) return 'Healthy weight';
  if (percentile < 95) return 'Overweight';
  return 'Obese';
}
