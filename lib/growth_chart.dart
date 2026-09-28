import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import 'growth_assessment.dart';
import 'growth_calculations.dart';
import 'growth_standards.dart';

/// One reference line (a Z-score or percentile curve).
class ChartCurve {
  final String label;
  final List<FlSpot> points;

  /// 0 = median, 1 = inner cut-off (Z +/-2), 2 = outer (Z +/-3).
  final int emphasis;

  const ChartCurve(this.label, this.points, this.emphasis);
}

/// Reference curves plus the patient's point for one indicator.
class GrowthChartData {
  final String title;
  final String xLabel;
  final String yLabel;
  final List<ChartCurve> curves;
  final FlSpot patient;
  final double minX;
  final double maxX;

  /// Spacing of x-axis labels.
  final double xInterval;

  const GrowthChartData({
    required this.title,
    required this.xLabel,
    required this.yLabel,
    required this.curves,
    required this.patient,
    required this.minX,
    required this.maxX,
    required this.xInterval,
  });
}

const List<double> whoChartZScores = [-3, -2, 0, 2, 3];

/// Last day of age scored against WHO (see [whoUpperAgeMonths]).
const double whoAgeChartMaxDays = standingHeightFromDays - 1;

/// Builds the WHO chart for a scored result, or null if it was not scored
/// against a WHO table. CDC results are drawn on the CDC chart pages instead
/// (see `cdc_chart_page.dart`).
GrowthChartData? buildGrowthChart(GrowthReferences refs, String sex, GrowthResultData result) {
  final indicator = result.indicator;
  final x = result.referenceX;
  if (indicator == null || x == null || !indicator.name.startsWith('who')) return null;

  final table = refs.table(indicator, sex);
  final isByLength = indicator == GrowthIndicator.whoWeightForLength;

  // Table index -> displayed x: age in months, or length in cm.
  final double Function(double) toDisplayX = isByLength ? (v) => v : (v) => v / 30.4375;
  final double step = isByLength ? 0.5 : 7;
  // WHO age tables run to 5 years but are used only below 731 days.
  final maxIndex = isByLength ? table.maxX : whoAgeChartMaxDays;

  final levels = [
    for (final z in whoChartZScores)
      (
        label: z == 0 ? 'Z 0' : 'Z ${z > 0 ? '+' : ''}${z.toStringAsFixed(0)}',
        z: z,
        emphasis: z == 0 ? 0 : (z.abs() == 2 ? 1 : 2),
      )
  ];

  final curves = [
    for (final level in levels)
      ChartCurve(
        level.label,
        [
          for (var v = table.minX; v <= maxIndex; v += step)
            FlSpot(toDisplayX(v), valueAtZScore(level.z, table.lookup(v)!)),
          if (!isByLength) FlSpot(toDisplayX(maxIndex), valueAtZScore(level.z, table.lookup(maxIndex)!)),
        ],
        level.emphasis,
      ),
  ];

  final unit = switch (indicator) {
    GrowthIndicator.whoBmiForAge => 'BMI (kg/m²)',
    GrowthIndicator.whoLengthHeightForAge => 'Length (cm)',
    _ => 'Weight (kg)',
  };

  return GrowthChartData(
    title: '${result.measure} (WHO 2006)',
    xLabel: isByLength ? 'Length (cm)' : 'Age (months)',
    yLabel: unit,
    curves: curves,
    patient: FlSpot(toDisplayX(x), result.value),
    minX: toDisplayX(table.minX),
    maxX: isByLength ? table.maxX : 24,
    xInterval: isByLength ? 10 : 3,
  );
}

Widget _axisLabel(double value, TitleMeta meta) {
  // fl_chart also labels the axis min and max; skip them unless they fall on
  // the regular label spacing, so they cannot overlap a neighbouring label.
  final onGrid = (value / meta.appliedInterval - (value / meta.appliedInterval).round()).abs() < 1e-6;
  if (!onGrid || value != value.roundToDouble()) return const SizedBox.shrink();
  return SideTitleWidget(
    axisSide: meta.axisSide,
    child: Text(value.toStringAsFixed(0), style: const TextStyle(fontSize: 10)),
  );
}

class GrowthChart extends StatelessWidget {
  final GrowthChartData data;

  const GrowthChart({Key? key, required this.data}) : super(key: key);

  Color _curveColor(int emphasis) {
    switch (emphasis) {
      case 0:
        return Colors.green.shade700;
      case 1:
        return Colors.orange.shade700;
      case 2:
        return Colors.red.shade700;
      default:
        return Colors.grey.shade500;
    }
  }

  @override
  Widget build(BuildContext context) {
    final ys = [for (final c in data.curves) ...c.points.map((p) => p.y), data.patient.y];
    final minY = ys.reduce((a, b) => a < b ? a : b);
    final maxY = ys.reduce((a, b) => a > b ? a : b);
    final pad = (maxY - minY) * 0.05;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AspectRatio(
          aspectRatio: 1.3,
          // Room for the last x label and the top y label, which fl_chart centres on the edge.
          child: Padding(
            padding: const EdgeInsets.only(top: 10, right: 14),
            child: LineChart(
              LineChartData(
                minX: data.minX,
                maxX: data.maxX,
                minY: (minY - pad).floorToDouble(),
                maxY: (maxY + pad).ceilToDouble(),
                lineTouchData: const LineTouchData(enabled: false),
                gridData: FlGridData(show: true, verticalInterval: data.xInterval),
                borderData: FlBorderData(show: true),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    axisNameWidget: Text(data.xLabel, style: const TextStyle(fontSize: 12)),
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      interval: data.xInterval,
                      getTitlesWidget: _axisLabel,
                    ),
                  ),
                  leftTitles: AxisTitles(
                    axisNameWidget: Text(data.yLabel, style: const TextStyle(fontSize: 12)),
                    sideTitles: const SideTitles(showTitles: true, reservedSize: 40, getTitlesWidget: _axisLabel),
                  ),
                ),
                lineBarsData: [
                  for (final curve in data.curves)
                    LineChartBarData(
                      spots: curve.points,
                      color: _curveColor(curve.emphasis),
                      barWidth: curve.emphasis == 0 ? 2 : 1,
                      dotData: const FlDotData(show: false),
                    ),
                  LineChartBarData(
                    spots: [data.patient],
                    color: Colors.blue.shade800,
                    barWidth: 0,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(
                        radius: 5,
                        color: Colors.blue.shade800,
                        strokeWidth: 2,
                        strokeColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Curves: ${data.curves.map((c) => c.label).join(', ')}. Blue dot: this measurement.',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
        ),
      ],
    );
  }
}
