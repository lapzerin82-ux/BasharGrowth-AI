import React, { useMemo, useState } from 'react';

const dinarFormat = (value: number) =>
  value.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });

const DEFAULT_CASES = 100;
const DEFAULT_FEE = 4000;
const DEFAULT_DOCTOR_SHARE = 83.75; // Derived from 335,000 / 400,000

const DoctorCaseCalculator: React.FC = () => {
  const [casesManaged, setCasesManaged] = useState<number>(DEFAULT_CASES);
  const [feePerCase, setFeePerCase] = useState<number>(DEFAULT_FEE);
  const [doctorSharePercent, setDoctorSharePercent] = useState<number>(DEFAULT_DOCTOR_SHARE);

  const { totalRevenue, doctorPortion, governmentPortion, doctorPerCase } = useMemo(() => {
    const total = Math.max(0, casesManaged) * Math.max(0, feePerCase);
    const doctorShare = total * (Math.max(0, doctorSharePercent) / 100);
    const doctorPerItem = Math.max(0, feePerCase) * (Math.max(0, doctorSharePercent) / 100);
    return {
      totalRevenue: total,
      doctorPortion: doctorShare,
      governmentPortion: Math.max(0, total - doctorShare),
      doctorPerCase: doctorPerItem,
    };
  }, [casesManaged, feePerCase, doctorSharePercent]);

  const resetToScenario = () => {
    setCasesManaged(DEFAULT_CASES);
    setFeePerCase(DEFAULT_FEE);
    setDoctorSharePercent(DEFAULT_DOCTOR_SHARE);
  };

  return (
    <section className="bg-white p-6 md:p-8 rounded-[2.5rem] border-4 border-orange-500 shadow-[8px_8px_0px_0px_#fb923c]">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-bold uppercase text-orange-500 tracking-wider">Finance helper</p>
          <h2 className="text-2xl font-black text-slate-900">Doctor Case Calculator</h2>
          <p className="text-sm text-slate-600 mt-2">
            Adjust the numbers to quickly see how the payout shifts between the doctor and the government.
          </p>
        </div>
        <button
          onClick={resetToScenario}
          className="hidden md:inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold border border-slate-700 hover:bg-slate-800 active:scale-95 transition-all"
        >
          Reset example
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="space-y-2">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wide">Cases managed</label>
          <input
            type="number"
            min="0"
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-lg text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            value={casesManaged}
            onChange={(e) => setCasesManaged(parseInt(e.target.value) || 0)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wide">Fee per case (dinar)</label>
          <input
            type="number"
            min="0"
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-lg text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            value={feePerCase}
            onChange={(e) => setFeePerCase(parseInt(e.target.value) || 0)}
          />
          <p className="text-xs font-semibold text-orange-500">Example: 4,000 dinar per case</p>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wide">Doctor take-home (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-lg text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            value={doctorSharePercent}
            onChange={(e) => setDoctorSharePercent(parseFloat(e.target.value) || 0)}
          />
          <p className="text-xs font-semibold text-orange-500">Derived from 335,000 / 400,000 = 83.75%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
          <p className="text-[11px] font-black uppercase text-orange-600">Total revenue</p>
          <p className="text-3xl font-black text-slate-900">{dinarFormat(totalRevenue)} <span className="text-sm font-bold text-slate-500">dinar</span></p>
          <p className="text-xs text-slate-600 mt-1">Fee × cases managed</p>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
          <p className="text-[11px] font-black uppercase text-green-700">Doctor receives</p>
          <p className="text-3xl font-black text-green-800">{dinarFormat(doctorPortion)} <span className="text-sm font-bold text-slate-500">dinar</span></p>
          <p className="text-xs text-slate-600 mt-1">≈ {dinarFormat(doctorPerCase)} per case</p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
          <p className="text-[11px] font-black uppercase text-blue-700">Returned to government</p>
          <p className="text-3xl font-black text-blue-900">{dinarFormat(governmentPortion)} <span className="text-sm font-bold text-slate-500">dinar</span></p>
          <p className="text-xs text-slate-600 mt-1">Remainder after doctor share</p>
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-orange-300 tracking-wide">Scenario reminder</p>
          <p className="text-sm md:text-base font-semibold leading-relaxed text-slate-100">
            At 100 cases with a 4,000 dinar fee, total income is 400,000 dinar. Using an 83.75% doctor share yields 335,000 dinar for the doctor and 65,000 dinar returned to the government.
          </p>
        </div>
        <button
          onClick={resetToScenario}
          className="w-full md:w-auto bg-white text-slate-900 font-black px-4 py-3 rounded-xl border-2 border-slate-200 hover:bg-slate-100 active:scale-95 transition-all"
        >
          Apply this scenario
        </button>
      </div>
    </section>
  );
};

export default DoctorCaseCalculator;
