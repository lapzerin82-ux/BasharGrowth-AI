import 'growth_calculations.dart';
import 'growth_standards.dart';

/// WHO Child Growth Standards are used below 60 months; CDC 2000 references
/// from 60 months to 20 years.
const double whoUpperAgeMonths = 60;

/// WHO measures recumbent length below 731 days and standing height from
/// 731 days (24 completed months).
const int whoStandingHeightFromDays = 731;

/// WHO: standing height is on average 0.7 cm less than recumbent length.
const double lengthHeightDifferenceCm = 0.7;

/// WHO flag limits for biologically implausible Z-scores (WHO Anthro).
const double implausibleWeightForAgeLow = -6;
const double implausibleWeightForAgeHigh = 5;
const double implausibleHeightForAgeLimit = 6;
const double implausibleWeightForHeightLimit = 5;

const String implausibleClassification = 'Implausible - Recheck Measurement';

class GrowthResultData {
  final String measure;
  final double value;
  final double? zScore;
  final double? percentile;
  final String classification;
  final String standard;

  /// Extra clinical detail shown under the results, e.g. % of the 95th percentile.
  final String? note;

  /// Reference table and table index (age in days/months, or length/height
  /// in cm) the value was scored against; used to plot it.
  final GrowthIndicator? indicator;
  final double? referenceX;

  GrowthResultData({
    required this.measure,
    required this.value,
    this.zScore,
    this.percentile,
    required this.classification,
    required this.standard,
    this.note,
    this.indicator,
    this.referenceX,
  });
}

const String whoStandardName = 'WHO Child Growth Standards (2006)';
const String cdcStandardName = 'CDC Growth Reference (2000)';

/// Computes every applicable anthropometric indicator for one visit.
///
/// [sex] is 'M' or 'F'. [ageDays] is the age to plot, already corrected for
/// prematurity. [measuredStanding] says how [heightCm] was measured; when null
/// it is assumed to match the WHO convention for the age (recumbent length
/// below 731 days, standing height from 731 days). Otherwise WHO indicators
/// convert it by 0.7 cm. Indicators whose value falls outside the reference
/// range are omitted rather than extrapolated.
List<GrowthResultData> assessGrowth({
  required GrowthReferences refs,
  required String sex,
  required int ageDays,
  double? weightKg,
  double? heightCm,
  bool? measuredStanding,
}) {
  final results = <GrowthResultData>[];
  if (ageDays < 0) return results;

  final ageMonths = ageDays / 30.4375;
  final isWHO = ageMonths < whoUpperAgeMonths;
  final weight = weightKg != null && weightKg > 0 ? weightKg : null;
  final measured = heightCm != null && heightCm > 0 ? heightCm : null;
  final expectStanding = ageDays >= whoStandingHeightFromDays;
  final height = measured == null || !isWHO || measuredStanding == null || measuredStanding == expectStanding
      ? measured
      : measured + (measuredStanding ? lengthHeightDifferenceCm : -lengthHeightDifferenceCm);

  // WHO tables are indexed by whole days, CDC tables by months.
  final ageX = isWHO ? ageDays.toDouble() : ageMonths;
  final standard = isWHO ? whoStandardName : cdcStandardName;

  GrowthResultData? score(
    String measure,
    GrowthIndicator indicator,
    double x,
    double value,
    String Function(double z, double percentile) interpret, {
    required double implausibleLow,
    required double implausibleHigh,
    bool whoRestricted = false,
  }) {
    final lms = refs.table(indicator, sex).lookup(x);
    if (lms == null) return null;
    final z = whoRestricted ? calculateWhoAdjustedZScore(value, lms) : calculateZScore(value, lms);
    final p = calculatePercentile(z);
    return GrowthResultData(
      measure: measure,
      value: value,
      zScore: z,
      percentile: p,
      classification: z < implausibleLow || z > implausibleHigh ? implausibleClassification : interpret(z, p),
      standard: standard,
      indicator: indicator,
      referenceX: x,
    );
  }

  void add(GrowthResultData? result) {
    if (result != null) results.add(result);
  }

  if (weight != null) {
    add(score(
      'Weight-for-Age',
      isWHO ? GrowthIndicator.whoWeightForAge : GrowthIndicator.cdcWeightForAge,
      ageX,
      weight,
      (z, _) => interpretWeightForAge(z),
      implausibleLow: implausibleWeightForAgeLow,
      implausibleHigh: implausibleWeightForAgeHigh,
      whoRestricted: isWHO,
    ));
  }

  if (height != null) {
    final lengthOrHeight = !isWHO || ageDays >= whoStandingHeightFromDays ? 'Height' : 'Length';
    add(score(
      '$lengthOrHeight-for-Age',
      isWHO ? GrowthIndicator.whoLengthHeightForAge : GrowthIndicator.cdcStatureForAge,
      ageX,
      height,
      (z, _) => interpretLengthHeightForAge(z, isWHO: isWHO),
      implausibleLow: -implausibleHeightForAgeLimit,
      implausibleHigh: implausibleHeightForAgeLimit,
    ));
  }

  if (weight != null && height != null) {
    if (isWHO) {
      final useLength = ageDays < whoStandingHeightFromDays;
      add(score(
        useLength ? 'Weight-for-Length' : 'Weight-for-Height',
        useLength ? GrowthIndicator.whoWeightForLength : GrowthIndicator.whoWeightForHeight,
        height,
        weight,
        (z, _) => interpretWeightForLength(z),
        implausibleLow: -implausibleWeightForHeightLimit,
        implausibleHigh: implausibleWeightForHeightLimit,
        whoRestricted: true,
      ));
    }

    final bmi = calculateBMI(weight, height);
    final bmiResult = score(
      'BMI-for-Age',
      isWHO ? GrowthIndicator.whoBmiForAge : GrowthIndicator.cdcBmiForAge,
      ageX,
      bmi,
      isWHO ? (z, _) => interpretWeightForLength(z) : (_, p) => interpretBMIForAgeCDC(p),
      implausibleLow: -implausibleWeightForHeightLimit,
      implausibleHigh: implausibleWeightForHeightLimit,
      whoRestricted: isWHO,
    );
    add(isWHO || bmiResult == null ? bmiResult : _withCdcExtendedBmi(bmiResult, sex, ageMonths, refs));
  }

  return results;
}

/// Applies the CDC 2022 extended BMI-for-age method when BMI is at or above
/// the 95th percentile: extended percentile and Z-score, % of the 95th
/// percentile, and obesity class.
GrowthResultData _withCdcExtendedBmi(GrowthResultData result, String sex, double ageMonths, GrowthReferences refs) {
  if (result.classification == implausibleClassification) return result;
  final lms = refs.table(GrowthIndicator.cdcBmiForAge, sex).lookup(ageMonths)!;
  final p95 = valueAtZScore(z95, lms);
  final bmi = result.value;
  if (bmi < p95) return result;

  final percentile = cdcExtendedBmiPercentile(bmi, p95, cdcExtendedBmiSigma(sex, ageMonths / 12));
  final percentOfP95 = bmi / p95 * 100;
  return GrowthResultData(
    measure: result.measure,
    value: bmi,
    zScore: inverseNormalCdf(percentile / 100),
    percentile: percentile,
    classification: interpretObesityClass(bmi, percentOfP95),
    standard: '$cdcStandardName, extended BMI (2022)',
    note: 'BMI is ${percentOfP95.toStringAsFixed(0)}% of the 95th percentile (${p95.toStringAsFixed(1)} kg/m²)',
    indicator: result.indicator,
    referenceX: result.referenceX,
  );
}
