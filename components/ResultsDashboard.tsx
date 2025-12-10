

import React from 'react';
import { GrowthCalculation, GrowthStandard, MetricResult, Sex, GrowthHormoneResult } from '../types';
import GrowthChart from './GrowthChart';
import * as DATA from '../services/growthData';

interface Props {
    result: GrowthCalculation;
    sex: Sex; // Need sex to pick dataset for charts
}

const MetricColumn: React.FC<{ metric: MetricResult; unit: string; colorTheme: 'blue' | 'pink' | 'emerald' | 'purple' }> = ({ metric, unit, colorTheme }) => {
    const colors = {
        blue: { text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', bg: 'bg-blue-50' },
        pink: { text: 'text-pink-600', badge: 'bg-pink-100 text-pink-700', bg: 'bg-pink-50' },
        emerald: { text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', bg: 'bg-emerald-50' },
        purple: { text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700', bg: 'bg-purple-50' },
    };
    
    const theme = colors[colorTheme];
    
    const getBadgeStyle = (z: number) => {
        const absZ = Math.abs(z);
        if (absZ > 2) return 'bg-red-100 text-red-700';
        return theme.badge;
    };

    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{metric.label.split('(')[0].trim()}</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getBadgeStyle(metric.zScore)}`}>
                    {metric.classification}
                </span>
            </div>
            
            <div className="flex items-baseline gap-1">
                <span className={`text-3xl lg:text-4xl font-black ${theme.text}`}>{metric.percentile.toFixed(1)}</span>
                <span className="text-xs font-bold text-slate-400">%ile</span>
            </div>

            <div className="mt-3 flex items-center gap-2">
                 <div className={`px-2 py-1.5 rounded-lg ${theme.bg} text-xs font-bold text-slate-600 min-w-[60px] text-center`}>
                    Z: {metric.zScore > 0 ? '+' : ''}{metric.zScore.toFixed(2)}
                 </div>
                 <div className="text-xs font-bold text-slate-500">
                    {metric.value} <span className="text-[10px] opacity-70 uppercase">{unit}</span>
                 </div>
            </div>
        </div>
    );
};

const ResultsDashboard: React.FC<Props> = ({ result, sex }) => {
    // Chart Visualization Logic
    const isInfant = result.ageMonths <= 36;
    const weightData = isInfant ? DATA.WHO_WEIGHT_AGE[sex] : DATA.CDC_WEIGHT_AGE[sex];
    const weightDomain: [number, number] = isInfant ? [0, 36] : [24, 240];
    const weightTitle = isInfant ? `Birth to 36 mo: ${sex === Sex.Male ? 'Boys' : 'Girls'} Weight` : `2 to 20 yr: ${sex === Sex.Male ? 'Boys' : 'Girls'} Weight`;

    const heightData = isInfant ? DATA.WHO_LENGTH_AGE[sex] : DATA.CDC_HEIGHT_AGE[sex];
    const heightDomain: [number, number] = isInfant ? [0, 36] : [24, 240];
    const heightLabel = isInfant ? 'Length (cm)' : 'Stature (cm)';
    const heightTitle = isInfant ? `Birth to 36 mo: ${sex === Sex.Male ? 'Boys' : 'Girls'} Length` : `2 to 20 yr: ${sex === Sex.Male ? 'Boys' : 'Girls'} Stature`;

    const xDisplayMode = isInfant ? 'months' : 'years';
    const ageXLabel = isInfant ? "AGE (MONTHS)" : "AGE (YEARS)";

    const thirdMetric = result.metrics.bmiForAge || result.metrics.weightForLength;

    // Helper to format exact age
    const formatExactAge = (data: GrowthCalculation) => {
        const totalDays = data.exactAgeDays;
        
        // If we don't have exact days for some reason (backward compatibility), fall back to months
        if (totalDays === undefined) {
             const y = Math.floor(data.ageMonths / 12);
             const m = Math.floor(data.ageMonths % 12);
             return `${y}y ${m}m`;
        }

        const days = Math.floor(totalDays);
        if (days < 30) return `${days}d`;
        
        const years = Math.floor(days / 365.25);
        const remDays = days % 365.25;
        const months = Math.floor(remDays / 30.4375);
        const finalDays = Math.floor(remDays % 30.4375);

        if (years === 0) return `${months}m ${finalDays}d`;
        
        // Compact display for years to fit UI
        return `${years}y ${months}m ${finalDays}d`;
    };

    return (
        <div className="space-y-8">
            
            {/* Unified Summary Card (The "Single Organized Button") */}
            <div className="bg-white rounded-[2.5rem] p-8 border-4 border-slate-900 shadow-[8px_8px_0px_0px_#1e293b] hover:shadow-[12px_12px_0px_0px_#1e293b] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-300 cursor-default relative overflow-hidden">
                
                {/* Decorative Background Blob */}
                <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-5 ${sex === Sex.Male ? 'bg-blue-600' : 'bg-pink-600'} blur-3xl pointer-events-none`}></div>

                {/* Header Section inside Card */}
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6 mb-8 pb-8 border-b-2 border-slate-100 relative z-10">
                    <div className="flex items-center gap-5">
                         <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm border-2 border-slate-100 ${sex === Sex.Male ? 'bg-blue-50' : 'bg-pink-50'} text-orange-500`}>
                             {sex === Sex.Male ? '♂' : '♀'}
                         </div>
                         <div>
                             <h2 className="text-2xl font-black text-slate-900 tracking-tight">Growth Report</h2>
                             <div className="flex items-center gap-2 mt-1.5">
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border border-slate-200">
                                    {result.standardUsed} Standard
                                </span>
                                <span className="bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                                    {result.ageYears.toFixed(1)} years
                                </span>
                             </div>
                         </div>
                     </div>
                     
                     <div className="flex items-center gap-4">
                         {/* Optional Velocity Highlight in Header */}
                         {result.growthVelocity !== undefined && (
                             <div className="text-right hidden sm:block">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Velocity</div>
                                 <div className="text-xl font-black text-slate-800">{result.growthVelocity.toFixed(1)} <span className="text-xs text-slate-400">cm/yr</span></div>
                             </div>
                         )}
                         <div className="text-right">
                             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Exact Age</div>
                             <div className="text-lg sm:text-xl font-black text-slate-800 whitespace-nowrap">{formatExactAge(result)}</div>
                         </div>
                     </div>
                </div>

                {/* Metrics Grid Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative z-10">
                     {/* Weight */}
                     <MetricColumn 
                        metric={result.metrics.weightForAge} 
                        unit="kg"
                        colorTheme={sex === Sex.Male ? 'blue' : 'pink'} 
                     />
                     
                     {/* Divider (Desktop) */}
                     <div className="hidden md:block absolute left-1/3 top-2 bottom-2 w-px bg-slate-100 -ml-6"></div>

                     {/* Height */}
                     <MetricColumn 
                        metric={result.metrics.heightForAge} 
                        unit="cm"
                        colorTheme="emerald" 
                     />

                     {/* Divider (Desktop) */}
                     {thirdMetric && <div className="hidden md:block absolute left-2/3 top-2 bottom-2 w-px bg-slate-100 -ml-6"></div>}

                     {/* BMI or WFL */}
                     {thirdMetric ? (
                         <MetricColumn 
                            metric={thirdMetric} 
                            unit={thirdMetric.label.includes('BMI') ? 'kg/m²' : 'kg'}
                            colorTheme="purple" 
                         />
                     ) : (
                         <div className="flex flex-col justify-center items-center h-full text-center p-4 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                             <span className="text-xs font-bold text-slate-400">No BMI/WFL Data</span>
                         </div>
                     )}
                 </div>
            </div>

            {/* Detailed Analysis Section (MPH, Bone Age) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* MPH */}
                {result.mph && (
                    <div className="bg-white p-6 rounded-[2rem] border-4 border-purple-200 shadow-[6px_6px_0px_0px_#f3e8ff]">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xs font-black text-purple-900/40 uppercase tracking-widest">Target Height (MPH)</h3>
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-purple-200">
                                Genetic
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-800">{result.mph.toFixed(1)}</span>
                            <span className="text-sm font-bold text-slate-400">cm</span>
                        </div>
                        <div className="mt-4 text-xs font-semibold text-purple-800 bg-purple-50 p-3 rounded-xl border border-purple-100 flex justify-between">
                             <span>Target Range</span>
                             <span>{result.mphRange?.[0].toFixed(1)} - {result.mphRange?.[1].toFixed(1)} cm</span>
                        </div>
                    </div>
                )}

                {/* Endocrine Status Box */}
                <div className="bg-white p-6 rounded-[2rem] border-4 border-slate-200 shadow-[6px_6px_0px_0px_#e2e8f0] flex flex-col gap-4 justify-center">
                    {/* Bone Age */}
                    {result.boneAgeAnalysis ? (
                        <div className={`${result.boneAgeAnalysis.isFlagged ? 'bg-red-50 border-red-200 text-red-900' : 'bg-indigo-50 border-indigo-200 text-indigo-900'} p-4 rounded-2xl border-2 transition-colors`}>
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-[10px] font-black uppercase tracking-wider opacity-70">Bone Age</h4>
                                <div className="text-xl font-black">{result.boneAgeAnalysis.boneAge.toFixed(1)}y</div>
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="text-xs font-bold leading-tight max-w-[70%]">{result.boneAgeAnalysis.interpretation}</div>
                                <div className="text-[10px] font-bold opacity-60 bg-white/50 px-1.5 py-0.5 rounded">{result.boneAgeAnalysis.diffYears > 0 ? '+' : ''}{result.boneAgeAnalysis.diffYears.toFixed(1)}y</div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 border-dashed text-slate-400 text-sm font-bold flex justify-between items-center">
                            <span>Bone Age</span>
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded">Not Entered</span>
                        </div>
                    )}

                    {/* GH Result */}
                    <div className={`${result.growthHormoneResult === GrowthHormoneResult.Low ? 'bg-red-50 border-red-200 text-red-900' : (result.growthHormoneResult === GrowthHormoneResult.Normal ? 'bg-green-50 border-green-200 text-green-900' : 'bg-slate-50 border-slate-200 text-slate-500')} p-4 rounded-2xl border-2`}>
                         <div className="flex justify-between items-center">
                             <h4 className="text-[10px] font-black uppercase tracking-wider opacity-70">GH Test</h4>
                             <span className="font-bold text-sm">
                                {result.growthHormoneResult || 'Not Tested'}
                             </span>
                         </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div>
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)]">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                    </div>
                    Clinical Growth Charts
                </h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <GrowthChart 
                        title={weightTitle}
                        data={weightData}
                        userX={result.ageMonths}
                        userY={result.metrics.weightForAge.value}
                        userMetric={result.metrics.weightForAge}
                        xDomain={weightDomain}
                        xLabel={ageXLabel}
                        yLabel="WEIGHT (kg)"
                        sex={sex}
                        xDisplayMode={xDisplayMode}
                    />
                    <GrowthChart 
                        title={heightTitle}
                        data={heightData}
                        userX={result.ageMonths}
                        userY={result.metrics.heightForAge.value}
                        userMetric={result.metrics.heightForAge}
                        xDomain={heightDomain}
                        xLabel={ageXLabel}
                        yLabel={heightLabel.toUpperCase()}
                        sex={sex}
                        xDisplayMode={xDisplayMode}
                        mph={result.mph}
                        mphRange={result.mphRange}
                        boneAgeMonths={result.boneAgeAnalysis?.boneAge ? result.boneAgeAnalysis.boneAge * 12 : undefined}
                    />
                </div>
            </div>
        </div>
    );
};

export default ResultsDashboard;