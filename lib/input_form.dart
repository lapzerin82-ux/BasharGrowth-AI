import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'growth_calculations.dart' show calculateAgeBreakdown, validateMeasurement;

class PatientData {
  DateTime? dob;
  String sex;
  double? weight;
  double? height;
  DateTime measurementDate;
  double? boneAgeMonths;
  double? motherHeight;
  double? fatherHeight;

  PatientData({
    this.dob,
    this.sex = 'M',
    this.weight,
    this.height,
    DateTime? measurementDate,
    this.boneAgeMonths,
    this.motherHeight,
    this.fatherHeight,
  }) : measurementDate = measurementDate ?? DateTime.now();
}

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

  void _updateAge() {
    if (_data.dob != null) {
      final breakdown = calculateAgeBreakdown(_data.dob!, _data.measurementDate);
      setState(() {
        _ageDisplay = breakdown.toString();
      });
    }
  }

  Future<void> _selectDate(BuildContext context, bool isDOB) async {
    final firstDate = isDOB ? DateTime(1900) : (_data.dob ?? DateTime(1900));
    final lastDate = isDOB ? _data.measurementDate : DateTime.now();

    var initialDate = _data.dob ?? DateTime(2020);
    if (!isDOB) initialDate = _data.measurementDate;
    if (initialDate.isBefore(firstDate)) initialDate = firstDate;
    if (initialDate.isAfter(lastDate)) initialDate = lastDate;

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
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
                  Text('Patient Demographics', style: Theme.of(context).textTheme.headlineSmall),
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
                  Text('Anthropometry', style: Theme.of(context).textTheme.headlineSmall),
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
                keyboardType: TextInputType.number,
                validator: (val) {
                  if (val == null || val.isEmpty) return 'Required';
                  return validateMeasurement('Weight', double.tryParse(val), min: 0.3, max: 150);
                },
                onSaved: (val) => _data.weight = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 16),

              // Height
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Length/Height (cm)',
                  border: OutlineInputBorder(),
                  hintText: 'e.g., 85.0',
                ),
                keyboardType: TextInputType.number,
                validator: (val) {
                  if (val == null || val.isEmpty) return 'Required';
                  return validateMeasurement('Height', double.tryParse(val), min: 20, max: 200);
                },
                onSaved: (val) => _data.height = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 24),
              
              Row(
                children: [
                  Icon(Icons.family_restroom, color: Theme.of(context).primaryColor),
                  const SizedBox(width: 8),
                  Text('Clinical Context (Optional)', style: Theme.of(context).textTheme.headlineSmall),
                ],
              ),
              const SizedBox(height: 16),
              
              TextFormField(
                decoration: const InputDecoration(
                  labelText: "Mother's Height (cm)",
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                validator: (val) {
                  if (val == null || val.isEmpty) return null;
                  return validateMeasurement("Mother's height", double.tryParse(val), min: 100, max: 200);
                },
                onSaved: (val) => _data.motherHeight = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 16),
              
              TextFormField(
                decoration: const InputDecoration(
                  labelText: "Father's Height (cm)",
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                validator: (val) {
                  if (val == null || val.isEmpty) return null;
                  return validateMeasurement("Father's height", double.tryParse(val), min: 100, max: 220);
                },
                onSaved: (val) => _data.fatherHeight = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 16),

              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Bone Age (Months)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                validator: (val) {
                  if (val == null || val.isEmpty) return null;
                  return validateMeasurement('Bone age', double.tryParse(val), min: 0, max: 240);
                },
                onSaved: (val) => _data.boneAgeMonths = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 24),
              
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    if (_formKey.currentState!.validate() && _data.dob != null) {
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
