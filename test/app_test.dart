import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pediatric_growth_monitor/growth_chart.dart';
import 'package:pediatric_growth_monitor/input_form.dart';
import 'package:pediatric_growth_monitor/main.dart';

import 'growth_test.dart' show loadReferences;

void main() {
  final refs = loadReferences();

  Future<void> enter(WidgetTester tester, String label, String text) async {
    final field = find.widgetWithText(TextFormField, label);
    await tester.ensureVisible(field);
    await tester.pumpAndSettle();
    await tester.enterText(field, text);
  }

  Future<void> tapCalculate(WidgetTester tester) async {
    final button = find.text('Calculate Growth');
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pumpAndSettle();
  }

  testWidgets('preterm infant is assessed at corrected age', (tester) async {
    tester.view.physicalSize = const Size(1200, 2400);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(MyApp(refs: refs));

    // Set DOB and measurement date directly: the date picker is platform UI.
    final form = tester.state(find.byType(InputForm)) as dynamic;
    final PatientData data = form.patientDataForTest;
    data.dob = DateTime(2024, 1, 1);
    data.measurementDate = DateTime(2024, 7, 1); // 182 days

    await enter(tester, 'Weight (kg)', '6,5');
    await enter(tester, 'Length/Height (cm)', '63');
    await enter(tester, 'Gestational Age at Birth (weeks)', '30');
    await tapCalculate(tester);

    // 182 - 70 days = 112 days corrected.
    expect(find.textContaining('Corrected age 3m 21d'), findsOneWidget);
    expect(find.textContaining('born at 30 weeks'), findsOneWidget);
    for (final measure in ['Weight-for-Age', 'Length-for-Age', 'Weight-for-Length', 'BMI-for-Age']) {
      expect(find.text(measure), findsOneWidget);
    }

    final chartTile = find.text('Weight-for-Length (WHO 2006)');
    await tester.ensureVisible(chartTile);
    await tester.pumpAndSettle();
    await tester.tap(chartTile);
    await tester.pumpAndSettle();
    expect(find.byType(GrowthChart), findsOneWidget);
  });

  testWidgets('out-of-range input is rejected', (tester) async {
    tester.view.physicalSize = const Size(1200, 2400);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(MyApp(refs: refs));
    final form = tester.state(find.byType(InputForm)) as dynamic;
    (form.patientDataForTest as PatientData).dob = DateTime(2020, 1, 1);

    await enter(tester, 'Weight (kg)', '900');
    await enter(tester, 'Length/Height (cm)', '100');
    await tapCalculate(tester);

    expect(find.text('Must be between 0.3 and 250'), findsOneWidget);
    expect(find.text('Growth Assessment'), findsNothing);
  });
}
