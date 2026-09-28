import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'growth_calculations.dart';

class PatientData {
  DateTime? dob;
  String sex;
  double? weight;
  double? height;
  DateTime measurementDate;
  double? boneAgeMonths;
  double? motherHeight;
  double? fatherHeight;
  double? gestationalAgeWeeks;

  /// null = assume the WHO convention for the age.
  bool? measuredStanding;

  PatientData({
    this.dob,
    this.sex = 'M',
    this.weight,
    this.height,
    DateTime? measurementDate,
    this.boneAgeMonths,
    this.motherHeight,
    this.fatherHeight,
    this.gestationalAgeWeeks,
    this.measuredStanding,
  }) : measurementDate = measurementDate ?? DateTime.now();
}

/// Validator for a numeric field that must lie within [min, max].
String? Function(String?) rangeValidator(double min, double max, {bool required = false}) {
  return (val) {
    final text = val?.trim() ?? '';
    if (text.isEmpty) return required ? 'Required' : null;
    final number = double.tryParse(text.replaceAll(',', '.'));
    if (number == null) return 'Enter a number';
    if (number < min || number > max) return 'Must be between ${_fmt(min)} and ${_fmt(max)}';
    return null;
  };
}

double? parseNumber(String? val) => double.tryParse((val ?? '').trim().replaceAll(',', '.'));

String _fmt(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

class InputForm extends StatefulWidget {
  final Function(PatientData) onCalculate;

  const InputForm({Key? key, required this.onCalculate}) : super(key: key);

  @override
  State<InputForm> createState() => _InputFormState();
}

class _InputFormState extends State<InputForm> {
  final _formKey = GlobalKey<FormState>();
  final PatientData _data = PatientData();
  String _ageDisplay = '';

  @visibleForTesting
  PatientData get patientDataForTest => _data;

  void _updateAge() {
    if (_data.dob != null) {
      setState(() {
        _ageDisplay = _data.measurementDate.isBefore(_data.dob!) ? '' : formatAge(_data.dob!, _data.measurementDate);
      });
    }
  }

  Future<void> _selectDate(BuildContext context, bool isDOB) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: isDOB ? DateTime(2020) : _data.measurementDate,
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        if (isDOB) {
          _data.dob = picked;
        } else {
          _data.measurementDate = picked;
        }
        _updateAge();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.person, color: Theme.of(context).primaryColor),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Patient Demographics', style: Theme.of(context).textTheme.headlineSmall)),
                ],
              ),
              const SizedBox(height: 16),
              
              // DOB
              ListTile(
                title: const Text('Date of Birth'),
                subtitle: Text(_data.dob == null ? 'Not selected' : DateFormat('yyyy-MM-dd').format(_data.dob!)),
                trailing: const Icon(Icons.calendar_today),
                onTap: () => _selectDate(context, true),
              ),
              if (_ageDisplay.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(left: 16, bottom: 8),
                  child: Text('Age: $_ageDisplay', style: TextStyle(color: Colors.grey[600])),
                ),
              
              // Sex
              DropdownButtonFormField<String>(
                // ignore: deprecated_member_use
                value: _data.sex,
                decoration: const InputDecoration(labelText: 'Sex', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'M', child: Text('Male')),
                  DropdownMenuItem(value: 'F', child: Text('Female')),
                ],
                onChanged: (val) => setState(() => _data.sex = val ?? 'M'),
              ),
              const SizedBox(height: 16),
              
              // Measurement Date
              ListTile(
                title: const Text('Measurement Date'),
                subtitle: Text(DateFormat('yyyy-MM-dd').format(_data.measurementDate)),
                trailing: const Icon(Icons.calendar_today),
                onTap: () => _selectDate(context, false),
              ),
              const SizedBox(height: 24),
              
              Row(
                children: [
                  Icon(Icons.straighten, color: Theme.of(context).primaryColor),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Anthropometry', style: Theme.of(context).textTheme.headlineSmall)),
                ],
              ),
              const SizedBox(height: 16),
              
              // Weight
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Weight (kg)',
                  border: OutlineInputBorder(),
                  hintText: 'e.g., 12.5',
                ),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: rangeValidator(0.3, 250, required: true),
                onSaved: (val) => _data.weight = parseNumber(val),
              ),
              const SizedBox(height: 16),
              
              // Height
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Length/Height (cm)',
                  border: OutlineInputBorder(),
                  hintText: 'e.g., 85.0',
                ),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: rangeValidator(30, 230, required: true),
                onSaved: (val) => _data.height = parseNumber(val),
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                // ignore: deprecated_member_use
                value: switch (_data.measuredStanding) { null => 'auto', true => 'standing', false => 'lying' },
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Measured', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'auto', child: Text('Standard for age (lying < 2y, standing ≥ 2y)')),
                  DropdownMenuItem(value: 'lying', child: Text('Lying (recumbent length)')),
                  DropdownMenuItem(value: 'standing', child: Text('Standing (height)')),
                ],
                onChanged: (val) => setState(() => _data.measuredStanding = switch (val) {
                  'standing' => true,
                  'lying' => false,
                  _ => null,
                }),
              ),
              const SizedBox(height: 24),
              
              Row(
                children: [
                  Icon(Icons.family_restroom, color: Theme.of(context).primaryColor),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Clinical Context (Optional)', style: Theme.of(context).textTheme.headlineSmall)),
                ],
              ),
              const SizedBox(height: 16),
              
              TextFormField(
                decoration: const InputDecoration(
                  labelText: "Mother's Height (cm)",
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: rangeValidator(120, 230),
                onSaved: (val) => _data.motherHeight = parseNumber(val),
              ),
              const SizedBox(height: 16),
              
              TextFormField(
                decoration: const InputDecoration(
                  labelText: "Father's Height (cm)",
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: rangeValidator(120, 230),
                onSaved: (val) => _data.fatherHeight = parseNumber(val),
              ),
              const SizedBox(height: 16),
              
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Bone Age (Months)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: rangeValidator(0, 240),
                onSaved: (val) => _data.boneAgeMonths = parseNumber(val),
              ),
              const SizedBox(height: 16),

              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Gestational Age at Birth (weeks)',
                  helperText: 'Below 37 weeks: age is corrected until 2 years',
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: rangeValidator(22, 44),
                onSaved: (val) => _data.gestationalAgeWeeks = parseNumber(val),
              ),
              const SizedBox(height: 24),
              
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    if (_data.dob != null && _data.measurementDate.isBefore(_data.dob!)) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Measurement date cannot be before date of birth')),
                      );
                    } else if (_formKey.currentState!.validate() && _data.dob != null) {
                      _formKey.currentState!.save();
                      widget.onCalculate(_data);
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please fill all required fields')),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Calculate Growth', style: TextStyle(fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
