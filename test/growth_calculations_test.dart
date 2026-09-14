import 'package:flutter_test/flutter_test.dart';
import 'package:pediatric_growth_monitor/growth_calculations.dart';

void main() {
  group('calculateAgeMonths', () {
    test('returns 0 for identical dates', () {
      final d = DateTime(2024, 1, 1);
      expect(calculateAgeMonths(d, d), 0);
    });

    test('returns ~12 months after one year', () {
      final dob = DateTime(2023, 1, 1);
      final measurement = DateTime(2024, 1, 1);
      expect(calculateAgeMonths(dob, measurement), closeTo(12.0, 0.1));
    });
  });

  group('calculateAgeBreakdown', () {
    test('computes exact years/months/days for a clean anniversary', () {
      final dob = DateTime(2020, 3, 15);
      final asOf = DateTime(2023, 3, 15);
      final result = calculateAgeBreakdown(dob, asOf);
      expect(result.years, 3);
      expect(result.months, 0);
      expect(result.days, 0);
    });

    test('handles a short borrowed month without going negative', () {
      // Jan 31 -> Mar 1: borrowing Feb's 28 days isn't enough to cover the
      // 31-day gap, so this is a genuine calendar edge case (no Feb 31
      // exists). The result is clamped to a whole month with 0 leftover
      // days rather than producing a negative day count.
      final dob = DateTime(2023, 1, 31);
      final asOf = DateTime(2023, 3, 1);
      final result = calculateAgeBreakdown(dob, asOf);
      expect(result.years, 0);
      expect(result.months, 1);
      expect(result.days, 0);
    });

    test('handles leap years without drifting', () {
      final dob = DateTime(2020, 2, 29);
      final asOf = DateTime(2021, 3, 1);
      final result = calculateAgeBreakdown(dob, asOf);
      // 2020 is a 366-day leap year, so Feb 29 2020 -> Mar 1 2021 is
      // exactly one calendar year.
      expect(result.years, 1);
      expect(result.months, 0);
      expect(result.days, 0);
    });

    test('returns zero when asOf precedes dob', () {
      final dob = DateTime(2024, 1, 1);
      final asOf = DateTime(2023, 1, 1);
      final result = calculateAgeBreakdown(dob, asOf);
      expect(result.years, 0);
      expect(result.months, 0);
      expect(result.days, 0);
    });
  });

  group('calculateZScore', () {
    test('uses the log formula when L is 0', () {
      final lms = LMSParameters(l: 0, m: 10, s: 0.1);
      final z = calculateZScore(10, lms);
      expect(z, closeTo(0, 1e-9));
    });

    test('uses the power formula when L is non-zero', () {
      final lms = LMSParameters(l: 1, m: 10, s: 0.1);
      final z = calculateZScore(11, lms);
      // z = ((11/10)^1 - 1) / (1 * 0.1) = (0.1) / 0.1 = 1
      expect(z, closeTo(1.0, 1e-9));
    });

    test('returns 0 when value equals the median regardless of L', () {
      final lms = LMSParameters(l: 0.5, m: 20, s: 0.12);
      expect(calculateZScore(20, lms), closeTo(0, 1e-9));
    });
  });

  group('calculateValueForZ', () {
    test('round-trips with calculateZScore (L != 0)', () {
      final lms = LMSParameters(l: 0.5, m: 12.5, s: 0.11);
      for (final z in [-3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0]) {
        final value = calculateValueForZ(z, lms);
        expect(calculateZScore(value, lms), closeTo(z, 1e-6));
      }
    });

    test('round-trips with calculateZScore (L == 0)', () {
      final lms = LMSParameters(l: 0, m: 20, s: 0.1);
      for (final z in [-2.0, 0.0, 2.0]) {
        final value = calculateValueForZ(z, lms);
        expect(calculateZScore(value, lms), closeTo(z, 1e-9));
      }
    });

    test('returns the median at Z=0', () {
      final lms = LMSParameters(l: 0.3, m: 15, s: 0.12);
      expect(calculateValueForZ(0, lms), closeTo(15.0, 1e-9));
    });
  });

  group('calculatePercentile', () {
    test('z=0 maps to the 50th percentile', () {
      expect(calculatePercentile(0), closeTo(50.0, 0.01));
    });

    test('is symmetric around the mean', () {
      final upper = calculatePercentile(1.5);
      final lower = calculatePercentile(-1.5);
      expect(upper + lower, closeTo(100.0, 0.01));
    });

    test('z=+2 is approximately the 97.7th percentile', () {
      expect(calculatePercentile(2.0), closeTo(97.72, 0.1));
    });

    test('z=-2 is approximately the 2.3rd percentile', () {
      expect(calculatePercentile(-2.0), closeTo(2.28, 0.1));
    });
  });

  group('calculateBMI', () {
    test('computes weight/height^2 in metric units', () {
      // 20 kg at 100 cm -> BMI 20
      expect(calculateBMI(20, 100), closeTo(20.0, 1e-9));
    });

    test('returns 0 for non-positive height', () {
      expect(calculateBMI(20, 0), 0);
      expect(calculateBMI(20, -5), 0);
    });
  });

  group('calculateMidParentalHeight', () {
    test('adds 13cm and halves for boys', () {
      final result = calculateMidParentalHeight(160, 175, 'M');
      expect(result['mph'], closeTo((160 + 175 + 13) / 2, 1e-9));
      expect(result['rangeLow'], closeTo(result['mph']! - 8.5, 1e-9));
      expect(result['rangeHigh'], closeTo(result['mph']! + 8.5, 1e-9));
    });

    test('subtracts 13cm and halves for girls', () {
      final result = calculateMidParentalHeight(160, 175, 'F');
      expect(result['mph'], closeTo((160 + 175 - 13) / 2, 1e-9));
    });
  });

  group('analyzeBoneAge', () {
    test('returns null when bone age is not provided', () {
      expect(analyzeBoneAge(120, null), isNull);
    });

    test('returns null when chronological age is zero', () {
      expect(analyzeBoneAge(0, 10), isNull);
    });

    test('flags Advanced when bone age exceeds the 20% threshold', () {
      final result = analyzeBoneAge(100, 130); // diff=30 > threshold=20
      expect(result!['status'], 'Advanced');
    });

    test('flags Delayed when bone age lags beyond the 20% threshold', () {
      final result = analyzeBoneAge(100, 70); // diff=-30, threshold=20
      expect(result!['status'], 'Delayed');
    });

    test('reports Normal within the 20% threshold', () {
      final result = analyzeBoneAge(100, 110); // diff=10 <= threshold=20
      expect(result!['status'], 'Normal');
    });
  });

  group('interpretation thresholds', () {
    test('interpretWeightForAge boundaries', () {
      expect(interpretWeightForAge(-3.1), 'Severe Underweight');
      expect(interpretWeightForAge(-2.1), 'Underweight');
      expect(interpretWeightForAge(-1.9), 'Normal');
    });

    test('interpretLengthHeightForAge boundaries', () {
      expect(interpretLengthHeightForAge(-3.1), 'Severe Stunting');
      expect(interpretLengthHeightForAge(-2.1), 'Stunted');
      expect(interpretLengthHeightForAge(0), 'Normal');
      expect(interpretLengthHeightForAge(2.1), 'Tall Stature');
    });

    test('interpretWeightForLength boundaries', () {
      expect(interpretWeightForLength(-3.1), 'Severe Wasting');
      expect(interpretWeightForLength(-2.1), 'Wasting');
      expect(interpretWeightForLength(0), 'Normal');
      expect(interpretWeightForLength(2.1), 'Overweight');
      expect(interpretWeightForLength(3.1), 'Severe Overweight');
    });

    test('interpretBMIForAgeCDC boundaries', () {
      expect(interpretBMIForAgeCDC(4), 'Underweight');
      expect(interpretBMIForAgeCDC(50), 'Healthy weight');
      expect(interpretBMIForAgeCDC(90), 'Overweight');
      expect(interpretBMIForAgeCDC(96), 'Obese');
    });
  });

  group('isRedFlag', () {
    test('flags severe classifications', () {
      expect(isRedFlag('Severe Underweight'), isTrue);
      expect(isRedFlag('Obese'), isTrue);
    });

    test('does not flag normal or moderate classifications', () {
      expect(isRedFlag('Normal'), isFalse);
      expect(isRedFlag('Underweight'), isFalse);
      expect(isRedFlag('Reference data unavailable'), isFalse);
    });
  });

  group('validateMeasurement', () {
    test('rejects null values', () {
      expect(validateMeasurement('Weight', null, min: 0, max: 100), isNotNull);
    });

    test('rejects out-of-range values', () {
      expect(validateMeasurement('Weight', 200, min: 0.3, max: 150), isNotNull);
      expect(validateMeasurement('Weight', -1, min: 0.3, max: 150), isNotNull);
    });

    test('accepts in-range values', () {
      expect(validateMeasurement('Weight', 12.5, min: 0.3, max: 150), isNull);
    });
  });
}
