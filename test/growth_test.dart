import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:pediatric_growth_monitor/growth_assessment.dart';
import 'package:pediatric_growth_monitor/growth_calculations.dart';
import 'package:pediatric_growth_monitor/growth_chart.dart';
import 'package:pediatric_growth_monitor/growth_standards.dart';

GrowthReferences loadReferences() {
  return GrowthReferences.fromCsv({
    for (final indicator in GrowthIndicator.values)
      indicator: File('$growthAssetDir/${indicator.fileName}').readAsStringSync(),
  });
}

void expectLms(LMSParameters? lms, double l, double m, double s) {
  expect(lms, isNotNull);
  expect(lms!.l, closeTo(l, 1e-9));
  expect(lms.m, closeTo(m, 1e-9));
  expect(lms.s, closeTo(s, 1e-9));
}

GrowthResultData resultFor(List<GrowthResultData> results, String measure) {
  return results.singleWhere((r) => r.measure == measure);
}

void main() {
  final refs = loadReferences();

  group('reference tables', () {
    test('cover the expected ranges for both sexes', () {
      for (final sex in ['M', 'F']) {
        for (final indicator in [
          GrowthIndicator.whoWeightForAge,
          GrowthIndicator.whoLengthHeightForAge,
          GrowthIndicator.whoBmiForAge,
        ]) {
          expect(refs.table(indicator, sex).minX, 0);
          expect(refs.table(indicator, sex).maxX, 1826);
        }
        expect(refs.table(GrowthIndicator.whoWeightForLength, sex).minX, 45);
        expect(refs.table(GrowthIndicator.whoWeightForLength, sex).maxX, 110);
        expect(refs.table(GrowthIndicator.whoWeightForHeight, sex).minX, 65);
        expect(refs.table(GrowthIndicator.whoWeightForHeight, sex).maxX, 120);
        expect(refs.table(GrowthIndicator.cdcWeightForAge, sex).minX, 24);
        expect(refs.table(GrowthIndicator.cdcWeightForAge, sex).maxX, 240);
        expect(refs.table(GrowthIndicator.cdcStatureForAge, sex).maxX, 240);
        expect(refs.table(GrowthIndicator.cdcBmiForAge, sex).maxX, 240.5);
      }
    });

    test('match published WHO 2006 values', () {
      // Weight-for-age at birth.
      expectLms(refs.table(GrowthIndicator.whoWeightForAge, 'M').lookup(0), 0.3487, 3.3464, 0.14602);
      expect(refs.table(GrowthIndicator.whoWeightForAge, 'F').lookup(0)!.m, closeTo(3.2322, 1e-9));
      // Length-for-age at birth.
      expect(refs.table(GrowthIndicator.whoLengthHeightForAge, 'M').lookup(0)!.m, closeTo(49.8842, 1e-9));
    });

    test('match published CDC 2000 values', () {
      expectLms(refs.table(GrowthIndicator.cdcStatureForAge, 'M').lookup(24), 0.941523967, 86.45220101, 0.040321528);
      expectLms(refs.table(GrowthIndicator.cdcBmiForAge, 'M').lookup(24), -2.01118107, 16.57502768, 0.080592465);
      expectLms(refs.table(GrowthIndicator.cdcWeightForAge, 'M').lookup(24.5), -0.216501213, 12.74154396, 0.108166006);
    });

    test('interpolate linearly between rows and never extrapolate', () {
      final table = refs.table(GrowthIndicator.cdcWeightForAge, 'M');
      final a = table.lookup(24)!;
      final b = table.lookup(24.5)!;
      final mid = table.lookup(24.25)!;
      expect(mid.m, closeTo((a.m + b.m) / 2, 1e-9));
      expect(mid.l, closeTo((a.l + b.l) / 2, 1e-9));
      expect(table.lookup(23.9), isNull);
      expect(table.lookup(240.1), isNull);
    });
  });

  group('LMS Z-scores', () {
    test('the median scores 0 and inverse LMS round-trips', () {
      final lms = refs.table(GrowthIndicator.cdcBmiForAge, 'F').lookup(120.5)!;
      expect(calculateZScore(lms.m, lms), closeTo(0, 1e-12));
      for (final z in [-2.5, -1.0, 1.0, 2.5]) {
        expect(calculateZScore(valueAtZScore(z, lms), lms), closeTo(z, 1e-9));
      }
    });

    test('percentile from Z-score', () {
      expect(calculatePercentile(0), closeTo(50, 1e-6));
      expect(calculatePercentile(-2), closeTo(2.275, 1e-3));
      expect(calculatePercentile(1.645), closeTo(95, 1e-2));
    });

    test('WHO restricted method is linear beyond +/-3 SD', () {
      final lms = refs.table(GrowthIndicator.whoWeightForAge, 'M').lookup(0)!;
      final sd2 = valueAtZScore(2, lms);
      final sd3 = valueAtZScore(3, lms);
      expect(calculateWhoAdjustedZScore(sd3 + 0.5 * (sd3 - sd2), lms), closeTo(3.5, 1e-9));

      final sdNeg2 = valueAtZScore(-2, lms);
      final sdNeg3 = valueAtZScore(-3, lms);
      expect(calculateWhoAdjustedZScore(sdNeg3 - (sdNeg2 - sdNeg3), lms), closeTo(-4, 1e-9));

      // Unchanged within +/-3 SD.
      expect(calculateWhoAdjustedZScore(sd2, lms), closeTo(2, 1e-9));
    });
  });

  group('assessGrowth', () {
    test('12-month girl at the WHO median scores ~0 (regression)', () {
      final results = assessGrowth(refs: refs, sex: 'F', ageDays: 365, weightKg: 8.9462);
      expect(resultFor(results, 'Weight-for-Age').zScore, closeTo(0, 1e-9));
      expect(resultFor(results, 'Weight-for-Age').standard, whoStandardName);
    });

    test('uses WHO below 60 months with length/height switch at 731 days', () {
      final infant = assessGrowth(refs: refs, sex: 'M', ageDays: 700, weightKg: 11.5, heightCm: 85);
      expect(infant.map((r) => r.measure),
          ['Weight-for-Age', 'Length-for-Age', 'Weight-for-Length', 'BMI-for-Age']);

      final toddler = assessGrowth(refs: refs, sex: 'M', ageDays: 731, weightKg: 12.1645, heightCm: 87);
      expect(toddler.map((r) => r.measure),
          ['Weight-for-Age', 'Height-for-Age', 'Weight-for-Height', 'BMI-for-Age']);
      expect(resultFor(toddler, 'Weight-for-Height').zScore, closeTo(0, 1e-9));
    });

    test('uses CDC from 60 months with BMI percentile classification', () {
      // 10 years (120.5 months = 3668 days) boy at the CDC weight median.
      final results = assessGrowth(refs: refs, sex: 'M', ageDays: 3668, weightKg: 32.08799062, heightCm: 138);
      expect(results.map((r) => r.measure), ['Weight-for-Age', 'Height-for-Age', 'BMI-for-Age']);
      expect(results.every((r) => r.standard == cdcStandardName), isTrue);
      expect(resultFor(results, 'Weight-for-Age').zScore, closeTo(0, 1e-3));

      final lms = refs.table(GrowthIndicator.cdcBmiForAge, 'F').lookup(3668 / 30.4375)!;
      final heightM = 1.40;
      final obeseBmi = valueAtZScore(1.8, lms); // ~96th percentile
      final girl = assessGrowth(
          refs: refs, sex: 'F', ageDays: 3668, weightKg: obeseBmi * heightM * heightM, heightCm: heightM * 100);
      expect(resultFor(girl, 'BMI-for-Age').classification, startsWith('Obese'));
    });

    test('returns nothing outside the reference range', () {
      expect(assessGrowth(refs: refs, sex: 'F', ageDays: -1, weightKg: 3), isEmpty);
      expect(assessGrowth(refs: refs, sex: 'F', ageDays: 7400, weightKg: 60, heightCm: 165), isEmpty);
      // Length below the WHO weight-for-length table (45 cm).
      final preterm = assessGrowth(refs: refs, sex: 'M', ageDays: 0, weightKg: 1.5, heightCm: 40);
      expect(preterm.any((r) => r.measure == 'Weight-for-Length'), isFalse);
    });
  });

  group('interpretation', () {
    test('WHO weight-for-length/BMI cut-offs', () {
      expect(interpretWeightForLength(-3.1), 'Severe Wasting');
      expect(interpretWeightForLength(-2.1), 'Wasting');
      expect(interpretWeightForLength(0), 'Normal');
      expect(interpretWeightForLength(1.5), 'Possible Risk of Overweight');
      expect(interpretWeightForLength(2.5), 'Overweight');
      expect(interpretWeightForLength(3.1), 'Obese');
    });

    test('height-for-age wording differs by standard', () {
      expect(interpretLengthHeightForAge(-2.5), 'Stunted');
      expect(interpretLengthHeightForAge(-2.5, isWHO: false), 'Short Stature');
    });
  });

  group('prematurity correction', () {
    test('subtracts weeks born early below 37 weeks until 24 months', () {
      expect(correctedAgeDays(100, 32), 100 - 56);
      expect(correctedAgeDays(100, 36.5), 100 - 25);
      expect(correctedAgeDays(730, 28), 730 - 84);
      expect(correctedAgeDays(731, 28), 731);
    });

    test('no correction at 37 weeks or more, or when unknown', () {
      expect(correctedAgeDays(100, 37), 100);
      expect(correctedAgeDays(100, null), 100);
    });

    test('negative before term-equivalent age', () {
      expect(correctedAgeDays(20, 30), lessThan(0));
    });
  });

  group('length/height position', () {
    // WHO boys weight-for-length at 700 days vs height at 731 days.
    test('standing measurement under 2y adds 0.7 cm', () {
      final lying = assessGrowth(refs: refs, sex: 'M', ageDays: 700, heightCm: 85.7);
      final standing = assessGrowth(refs: refs, sex: 'M', ageDays: 700, heightCm: 85.0, measuredStanding: true);
      expect(resultFor(standing, 'Length-for-Age').zScore, closeTo(resultFor(lying, 'Length-for-Age').zScore!, 1e-9));
    });

    test('lying measurement from 2y subtracts 0.7 cm', () {
      final standing = assessGrowth(refs: refs, sex: 'F', ageDays: 900, heightCm: 88.0);
      final lying = assessGrowth(refs: refs, sex: 'F', ageDays: 900, heightCm: 88.7, measuredStanding: false);
      expect(resultFor(lying, 'Height-for-Age').zScore, closeTo(resultFor(standing, 'Height-for-Age').zScore!, 1e-9));
    });

    test('no adjustment when position matches the age, or for CDC', () {
      final auto = assessGrowth(refs: refs, sex: 'F', ageDays: 900, heightCm: 88.0);
      final explicit = assessGrowth(refs: refs, sex: 'F', ageDays: 900, heightCm: 88.0, measuredStanding: true);
      expect(resultFor(explicit, 'Height-for-Age').zScore, resultFor(auto, 'Height-for-Age').zScore);

      final cdc = assessGrowth(refs: refs, sex: 'F', ageDays: 3000, heightCm: 130, measuredStanding: false);
      final cdcAuto = assessGrowth(refs: refs, sex: 'F', ageDays: 3000, heightCm: 130);
      expect(resultFor(cdc, 'Height-for-Age').zScore, resultFor(cdcAuto, 'Height-for-Age').zScore);
    });
  });

  test('flags biologically implausible Z-scores (WHO limits)', () {
    final results = assessGrowth(refs: refs, sex: 'M', ageDays: 365, weightKg: 30, heightCm: 40);
    expect(resultFor(results, 'Weight-for-Age').classification, implausibleClassification);
    expect(resultFor(results, 'Length-for-Age').classification, implausibleClassification);

    final plausible = assessGrowth(refs: refs, sex: 'M', ageDays: 365, weightKg: 7.0);
    expect(resultFor(plausible, 'Weight-for-Age').classification, isNot(implausibleClassification));
  });

  group('CDC 2022 extended BMI', () {
    test('sigma matches the published quadratic', () {
      expect(cdcExtendedBmiSigma('M', 2), closeTo(1.3756, 1e-4));
      expect(cdcExtendedBmiSigma('F', 2), closeTo(1.5714, 1e-4));
    });

    test('inverse normal CDF', () {
      expect(inverseNormalCdf(0.5), closeTo(0, 1e-9));
      expect(inverseNormalCdf(0.95), closeTo(z95, 1e-8));
      expect(inverseNormalCdf(0.001), closeTo(-3.090232306, 1e-8));
    });

    test('BMI at 130% of P95 in a 10-year-old boy', () {
      // 120.5 months = 3668 days. P95 22.1541, sigma 4.6729 (independently computed).
      const p95 = 22.154092419730485;
      final bmi = p95 * 1.3;
      const heightM = 1.40;
      final results = assessGrowth(refs: refs, sex: 'M', ageDays: 3668, weightKg: bmi * heightM * heightM, heightCm: 140);
      final r = resultFor(results, 'BMI-for-Age');
      expect(r.percentile, closeTo(99.22531402145383, 1e-3));
      expect(r.zScore, closeTo(inverseNormalCdf(0.9922531402145383), 1e-3));
      expect(r.classification, 'Obese Class 2 (Severe)');
      expect(r.note, contains('130% of the 95th percentile'));
      expect(r.standard, contains('extended BMI'));
    });

    test('below P95 keeps the LMS percentile', () {
      final results = assessGrowth(refs: refs, sex: 'M', ageDays: 3668, weightKg: 17 * 1.96, heightCm: 140);
      final r = resultFor(results, 'BMI-for-Age');
      expect(r.note, isNull);
      expect(r.classification, 'Healthy weight');
    });

    test('obesity class thresholds', () {
      expect(interpretObesityClass(30, 110), 'Obese Class 1');
      expect(interpretObesityClass(30, 120), 'Obese Class 2 (Severe)');
      expect(interpretObesityClass(35, 110), 'Obese Class 2 (Severe)');
      expect(interpretObesityClass(30, 140), 'Obese Class 3 (Severe)');
      expect(interpretObesityClass(40, 110), 'Obese Class 3 (Severe)');
    });
  });

  group('growth charts', () {
    test('WHO chart: Z curves in months, patient at scored position', () {
      final r = resultFor(assessGrowth(refs: refs, sex: 'F', ageDays: 365, weightKg: 9.5), 'Weight-for-Age');
      final chart = buildGrowthChart(refs, 'F', r)!;
      expect(chart.curves.map((c) => c.label), ['Z -3', 'Z -2', 'Z 0', 'Z +2', 'Z +3']);
      expect(chart.minX, 0);
      expect(chart.maxX, closeTo(60, 0.01));
      expect(chart.patient.x, closeTo(365 / 30.4375, 1e-9));
      expect(chart.patient.y, 9.5);
      final median = chart.curves.singleWhere((c) => c.label == 'Z 0');
      final at364 = median.points.firstWhere((p) => (p.x - 364 / 30.4375).abs() < 1e-9);
      expect(at364.y, closeTo(refs.table(GrowthIndicator.whoWeightForAge, 'F').lookup(364)!.m, 1e-9));
    });

    test('CDC chart: percentile curves in years', () {
      final r = resultFor(
          assessGrowth(refs: refs, sex: 'M', ageDays: 3668, weightKg: 32, heightCm: 138), 'Height-for-Age');
      final chart = buildGrowthChart(refs, 'M', r)!;
      expect(chart.curves.map((c) => c.label), ['P5', 'P10', 'P25', 'P50', 'P75', 'P90', 'P95']);
      expect(chart.minX, 2);
      expect(chart.xLabel, 'Age (years)');
      final p50 = chart.curves.singleWhere((c) => c.label == 'P50');
      expect(p50.points.first.y, closeTo(86.45220101, 1e-6));
    });

    test('weight-for-length chart is indexed by length', () {
      final r = resultFor(
          assessGrowth(refs: refs, sex: 'M', ageDays: 300, weightKg: 9, heightCm: 72), 'Weight-for-Length');
      final chart = buildGrowthChart(refs, 'M', r)!;
      expect(chart.minX, 45);
      expect(chart.maxX, 110);
      expect(chart.patient.x, 72);
    });
  });

  group('bone age', () {
    test('classifies only with an atlas SD, at +/-2 SD', () {
      expect(analyzeBoneAge(120, 100)!['status'], 'Not classified');
      expect(analyzeBoneAge(120, 100)!['diff'], -20);
      expect(analyzeBoneAge(120, 100, sdMonths: 10.8)!['status'], 'Normal');
      expect(analyzeBoneAge(120, 96, sdMonths: 10.8)!['status'], 'Delayed');
      expect(analyzeBoneAge(120, 144, sdMonths: 10.8)!['status'], 'Advanced');
      expect(analyzeBoneAge(120, 144, sdMonths: 10.8)!['sds'], closeTo(24 / 10.8, 1e-12));
      expect(analyzeBoneAge(120, null), isNull);
    });
  });

  test('calendar age formatting', () {
    expect(formatAge(DateTime(2020, 1, 31), DateTime(2021, 3, 1)), '1y 1m 1d');
    expect(formatAge(DateTime(2020, 5, 15), DateTime(2020, 5, 15)), '0y 0m 0d');
    expect(formatAge(DateTime(2019, 12, 20), DateTime(2020, 2, 10)), '0y 1m 21d');
  });

  test('age in days ignores time of day', () {
    expect(calculateAgeDays(DateTime(2024, 3, 1, 23, 30), DateTime(2024, 3, 31, 0, 15)), 30);
  });
}
