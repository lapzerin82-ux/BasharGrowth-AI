import React, { useState, useEffect } from 'react';
import { MeasurementMethod, Sex, UserInput, GrowthHormoneResult } from '../types';

interface Props {
    input: UserInput;
    onChange: (input: UserInput) => void;
    onCalculate: () => void;
    onReset: () => void;
}

const InputForm: React.FC<Props> = ({ input, onChange, onCalculate, onReset }) => {
    
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [useDays, setUseDays] = useState(input.ageDays !== undefined);

    useEffect(() => {
        if (!input.measurementDate) {
            onChange({ ...input, measurementDate: new Date().toISOString().split('T')[0] });
        }
    }, []);

    const handleChange = (field: keyof UserInput, value: any) => {
        let safeValue = value;
        // Limit numeric inputs to reasonable ranges to prevent UI overflow/logical errors
        if (typeof value === 'number' && !isNaN(value)) {
            if (value < 0) safeValue = 0;
            // Clinical safeguards
            if (field === 'weightKg' && value > 300) safeValue = 300; 
            if (field === 'heightCm' && value > 280) safeValue = 280; 
            if (field === 'motherHeightCm' && value > 250) safeValue = 250;
            if (field === 'fatherHeightCm' && value > 250) safeValue = 250;
            if (field === 'boneAgeYears' && value > 25) safeValue = 25;
            if (field === 'previousHeightCm' && value > 280) safeValue = 280;
            if (field === 'intervalMonths' && value > 120) safeValue = 120;
        }
        onChange({ ...input, [field]: safeValue });
    };

    const updateMethodBasedOnAge = (years: number, months: number) => {
        const totalMonths = (years * 12) + months;
        return totalMonths <= 24 ? MeasurementMethod.Recumbent : MeasurementMethod.Standing;
    };

    const handleYearChange = (val: number) => {
        let safeVal = isNaN(val) ? 0 : val;
        // Strict age limits (0-20 years)
        if (safeVal < 0) safeVal = 0;
        if (safeVal > 20) safeVal = 20;

        const newMethod = updateMethodBasedOnAge(safeVal, input.ageMonths);
        onChange({ ...input, ageYears: safeVal, method: newMethod, dob: undefined, ageDays: undefined });
        setUseDays(false);
    };

    const handleMonthChange = (val: number) => {
        let safeVal = isNaN(val) ? 0 : val;
        // Strict month limits (0-11 months)
        if (safeVal < 0) safeVal = 0;
        if (safeVal > 11) safeVal = 11;

        const newMethod = updateMethodBasedOnAge(input.ageYears, safeVal);
        onChange({ ...input, ageMonths: safeVal, method: newMethod, dob: undefined, ageDays: undefined });
        setUseDays(false);
    };

    const handleDateChange = (field: 'dob' | 'measurementDate', value: string) => {
        const newInput = { ...input, [field]: value };
        const dob = field === 'dob' ? value : input.dob;
        const measDate = field === 'measurementDate' ? value : (input.measurementDate || new Date().toISOString().split('T')[0]);

        if (dob && measDate) {
            const d1 = new Date(dob);
            const d2 = new Date(measDate);
            
            if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                const diffTime = d2.getTime() - d1.getTime();
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                
                let months = (d2.getFullYear() - d1.getFullYear()) * 12;
                months -= d1.getMonth();
                months += d2.getMonth();
                if (d2.getDate() < d1.getDate()) months--;
                
                // Enforce 20 year limit on date calculation
                const ageY = Math.max(0, Math.floor(months / 12));
                
                if (ageY > 20) {
                     // If calculated age > 20, just keep inputs but don't crash logic, 
                     // or optionally reset. Here we clamp the logical age but allow the date.
                }

                const ageM = Math.max(0, months % 12);
                
                newInput.ageYears = ageY > 20 ? 20 : ageY;
                newInput.ageMonths = ageY > 20 ? 0 : ageM;
                newInput.method = updateMethodBasedOnAge(ageY, ageM);
                
                if (diffDays >= 0) {
                    newInput.ageDays = diffDays;
                } else {
                    newInput.ageDays = undefined;
                }
            }
        }
        onChange(newInput);
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-[8px_8px_0px_0px_#60a5fa] border-4 border-blue-600">
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center border-2 border-orange-500 text-orange-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                Child Details
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Age & Sex Section */}
                <div className="col-span-1 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Sex</label>
                        <div className="flex gap-4">
                            <button 
                                className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 transition-all ${input.sex === Sex.Male ? 'bg-blue-100 border-blue-500 text-blue-700 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-blue-300'}`}
                                onClick={() => handleChange('sex', Sex.Male)}
                            >
                                Male <span className="text-orange-500 ml-1 text-lg">♂</span>
                            </button>
                            <button 
                                className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 transition-all ${input.sex === Sex.Female ? 'bg-pink-100 border-pink-500 text-pink-700 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-pink-300'}`}
                                onClick={() => handleChange('sex', Sex.Female)}
                            >
                                Female <span className="text-orange-500 ml-1 text-lg">♀</span>
                            </button>
                        </div>
                    </div>

                    {/* Dark Blue Age Section */}
                    <div className="bg-slate-800 p-5 rounded-2xl border-2 border-slate-700 shadow-inner">
                         <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-bold text-slate-300 uppercase tracking-wide">Age</label>
                            <div className="flex gap-2 text-xs">
                                <button onClick={() => setUseDays(false)} className={`px-2 py-1 rounded-lg font-bold transition-all ${!useDays ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-slate-700'}`}>Y/M</button>
                                <button onClick={() => setUseDays(true)} className={`px-2 py-1 rounded-lg font-bold transition-all ${useDays ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-slate-700'}`}>Exact</button>
                            </div>
                         </div>
                         
                         {useDays || input.ageDays !== undefined ? (
                             <div className="space-y-3">
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Date of Birth</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-900 border-2 border-slate-600 text-white rounded-xl px-4 py-2 font-bold focus:border-orange-500 focus:ring-0 outline-none transition-all"
                                        value={input.dob || ''}
                                        onChange={(e) => handleDateChange('dob', e.target.value)}
                                    />
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Measurement Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-900 border-2 border-slate-600 text-white rounded-xl px-4 py-2 font-bold focus:border-orange-500 focus:ring-0 outline-none transition-all"
                                        value={input.measurementDate || ''}
                                        onChange={(e) => handleDateChange('measurementDate', e.target.value)}
                                    />
                                 </div>
                                 {input.ageDays !== undefined && (
                                     <div className="text-right text-xs font-bold text-orange-400 mt-1">
                                         Calc: {input.ageYears}y {input.ageMonths}m
                                     </div>
                                 )}
                             </div>
                         ) : (
                             <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Years (Max 20)</label>
                                    <input 
                                        type="number" 
                                        min="0" max="20"
                                        className="w-full bg-slate-900 border-2 border-slate-600 text-white rounded-xl px-4 py-3 font-black text-lg focus:border-orange-500 focus:ring-0 outline-none transition-all"
                                        placeholder="0"
                                        value={isNaN(input.ageYears) ? '' : input.ageYears}
                                        onChange={(e) => handleYearChange(parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Months (0-11)</label>
                                    <input 
                                        type="number" 
                                        min="0" max="11"
                                        className="w-full bg-slate-900 border-2 border-slate-600 text-white rounded-xl px-4 py-3 font-black text-lg focus:border-orange-500 focus:ring-0 outline-none transition-all"
                                        placeholder="0"
                                        value={isNaN(input.ageMonths) ? '' : input.ageMonths}
                                        onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                                    />
                                </div>
                             </div>
                         )}
                    </div>
                </div>

                {/* Measurements Section */}
                <div className="col-span-1 space-y-6">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Weight (kg)</label>
                            <input 
                                type="number" step="0.1" min="0" max="300"
                                className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-black text-xl focus:border-blue-500 focus:bg-white outline-none transition-all"
                                placeholder="0.0"
                                value={isNaN(input.weightKg) ? '' : input.weightKg}
                                onChange={(e) => handleChange('weightKg', parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Height (cm)</label>
                            <input 
                                type="number" step="0.1" min="0" max="280"
                                className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-black text-xl focus:border-blue-500 focus:bg-white outline-none transition-all"
                                placeholder="0.0"
                                value={isNaN(input.heightCm) ? '' : input.heightCm}
                                onChange={(e) => handleChange('heightCm', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>

                    <div>
                         <label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Method</label>
                         <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                             <button
                                onClick={() => handleChange('method', MeasurementMethod.Recumbent)}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${input.method === MeasurementMethod.Recumbent ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                             >
                                 Recumbent (Lying)
                             </button>
                             <button
                                onClick={() => handleChange('method', MeasurementMethod.Standing)}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${input.method === MeasurementMethod.Standing ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                             >
                                 Standing
                             </button>
                         </div>
                    </div>
                    
                    {/* Advanced Toggle */}
                    <div className="pt-2">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            <span>Advanced (Parents, Bone Age, GH)</span>
                            <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Advanced Section */}
            {showAdvanced && (
                <div className="mt-6 pt-6 border-t-2 border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                     <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Parental Heights (cm)</label>
                        <div className="flex gap-4">
                            <input 
                                type="number" min="0" max="250"
                                placeholder="Mother"
                                className="flex-1 bg-pink-50 border-2 border-pink-100 text-slate-800 rounded-xl px-3 py-2 font-bold focus:border-pink-300 outline-none"
                                value={input.motherHeightCm || ''}
                                onChange={(e) => handleChange('motherHeightCm', parseFloat(e.target.value))}
                            />
                            <input 
                                type="number" min="0" max="250"
                                placeholder="Father"
                                className="flex-1 bg-blue-50 border-2 border-blue-100 text-slate-800 rounded-xl px-3 py-2 font-bold focus:border-blue-300 outline-none"
                                value={input.fatherHeightCm || ''}
                                onChange={(e) => handleChange('fatherHeightCm', parseFloat(e.target.value))}
                            />
                        </div>
                     </div>
                     <div className="space-y-4">
                         <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Bone Age (Years)</label>
                            <input 
                                type="number" step="0.1" min="0" max="25"
                                placeholder="e.g. 4.5"
                                className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-xl px-3 py-2 font-bold focus:border-purple-300 outline-none"
                                value={input.boneAgeYears || ''}
                                onChange={(e) => handleChange('boneAgeYears', parseFloat(e.target.value))}
                            />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Growth Hormone Test</label>
                            <select 
                                className="w-full bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-xl px-3 py-2 font-bold focus:border-slate-300 outline-none"
                                value={input.growthHormoneResult || GrowthHormoneResult.NotTested}
                                onChange={(e) => handleChange('growthHormoneResult', e.target.value)}
                            >
                                <option value={GrowthHormoneResult.NotTested}>Not Tested</option>
                                <option value={GrowthHormoneResult.Normal}>Normal</option>
                                <option value={GrowthHormoneResult.Low}>Low (Deficiency)</option>
                            </select>
                         </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Previous Height (Velocity)</label>
                        <div className="flex gap-4">
                            <input 
                                type="number" placeholder="Prev Ht (cm)" min="0" max="280"
                                className="flex-1 bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-xl px-3 py-2 font-bold focus:border-slate-300 outline-none"
                                value={input.previousHeightCm || ''}
                                onChange={(e) => handleChange('previousHeightCm', parseFloat(e.target.value))}
                            />
                            <input 
                                type="number" placeholder="Months Ago" min="0" max="120"
                                className="flex-1 bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-xl px-3 py-2 font-bold focus:border-slate-300 outline-none"
                                value={input.intervalMonths || ''}
                                onChange={(e) => handleChange('intervalMonths', parseFloat(e.target.value))}
                            />
                        </div>
                     </div>
                </div>
            )}

            <div className="mt-8 flex gap-4">
                <button 
                    onClick={onReset}
                    className="px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                    Reset
                </button>
                <button 
                    onClick={onCalculate}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-lg shadow-[0px_4px_0px_0px_#1e40af] active:shadow-none active:translate-y-[4px] transition-all py-4 flex items-center justify-center gap-2"
                >
                    Calculate Growth
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
            </div>
        </div>
    );
};

export default InputForm;