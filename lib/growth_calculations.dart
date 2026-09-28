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

/// Inverse of the standard normal CDF (Acklam's rational approximation,
/// relative error < 1.2e-9). [p] is a probability in (0, 1).
double inverseNormalCdf(double p) {
  if (p <= 0) return double.negativeInfinity;
  if (p >= 1) return double.infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  if (p < pLow) {
    final q = sqrt(-2 * log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pLow) {
    final q = sqrt(-2 * log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  final q = p - 0.5;
  final r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/// Z-score of the 95th percentile.
const double z95 = 1.6448536269514722;

/// Scale parameter (sigma) of the CDC 2022 extended BMI-for-age method, a
/// quadratic in age in years (Hales et al., Vital Health Stat 1(197), 2022).
double cdcExtendedBmiSigma(String sex, double ageYears) {
  return sex == 'M'
      ? 0.3728 + 0.5196 * ageYears - 0.0091 * ageYears * ageYears
      : 0.8334 + 0.3712 * ageYears - 0.0011 * ageYears * ageYears;
}

/// CDC 2022 extended BMI percentile for BMI at or above the 95th percentile
/// ([p95]): 90 + 10 x Phi((BMI - P95) / sigma). Replaces the LMS percentile,
/// which compresses above the 97th.
double cdcExtendedBmiPercentile(double bmi, double p95, double sigma) {
  return 90 + 10 * calculatePercentile((bmi - p95) / sigma) / 100;
}

/// Obesity class from BMI as % of the 95th percentile (AAP 2023):
/// class 2 at >= 120% or BMI >= 35, class 3 at >= 140% or BMI >= 40.
String interpretObesityClass(double bmi, double percentOfP95) {
  if (percentOfP95 >= 140 || bmi >= 40) return 'Obese Class 3 (Severe)';
  if (percentOfP95 >= 120 || bmi >= 35) return 'Obese Class 2 (Severe)';
  return 'Obese Class 1';
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

/// Compares bone age with chronological age. The difference is classified
/// only when [sdMonths] (the atlas SD at this chronological age, e.g. from
/// the Greulich-Pyle tables) is given: beyond +/-2 SD is advanced/delayed.
Map<String, dynamic>? analyzeBoneAge(
  double chronologicalAgeMonths,
  double? boneAgeMonths, {
  double? sdMonths,
}) {
  if (boneAgeMonths == null) return null;

  final diff = boneAgeMonths - chronologicalAgeMonths;
  if (sdMonths == null || sdMonths <= 0) {
    return {'status': 'Not classified', 'diff': diff, 'sds': null};
  }

  final sds = diff / sdMonths;
  final status = sds > 2
      ? 'Advanced'
      : sds < -2
          ? 'Delayed'
          : 'Normal';
  return {'status': status, 'diff': diff, 'sds': sds};
}

/// Interprets Weight-for-Age Z-score
String interpretWeightForAge(double z) {
  if (z < -3) return 'Severe Underweight';
  if (z < -2) return 'Underweight';
  return 'Normal';
}

/// Interprets Length/Height-for-Age Z-score. WHO (< 2y) uses stunting
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

/// Interprets Weight-for-Length/Height or BMI-for-Age Z-score (WHO < 2y)
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
