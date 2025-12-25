import 'package:flutter/material.dart';

void main() {
  runApp(const CaseCalculatorApp());
}

class CaseCalculatorApp extends StatelessWidget {
  const CaseCalculatorApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Clinic Case Calculator',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.indigo,
          brightness: Brightness.light,
        ),
      ),
      home: const CaseCalculatorHome(),
    );
  }
}

class CaseCalculatorHome extends StatefulWidget {
  const CaseCalculatorHome({Key? key}) : super(key: key);

  @override
  State<CaseCalculatorHome> createState() => _CaseCalculatorHomeState();
}

class _CaseCalculatorHomeState extends State<CaseCalculatorHome> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _startController = TextEditingController();
  final TextEditingController _endController = TextEditingController();
  final TextEditingController _feeController =
      TextEditingController(text: '4000');
  final TextEditingController _doctorRateController =
      TextEditingController(text: '0.8375');
  bool _includeEndNumber = false;

  int? _cases;
  double? _totalFees;
  double? _doctorShare;
  double? _governmentShare;

  @override
  void dispose() {
    _startController.dispose();
    _endController.dispose();
    _feeController.dispose();
    _doctorRateController.dispose();
    super.dispose();
  }

  void _calculate() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final start = int.parse(_startController.text.trim());
    final end = int.parse(_endController.text.trim());
    final fee = double.parse(_feeController.text.trim());
    final doctorRate = double.parse(_doctorRateController.text.trim());

    final cases = end - start + (_includeEndNumber ? 1 : 0);
    final totalFees = cases * fee;
    final doctorShare = totalFees * doctorRate;
    final governmentShare = totalFees - doctorShare;

    setState(() {
      _cases = cases;
      _totalFees = totalFees;
      _doctorShare = doctorShare;
      _governmentShare = governmentShare;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.blue.shade50,
              Colors.indigo.shade50,
            ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                _Header(),
                const SizedBox(height: 16),
                _buildFormCard(context),
                const SizedBox(height: 16),
                if (_cases != null) _buildResultsCard(context),
                const SizedBox(height: 24),
                Center(
                  child: Text(
                    _includeEndNumber
                        ? 'Cases = End number − Start number + 1.'
                        : 'Cases = End number − Start number (based on the provided list examples).',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFormCard(BuildContext context) {
    return Card(
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.calculate, color: Theme.of(context).primaryColor),
                  const SizedBox(width: 8),
                  Text('Case Inputs',
                      style: Theme.of(context).textTheme.headlineSmall),
                ],
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _startController,
                decoration: const InputDecoration(
                  labelText: 'Start number (S)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Enter a start number';
                  }
                  if (int.tryParse(value.trim()) == null) {
                    return 'Start number must be an integer';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _endController,
                decoration: const InputDecoration(
                  labelText: 'End number (E)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Enter an end number';
                  }
                  final end = int.tryParse(value.trim());
                  if (end == null) {
                    return 'End number must be an integer';
                  }
                  final start = int.tryParse(_startController.text.trim());
                  if (start != null && end < start) {
                    return 'End number must be greater than start';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Include end number'),
                subtitle: const Text('Use +1 when the end ticket is counted.'),
                value: _includeEndNumber,
                onChanged: (value) {
                  setState(() {
                    _includeEndNumber = value;
                  });
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _feeController,
                decoration: const InputDecoration(
                  labelText: 'Fee per case (IQD)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Enter the fee per case';
                  }
                  if (double.tryParse(value.trim()) == null) {
                    return 'Fee must be a number';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _doctorRateController,
                decoration: const InputDecoration(
                  labelText: 'Doctor share rate (r)',
                  border: OutlineInputBorder(),
                  helperText: 'Default: 0.8375 (83.75%)',
                ),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Enter the doctor share rate';
                  }
                  final rate = double.tryParse(value.trim());
                  if (rate == null) {
                    return 'Rate must be a number';
                  }
                  if (rate < 0 || rate > 1) {
                    return 'Rate must be between 0 and 1';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _calculate,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text('Calculate',
                      style: TextStyle(fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResultsCard(BuildContext context) {
    final doctorRate = double.parse(_doctorRateController.text.trim());
    final governmentRate = 1 - doctorRate;

    return Card(
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Results', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 16),
            _ResultRow(label: 'Total cases', value: _cases!.toString()),
            _ResultRow(
              label: 'Total fees (IQD)',
              value: _totalFees!.toStringAsFixed(0),
            ),
            _ResultRow(
              label: 'Doctor share (${(doctorRate * 100).toStringAsFixed(2)}%)',
              value: _doctorShare!.toStringAsFixed(0),
            ),
            _ResultRow(
              label:
                  'Government share (${(governmentRate * 100).toStringAsFixed(2)}%)',
              value: _governmentShare!.toStringAsFixed(0),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(Icons.local_hospital,
            size: 40, color: Theme.of(context).primaryColor),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Clinic Case Calculator',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                'Calculate total cases, doctor share, and government share',
                style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ResultRow extends StatelessWidget {
  final String label;
  final String value;

  const _ResultRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Text(
              label,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            value,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
