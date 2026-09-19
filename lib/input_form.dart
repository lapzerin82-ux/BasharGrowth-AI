import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'app_theme.dart';

class PatientData {
  DateTime? dob;
  String sex;
  double? weight;
  double? height;
  double? headCircumference;
  DateTime measurementDate;
  double? boneAgeMonths;
  double? motherHeight;
  double? fatherHeight;

  PatientData({
    this.dob,
    this.sex = 'M',
    this.weight,
    this.height,
    this.headCircumference,
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
      final diff = _data.measurementDate.difference(_data.dob!);
      final years = diff.inDays ~/ 365;
      final months = (diff.inDays % 365) ~/ 30;
      final days = diff.inDays % 30;
      setState(() {
        _ageDisplay = '${years}y ${months}m ${days}d';
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
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionTitle(emoji: '🧒', title: 'Patient Demographics', color: AppColors.purpleDark),
              const SizedBox(height: 16),

              // DOB
              ListTile(
                leading: const Text('🎂', style: TextStyle(fontSize: 22)),
                title: const Text('Date of Birth'),
                subtitle: Text(_data.dob == null ? 'Not selected' : DateFormat('yyyy-MM-dd').format(_data.dob!)),
                trailing: const Icon(Icons.calendar_today, color: AppColors.purple),
                onTap: () => _selectDate(context, true),
              ),
              if (_ageDisplay.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(left: 16, top: 6, bottom: 8),
                  child: Text('🕐 Age: $_ageDisplay', style: const TextStyle(color: AppColors.purpleDark, fontWeight: FontWeight.w600)),
                ),
              const SizedBox(height: 8),

              // Sex
              DropdownButtonFormField<String>(
                // ignore: deprecated_member_use
                value: _data.sex,
                decoration: const InputDecoration(labelText: 'Sex', prefixIcon: Icon(Icons.face, color: AppColors.pink)),
                items: const [
                  DropdownMenuItem(value: 'M', child: Text('👦 Male')),
                  DropdownMenuItem(value: 'F', child: Text('👧 Female')),
                ],
                onChanged: (val) => setState(() => _data.sex = val ?? 'M'),
              ),
              const SizedBox(height: 16),

              // Measurement Date
              ListTile(
                leading: const Text('📅', style: TextStyle(fontSize: 22)),
                title: const Text('Measurement Date'),
                subtitle: Text(DateFormat('yyyy-MM-dd').format(_data.measurementDate)),
                trailing: const Icon(Icons.calendar_today, color: AppColors.purple),
                onTap: () => _selectDate(context, false),
              ),
              const SizedBox(height: 24),

              const SectionTitle(emoji: '📏', title: 'Anthropometry', color: AppColors.teal),
              const SizedBox(height: 16),

              // Weight
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Weight (kg)',
                  prefixIcon: Icon(Icons.monitor_weight, color: AppColors.teal),
                  hintText: 'e.g., 12.5',
                ),
                keyboardType: TextInputType.number,
                validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                onSaved: (val) => _data.weight = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 16),

              // Height
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Length/Height (cm)',
                  prefixIcon: Icon(Icons.height, color: AppColors.teal),
                  hintText: 'e.g., 85.0',
                ),
                keyboardType: TextInputType.number,
                validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                onSaved: (val) => _data.height = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 16),

              // Head Circumference
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Head Circumference (cm, optional)',
                  prefixIcon: Icon(Icons.psychology, color: AppColors.teal),
                  hintText: 'e.g., 46.0 — assessed up to age 5',
                ),
                keyboardType: TextInputType.number,
                onSaved: (val) => _data.headCircumference = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 24),

              const SectionTitle(emoji: '👪', title: 'Clinical Context (Optional)', color: AppColors.coral),
              const SizedBox(height: 16),

              TextFormField(
                decoration: const InputDecoration(
                  labelText: "Mother's Height (cm)",
                  prefixIcon: Icon(Icons.woman, color: AppColors.coral),
                ),
                keyboardType: TextInputType.number,
                onSaved: (val) => _data.motherHeight = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 16),

              TextFormField(
                decoration: const InputDecoration(
                  labelText: "Father's Height (cm)",
                  prefixIcon: Icon(Icons.man, color: AppColors.coral),
                ),
                keyboardType: TextInputType.number,
                onSaved: (val) => _data.fatherHeight = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 16),

              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Bone Age (Months)',
                  prefixIcon: Icon(Icons.accessibility_new, color: AppColors.coral),
                ),
                keyboardType: TextInputType.number,
                onSaved: (val) => _data.boneAgeMonths = double.tryParse(val ?? ''),
              ),
              const SizedBox(height: 28),

              SizedBox(
                width: double.infinity,
                child: GradientButton(
                  label: 'Calculate Growth',
                  emoji: '🚀',
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
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
