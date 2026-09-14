import 'dart:math';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'growth_calculations.dart';
import 'growth_standards.dart';

/// Chart colors sourced from the dataviz skill's validated reference
/// palette: the sequential "blue" ordinal ramp for the percentile curves
/// (darkest at the median, lighter toward the outer percentiles — an
/// ordinal ramp, since each step encodes distance from the median, not an
/// unrelated category), and the fixed status palette for the patient's
/// point marker so severity is never carried by hue alone (the
/// classification badge text elsewhere on the screen backs it up).
class _ChartColors {
  static const gridline = Color(0xFFE1E0D9);
  static const axisLabel = Color(0xFF898781);
  static const legendLabel = Color(0xFF52514E);
  static const good = Color(0xFF0CA30C);
  static const warning = Color(0xFFFAB219);
  static const critical = Color(0xFFD03B3B);

  // Sequential blue ramp, darkest to lightest (references/palette.md).
  static const rampStep600 = Color(0xFF184F95);
  static const rampStep450 = Color(0xFF2A78D6);
  static const rampStep350 = Color(0xFF5598E7);
  static const rampStep300 = Color(0xFF6DA7EC);
  static const rampStep250 = Color(0xFF86B6EF); // safe floor: 2.06:1 on white
}

Color _markerColorFor(String classification) {
  if (classification.contains('Severe') || classification == 'Obese') {
    return _ChartColors.critical;
  }
  if (classification == 'Normal' || classification == 'Healthy weight') {
    return _ChartColors.good;
  }
  return _ChartColors.warning;
}

/// Standard normal distribution quantiles (the inverse CDF) — universal
/// statistical constants, not clinical measurement data, and not
/// approximated: these are the exact percentiles printed on the CDC 2000
/// growth charts (see growth_standards.dart's file header).
///
/// The 7-curve set used on the weight-for-age, length/stature-for-age,
/// and weight-for-length charts.
const Map<int, double> cdcStandardPercentileZ = {
  3: -1.881,
  10: -1.282,
  25: -0.674,
  50: 0,
  75: 0.674,
  90: 1.282,
  97: 1.881,
};

/// The 9-curve set used only on the BMI-for-age chart, which adds the
/// clinical overweight (85th) and obesity (95th) cutoffs on top of the
/// standard 7.
const Map<int, double> cdcBmiPercentileZ = {
  3: -1.881,
  10: -1.282,
  25: -0.674,
  50: 0,
  75: 0.674,
  85: 1.036,
  90: 1.282,
  95: 1.645,
  97: 1.881,
};

/// A dataset needs enough anchor points, spaced closely enough, for a
/// linear-in-LMS-space interpolation to look like a faithful curve rather
/// than a straight-line guess between two distant points. Below this
/// resolution we show an explanatory note instead of a misleading chart —
/// see the TODO(clinical-data) datasets in growth_standards.dart, most of
/// which are still empty or too sparse to plot honestly.
bool hasEnoughResolutionForChart(List<LMSDataPoint> dataset) {
  if (dataset.length < 6) return false;
  for (var i = 0; i < dataset.length - 1; i++) {
    if (dataset[i + 1].ageMonths - dataset[i].ageMonths > 15) return false;
  }
  return true;
}

/// Draws a small bold percentile-number label at a spot's exact canvas
/// position, as fl_chart computes it — reusing the library's own layout
/// rather than re-deriving axis padding by hand. Used only on each
/// percentile curve's rightmost point (see `checkToShowDot` in build()).
class _PercentileLabelPainter extends FlDotPainter {
  final String label;
  final Color color;
  final bool bold;

  _PercentileLabelPainter({required this.label, required this.color, this.bold = false});

  @override
  void draw(Canvas canvas, FlSpot spot, Offset offsetInCanvas) {
    final painter = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: bold ? FontWeight.bold : FontWeight.w600,
          color: color,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, offsetInCanvas + Offset(4, -painter.height / 2));
  }

  @override
  Size getSize(FlSpot spot) => const Size(20, 14);

  @override
  Color get mainColor => color;

  @override
  FlDotPainter lerp(FlDotPainter a, FlDotPainter b, double t) => t < 0.5 ? a : b;

  @override
  List<Object?> get props => [label, color, bold];
}

/// Plots a patient's measurement against the exact CDC 2000 percentile
/// curves for the relevant chart — the same 3rd/10th/25th/50th/75th/90th/
/// 97th (or, for BMI, 3rd/10th/25th/50th/75th/85th/90th/95th/97th) curves
/// shown on the official printed CDC growth charts — using only datasets
/// with [hasEnoughResolutionForChart].
class GrowthChart extends StatelessWidget {
  final String title;
  final List<LMSDataPoint> dataset;
  /// The patient's position on the X axis — age in months for every chart
  /// except Weight-for-Length, which plots against recumbent length (cm)
  /// instead, per [xAxisUnit].
  final double patientX;
  final double patientValue;
  final String classification;
  final String yAxisLabel;
  final String xAxisUnit;
  final Map<int, double> percentileZ;

  const GrowthChart({
    super.key,
    required this.title,
    required this.dataset,
    required this.patientX,
    required this.patientValue,
    required this.classification,
    required this.yAxisLabel,
    this.xAxisUnit = 'm',
    this.percentileZ = cdcStandardPercentileZ,
  });

  /// The LMS inverse transform (value = M·(1+LSZ)^(1/L)) is only
  /// well-behaved near the median: for a handful of ages in the CDC
  /// BMI-for-age tables, L swings negative enough that an extreme Z
  /// pushes (1+LSZ) to near zero (or negative), and raising that to a
  /// negative fractional power explodes toward infinity or turns complex.
  /// This is a known LMS/Box-Cox edge case at extreme Z, not a data error
  /// (it never triggers within the ±1.881 range these percentile curves
  /// use — see test/growth_chart_test.dart). Skip the point rather than
  /// plot it or let it distort the axis scale.
  double? _safeValueForZ(double z, LMSParameters lms) {
    final value = calculateValueForZ(z, lms);
    if (!value.isFinite) return null;
    if (value <= 0 || value > lms.m * 4 || value < lms.m * 0.25) return null;
    return value;
  }

  List<FlSpot> _curveAtZ(double z, double minAge, double maxAge) {
    final spots = <FlSpot>[];
    for (double age = minAge; age < maxAge; age += 1) {
      final lms = getLMSForAge(dataset, age);
      if (lms == null) continue;
      final value = _safeValueForZ(z, lms);
      if (value != null) spots.add(FlSpot(age, value));
    }
    final lmsEnd = getLMSForAge(dataset, maxAge);
    if (lmsEnd != null) {
      final value = _safeValueForZ(z, lmsEnd);
      if (value != null) spots.add(FlSpot(maxAge, value));
    }
    return spots;
  }

  /// Colors curves by rank distance from the median (an ordinal ramp, not
  /// a categorical one) so the 50th percentile — the line clinicians
  /// reference most — reads as the most prominent.
  Color _rampColorForRank(int rankFromMedian) {
    const steps = [
      _ChartColors.rampStep600,
      _ChartColors.rampStep450,
      _ChartColors.rampStep350,
      _ChartColors.rampStep300,
      _ChartColors.rampStep250,
    ];
    return steps[rankFromMedian.clamp(0, steps.length - 1)];
  }

  @override
  Widget build(BuildContext context) {
    final dataMinAge = dataset.first.ageMonths;
    final dataMaxAge = dataset.last.ageMonths;
    final clampedPatientAge = patientX.clamp(dataMinAge, dataMaxAge);

    final sortedPercentiles = percentileZ.keys.toList()..sort();
    final medianRank = sortedPercentiles.indexOf(50);

    final curves = <int, List<FlSpot>>{
      for (final p in sortedPercentiles) p: _curveAtZ(percentileZ[p]!, dataMinAge, dataMaxAge),
    };

    final allY = [
      for (final spots in curves.values) ...spots.map((s) => s.y),
      patientValue,
    ];
    final rawMinY = allY.reduce(min) * 0.9;
    final rawMaxY = allY.reduce(max) * 1.1;
    // Round the Y bounds to "nice" multiples of the tick step so fl_chart's
    // always-shown edge labels land exactly on a regular gridline instead
    // of producing a stray extra tick close to the last interval label.
    const yStepCandidates = [1.0, 2.0, 5.0, 10.0, 20.0, 25.0, 50.0, 100.0];
    var yStep = yStepCandidates.last;
    for (final candidate in yStepCandidates) {
      if ((rawMaxY - rawMinY) / candidate <= 5) {
        yStep = candidate;
        break;
      }
    }
    final minY = (rawMinY / yStep).floor() * yStep;
    final maxY = (rawMaxY / yStep).ceil() * yStep;

    // Reserve blank space on the right for direct end-of-line percentile
    // labels (the convention on the official printed charts), and enough
    // to cover the patient marker if their age exceeds the dataset.
    final dataSpan = dataMaxAge - dataMinAge;
    final chartMinX = min(dataMinAge, patientX);
    final chartMaxX = max(dataMaxAge, patientX) + dataSpan * 0.12;

    double ageInterval = (dataSpan / 5).ceilToDouble();
    if (ageInterval < 1) ageInterval = 1;

    final markerColor = _markerColorFor(classification);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 12),
        SizedBox(
          height: 240,
          child: LineChart(
            LineChartData(
              minX: chartMinX,
              maxX: chartMaxX,
              minY: minY,
              maxY: maxY,
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                horizontalInterval: yStep,
                getDrawingHorizontalLine: (_) => const FlLine(
                  color: _ChartColors.gridline,
                  strokeWidth: 1,
                ),
              ),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    interval: ageInterval,
                    reservedSize: 26,
                    getTitlesWidget: (value, meta) {
                      // Suppress ticks fl_chart would otherwise draw inside
                      // the reserved label margin past the real data range.
                      if (value > dataMaxAge + 0.5) return const SizedBox.shrink();
                      return SideTitleWidget(
                        axisSide: meta.axisSide,
                        child: Text(
                          '${value.toInt()}$xAxisUnit',
                          style: const TextStyle(fontSize: 10, color: _ChartColors.axisLabel),
                        ),
                      );
                    },
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 34,
                    interval: yStep,
                    getTitlesWidget: (value, meta) => Text(
                      value.toStringAsFixed(0),
                      style: const TextStyle(fontSize: 10, color: _ChartColors.axisLabel),
                    ),
                  ),
                ),
              ),
              lineTouchData: LineTouchData(
                touchTooltipData: LineTouchTooltipData(
                  getTooltipItems: (spots) => spots.map((s) {
                    return LineTooltipItem(
                      '${s.y.toStringAsFixed(1)} $yAxisLabel @ ${s.x.toStringAsFixed(0)}$xAxisUnit',
                      const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                    );
                  }).toList(),
                ),
              ),
              lineBarsData: [
                for (final p in sortedPercentiles)
                  () {
                    final rank = (sortedPercentiles.indexOf(p) - medianRank).abs();
                    final isMedian = p == 50;
                    final color = _rampColorForRank(rank);
                    final spots = curves[p]!;
                    return LineChartBarData(
                      spots: spots,
                      isCurved: false,
                      color: color,
                      barWidth: isMedian ? 2.5 : 1.4,
                      dotData: FlDotData(
                        show: true,
                        checkToShowDot: (spot, bar) => spots.isNotEmpty && spot.x == spots.last.x,
                        getDotPainter: (spot, percent, bar, index) => _PercentileLabelPainter(
                          label: '$p',
                          color: color,
                          bold: isMedian,
                        ),
                      ),
                    );
                  }(),
                // Patient's own measurement as a single highlighted point.
                LineChartBarData(
                  spots: [FlSpot(clampedPatientAge.toDouble(), patientValue)],
                  barWidth: 0,
                  dotData: FlDotData(
                    show: true,
                    getDotPainter: (spot, percent, bar, index) => FlDotCirclePainter(
                      radius: 6,
                      color: markerColor,
                      strokeWidth: 2,
                      strokeColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 16,
          runSpacing: 4,
          children: [
            _legendItem(_ChartColors.rampStep600, 'Percentile curves (labeled)'),
            _legendItem(markerColor, 'This measurement'),
          ],
        ),
      ],
    );
  }

  Widget _legendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 11, color: _ChartColors.legendLabel)),
      ],
    );
  }
}
