
import React, { useState, useEffect } from 'react';
import InputForm from './components/InputForm';
import ResultsDashboard from './components/ResultsDashboard';
import GeminiInsight from './components/GeminiInsight';
import DoctorCaseCalculator from './components/DoctorCaseCalculator';
import { calculateGrowth } from './services/calculationService';
import { GrowthCalculation, Sex, MeasurementMethod, UserInput, GrowthHormoneResult } from './types';

// Interface for the PWA install prompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DEFAULT_INPUT: UserInput = {
    ageYears: 2,
    ageMonths: 0,
    sex: Sex.Male,
    weightKg: 12.2,
    heightCm: 87,
    method: MeasurementMethod.Recumbent, // Default to Recumbent for <= 2 years
    motherHeightCm: undefined,
    fatherHeightCm: undefined,
    boneAgeYears: undefined,
    growthHormoneResult: GrowthHormoneResult.NotTested,
    ageDays: undefined,
    dob: undefined,
    measurementDate: undefined // Will be set to today inside InputForm useEffect if missing
};

const App: React.FC = () => {
  // --- State ---
  const [input, setInput] = useState<UserInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<GrowthCalculation | null>(null);

  // --- PWA Install State ---
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setCurrentUrl(window.location.href);
    }
    
    // 1. Check for iOS
    // Simple check: if it's an iPhone/iPad and NOT already in standalone mode
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // 2. Check if app is already installed (Standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (!isStandalone) {
       // 3. Handle Android/Desktop "Add to Home Screen" prompt
       const handleBeforeInstallPrompt = (e: Event) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        // Update UI notify the user they can install the PWA
        setIsInstallable(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // Show manual instructions for iOS (Share -> Add to Home Screen)
      setShowIOSInstructions(true);
    } else if (deferredPrompt) {
      // Show the install prompt for Android/Desktop
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleCalculate = () => {
    const res = calculateGrowth(input);
    setResult(res);
  };

  const handleReset = () => {
    setInput({
        ageYears: NaN,
        ageMonths: NaN,
        ageDays: undefined,
        sex: Sex.Male,
        weightKg: NaN,
        heightCm: NaN,
        method: MeasurementMethod.Recumbent,
        motherHeightCm: undefined,
        fatherHeightCm: undefined,
        boneAgeYears: undefined,
        growthHormoneResult: GrowthHormoneResult.NotTested,
        dob: '',
        measurementDate: '',
        previousHeightCm: undefined,
        intervalMonths: undefined
    });
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-12 font-sans selection:bg-blue-500 selection:text-white text-slate-100" style={{backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '32px 32px'}}>
       {/* --- Header --- */}
       <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-700 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-11 h-11 bg-white rounded-xl border-4 border-blue-600 flex items-center justify-center text-blue-700 font-black text-xl shadow-[0px_0px_15px_rgba(37,99,235,0.4)] transform hover:scale-105 transition-transform cursor-default">
               BG
             </div>
             <h1 className="text-2xl font-black text-white tracking-tight">BasharGrowth AI</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* QR Code Button for Mobile Sharing */}
            <button
                onClick={() => setShowQR(true)}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl border border-transparent hover:border-slate-700 transition-all"
                title="Open on Mobile"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4h-4v-2h4v-2h3v2m-3-2v6m0 0L8 18m5-6V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2v-2m2 6h.01M18 20h.01m0-2h.01M20 20h.01M20 18h.01" /></svg>
            </button>

            {/* Install Button (Only visible if installable or on iOS) */}
            {(isInstallable || isIOS) && (
                <button 
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold border border-blue-400 shadow-[0px_0px_10px_rgba(37,99,235,0.5)] active:scale-95 transition-all"
                >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span className="hidden sm:inline">Install</span>
                </button>
            )}
          </div>
        </div>
       </header>

       {/* --- Main Content --- */}
       <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">
           <DoctorCaseCalculator />
           <InputForm
              input={input}
              onChange={setInput}
              onCalculate={handleCalculate}
              onReset={handleReset}
           />

           {result && (
               <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-10">
                   <ResultsDashboard result={result} sex={input.sex} />
                   <GeminiInsight data={result} sex={input.sex} />
               </div>
           )}
       </main>

       {/* --- QR Code Modal --- */}
       {showQR && (
           <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
               <div className="bg-white p-8 rounded-[2rem] max-w-sm w-full text-center border-4 border-blue-600 shadow-[0px_0px_30px_rgba(37,99,235,0.3)]" onClick={e => e.stopPropagation()}>
                   <h3 className="text-2xl font-black text-slate-900 mb-4">Scan for Mobile</h3>
                   <div className="bg-white p-2 rounded-xl border-2 border-slate-100 inline-block mb-6 shadow-inner">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`} 
                            alt="QR Code" 
                            className="w-48 h-48 rounded-lg"
                        />
                   </div>
                   <p className="text-sm font-medium text-slate-600 mb-8">
                       Use your camera to open this app on your phone.
                   </p>
                   <button 
                        onClick={() => setShowQR(false)}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
                   >
                       Close
                   </button>
               </div>
           </div>
       )}

       {/* --- iOS Instructions Modal --- */}
       {showIOSInstructions && (
           <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowIOSInstructions(false)}>
               <div className="bg-white w-full sm:w-auto sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] p-8 pb-10 border-t-4 sm:border-4 border-blue-600 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-900">Install on iPhone/iPad</h3>
                        <button onClick={() => setShowIOSInstructions(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 text-slate-900">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <ol className="space-y-6 text-slate-700 font-medium">
                        <li className="flex items-start gap-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full border-2 border-blue-200 flex items-center justify-center font-black text-sm">1</span>
                            <span>Tap the <strong className="text-slate-900 bg-slate-100 px-1 rounded">Share</strong> button <svg className="w-5 h-5 inline mx-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> in your browser.</span>
                        </li>
                        <li className="flex items-start gap-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full border-2 border-blue-200 flex items-center justify-center font-black text-sm">2</span>
                            <span>Scroll down and select <strong className="text-slate-900 bg-slate-100 px-1 rounded">Add to Home Screen</strong>.</span>
                        </li>
                        <li className="flex items-start gap-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full border-2 border-blue-200 flex items-center justify-center font-black text-sm">3</span>
                            <span>Confirm by tapping <strong className="text-slate-900 bg-slate-100 px-1 rounded">Add</strong> in the top-right.</span>
                        </li>
                    </ol>
               </div>
           </div>
       )}
    </div>
  );
};

export default App;
