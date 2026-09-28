import 'package:flutter/material.dart';

import 'growth_assessment.dart';
import 'growth_standards.dart';

/// Page size of the CDC clinical growth charts (US letter, in PDF points).
const double cdcPageWidth = 612;
const double cdcPageHeight = 792;

/// Linear map from a measurement to a page y coordinate (points from the top),
/// valid between [min] and [max].
class _ValueAxis {
  final double slope;
  final double offset;
  final double min;
  final double max;

  const _ValueAxis(this.slope, this.offset, this.min, this.max);

  double? y(double value) => value < min || value > max ? null : slope * value + offset;
}

/// One page of the CDC 2000 clinical growth charts, Set 2 (3rd–97th
/// percentiles), 2 to 20 years, with its axis calibration.
///
/// The images in `assets/cdc_charts/` are pages 5–8 of the CDC `set2color.pdf`
/// rendered at 200 dpi. Axis positions were measured from the PDF's grid lines
/// (residual < 0.06 pt for the value axes); percentile curves computed from the
/// bundled CDC 2000 LMS tables fall on the printed curves (mean offset < 0.01 pt).
enum CdcChartPage {
  boysStatureWeight(
    'Stature-for-age and Weight-for-age (CDC 2000)',
    'assets/cdc_charts/boys_stature_weight_2_20.png',
    _statureWeightBoysYears,
    stature: _ValueAxis(-4.03735, 886.101, 77, 195),
    weight: _ValueAxis(-4.03656, 744.737, 9, 106),
  ),
  girlsStatureWeight(
    'Stature-for-age and Weight-for-age (CDC 2000)',
    'assets/cdc_charts/girls_stature_weight_2_20.png',
    _statureWeightGirlsYears,
    stature: _ValueAxis(-4.03735, 885.960, 77, 195),
    weight: _ValueAxis(-4.03657, 744.596, 9, 106),
  ),
  boysBmi(
    'BMI-for-age (CDC 2000)',
    'assets/cdc_charts/boys_bmi_2_20.png',
    _bmiBoysYears,
    bmi: _ValueAxis(-22.74091, 919.923, 12, 35),
  ),
  girlsBmi(
    'BMI-for-age (CDC 2000)',
    'assets/cdc_charts/girls_bmi_2_20.png',
    _bmiGirlsYears,
    bmi: _ValueAxis(-22.74090, 919.707, 12, 35),
  );

  const CdcChartPage(this.title, this.asset, this._yearLines, {_ValueAxis? stature, _ValueAxis? weight, _ValueAxis? bmi})
      : _stature = stature,
        _weight = weight,
        _bmi = bmi;

  final String title;
  final String asset;

  /// Page x of the grid line for each whole year of age, 2 to 20.
  final List<double> _yearLines;
  final _ValueAxis? _stature;
  final _ValueAxis? _weight;
  final _ValueAxis? _bmi;

  /// Page x for [ageYears], interpolated between the year grid lines, or null
  /// outside 2–20 years.
  double? x(double ageYears) {
    if (ageYears < 2 || ageYears > 20) return null;
    final i = (ageYears - 2).floor().clamp(0, _yearLines.length - 2);
    final f = ageYears - 2 - i;
    return _yearLines[i] + (_yearLines[i + 1] - _yearLines[i]) * f;
  }

  _ValueAxis? _axis(GrowthIndicator indicator) => switch (indicator) {
        GrowthIndicator.cdcStatureForAge => _stature,
        GrowthIndicator.cdcWeightForAge => _weight,
        GrowthIndicator.cdcBmiForAge => _bmi,
        _ => null,
      };

  /// Page position of [value] for [indicator] at [ageYears], or null when this
  /// page has no such axis or the point is outside the printed grid.
  Offset? position(GrowthIndicator indicator, double ageYears, double value) {
    final px = x(ageYears);
    final py = _axis(indicator)?.y(value);
    return px == null || py == null ? null : Offset(px, py);
  }

  static CdcChartPage? forIndicator(GrowthIndicator indicator, String sex) {
    final male = sex == 'M';
    return switch (indicator) {
      GrowthIndicator.cdcStatureForAge || GrowthIndicator.cdcWeightForAge =>
        male ? CdcChartPage.boysStatureWeight : CdcChartPage.girlsStatureWeight,
      GrowthIndicator.cdcBmiForAge => male ? CdcChartPage.boysBmi : CdcChartPage.girlsBmi,
      _ => null,
    };
  }
}

const _statureWeightBoysYears = [
  109.550, 131.038, 152.470, 173.951, 195.384, 216.817, 238.298, 259.779, 281.260, 302.693, //
  324.173, 345.654, 367.136, 388.617, 410.049, 431.530, 453.012, 474.444, 495.964,
];
const _statureWeightGirlsYears = [
  109.769, 131.257, 152.690, 174.171, 195.603, 217.036, 238.517, 259.998, 281.479, 302.912, //
  324.393, 345.874, 367.355, 388.836, 410.268, 431.749, 453.231, 474.663, 496.183,
];
const _bmiBoysYears = [
  97.849, 122.328, 146.752, 171.231, 195.710, 220.135, 244.614, 269.093, 293.572, 317.996, //
  342.475, 366.954, 391.378, 415.857, 440.336, 464.817, 489.240, 513.719, 538.197,
];
const _bmiGirlsYears = [
  97.810, 122.290, 146.714, 171.193, 195.672, 220.096, 244.575, 269.054, 293.533, 317.958, //
  342.437, 366.915, 391.340, 415.819, 440.298, 464.778, 489.201, 513.680, 538.159,
];

/// A measurement plotted on a CDC page.
class CdcChartPoint {
  final String measure;

  /// Page position in points, or null when the value is off the printed grid.
  final Offset? position;
  final String valueText;

  const CdcChartPoint(this.measure, this.position, this.valueText);
}

class CdcChartPlot {
  final CdcChartPage page;
  final List<CdcChartPoint> points;

  const CdcChartPlot(this.page, this.points);
}

/// Groups CDC-scored results onto their chart pages: stature and weight share
/// one page, BMI has its own.
List<CdcChartPlot> buildCdcChartPlots(String sex, List<GrowthResultData> results) {
  final byPage = <CdcChartPage, List<CdcChartPoint>>{};
  for (final r in results) {
    final indicator = r.indicator;
    final ageMonths = r.referenceX;
    if (indicator == null || ageMonths == null) continue;
    final page = CdcChartPage.forIndicator(indicator, sex);
    if (page == null) continue;
    final unit = switch (indicator) {
      GrowthIndicator.cdcBmiForAge => 'kg/m²',
      GrowthIndicator.cdcWeightForAge => 'kg',
      _ => 'cm',
    };
    byPage.putIfAbsent(page, () => []).add(CdcChartPoint(
          r.measure,
          page.position(indicator, ageMonths / 12, r.value),
          '${r.value.toStringAsFixed(1)} $unit',
        ));
  }
  return [for (final e in byPage.entries) CdcChartPlot(e.key, e.value)];
}

/// The CDC chart page with the child's measurements marked. Pinch to zoom.
class CdcChartPageView extends StatelessWidget {
  final CdcChartPlot plot;

  const CdcChartPageView({Key? key, required this.plot}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final offChart = plot.points.where((p) => p.position == null).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRect(
          child: InteractiveViewer(
            maxScale: 6,
            child: AspectRatio(
              aspectRatio: cdcPageWidth / cdcPageHeight,
              child: CustomPaint(
                foregroundPainter: _MarkerPainter([for (final p in plot.points) p.position].whereType<Offset>().toList()),
                child: Image.asset(plot.page.asset, fit: BoxFit.fill),
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'CDC 2000 clinical growth chart (3rd–97th percentiles). Black dot: this measurement. Pinch to zoom.',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
        ),
        for (final p in offChart)
          Text(
            '${p.measure} ${p.valueText} is outside the printed chart scale.',
            style: TextStyle(fontSize: 12, color: Colors.red.shade700),
          ),
      ],
    );
  }
}

class _MarkerPainter extends CustomPainter {
  final List<Offset> points;

  _MarkerPainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / cdcPageWidth;
    // At least 4 px so the dot stays visible on a phone-width page.
    final radius = 2.2 * scale < 4 ? 4.0 : 2.2 * scale;
    final ring = Paint()..color = Colors.white;
    final dot = Paint()..color = Colors.black;
    for (final p in points) {
      final c = Offset(p.dx * scale, p.dy * scale);
      canvas.drawCircle(c, radius + 1.5, ring);
      canvas.drawCircle(c, radius, dot);
    }
  }

  @override
  bool shouldRepaint(_MarkerPainter old) => old.points != points;
}
