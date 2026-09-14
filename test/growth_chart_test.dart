import 'package:flutter_test/flutter_test.dart';
import 'package:pediatric_growth_monitor/growth_chart.dart';
import 'package:pediatric_growth_monitor/growth_standards.dart';

LMSDataPoint _p(double age) => LMSDataPoint(ageMonths: age, l: 0, m: 10, s: 0.1);

void main() {
  group('hasEnoughResolutionForChart', () {
    test('rejects datasets with fewer than 6 points', () {
      final dataset = [_p(0), _p(12), _p(24), _p(36), _p(48)];
      expect(hasEnoughResolutionForChart(dataset), isFalse);
    });

    test('rejects datasets with a gap wider than 15 months', () {
      final dataset = [_p(0), _p(6), _p(12), _p(18), _p(24), _p(60)];
      expect(hasEnoughResolutionForChart(dataset), isFalse);
    });

    test('accepts a dense, evenly-spaced dataset', () {
      final dataset = [
        _p(0), _p(1), _p(2), _p(3), _p(6), _p(9), _p(12), _p(18), _p(24), _p(36), _p(48), _p(60),
      ];
      expect(hasEnoughResolutionForChart(dataset), isTrue);
    });

    test('rejects a two-point dataset spanning years (the unsafe case)', () {
      // Mirrors whoGirlWeight / cdcBoyWeight in growth_standards.dart: real
      // anchor points, but too sparse to interpolate a faithful curve shape.
      final dataset = [_p(0), _p(60)];
      expect(hasEnoughResolutionForChart(dataset), isFalse);
    });
  });
}
