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
    add(score(
      'BMI-for-Age',
      isWHO ? GrowthIndicator.whoBmiForAge : GrowthIndicator.cdcBmiForAge,
      ageX,
      bmi,
      isWHO ? (z, _) => interpretWeightForLength(z) : (_, p) => interpretBMIForAgeCDC(p),
      implausibleLow: -implausibleWeightForHeightLimit,
      implausibleHigh: implausibleWeightForHeightLimit,
      whoRestricted: isWHO,
    ));
  }

  return results;
}
