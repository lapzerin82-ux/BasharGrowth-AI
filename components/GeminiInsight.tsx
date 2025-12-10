import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GrowthCalculation, Sex } from '../types';

interface Props {
    data: GrowthCalculation;
    sex: Sex;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const GeminiInsight: React.FC<Props> = ({ data, sex }) => {
    const [insight, setInsight] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Chat State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Reset whenever data changes
    useEffect(() => {
        setInsight("");
        setError(null);
        setChatMessages([]);
        setChatInput("");
    }, [data]);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatMessages, chatLoading]);

    const cleanMarkdown = (text: string) => text.replace(/\*\*/g, '').replace(/__/g, '');

    const generateInsight = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                throw new Error("API Key not configured");
            }

            const ai = new GoogleGenAI({ apiKey });

            const formattedAge = parseFloat(data.ageYears.toFixed(1));

            const prompt = `
            Role: Expert Clinical Auxologist and Pediatric Endocrinologist.
            Task: Generate a concise, numbered clinical summary for a physician's medical record based on the patient's growth metrics.
            
            Patient Data:
            - Age: ${formattedAge} years
            - Sex: ${sex}
            - Standard: ${data.standardUsed}
            
            Metrics:
            - Weight-for-Age: Z=${data.metrics.weightForAge.zScore.toFixed(2)} (${data.metrics.weightForAge.percentile.toFixed(1)}%ile)
            - Height-for-Age: Z=${data.metrics.heightForAge.zScore.toFixed(2)} (${data.metrics.heightForAge.percentile.toFixed(1)}%ile)
            ${data.metrics.bmiForAge ? `- BMI-for-Age: Z=${data.metrics.bmiForAge.zScore.toFixed(2)} (${data.metrics.bmiForAge.percentile.toFixed(1)}%ile)` : ''}
            ${data.metrics.weightForLength ? `- Weight-for-Length/Height: Z=${data.metrics.weightForLength.zScore.toFixed(2)} (${data.metrics.weightForLength.percentile.toFixed(1)}%ile)` : ''}
            ${data.mph ? `- Mid-Parental Height (MPH): ${data.mph.toFixed(1)} cm (Target Range: ${data.mphRange?.[0].toFixed(1)} - ${data.mphRange?.[1].toFixed(1)} cm)` : ''}
            ${data.boneAgeAnalysis ? `- Bone Age: ${data.boneAgeAnalysis.boneAge.toFixed(1)}y (Diff: ${data.boneAgeAnalysis.diffPercent.toFixed(1)}% - ${data.boneAgeAnalysis.interpretation})` : ''}
            ${data.growthHormoneResult ? `- Growth Hormone Test Result: ${data.growthHormoneResult}` : ''}
            ${data.growthVelocity ? `- Calculated Growth Velocity: ${data.growthVelocity.toFixed(1)} cm/year` : '- Growth Velocity: Not available (single measurement)'}

            Reference Clinical Knowledge (Dr. Bashar Ibrahim's Practical Tricks 2025):
            
            1. Definitions: 
               - Short Stature: Height < -2 SD (<2.3rd %ile).
               - Extreme Short Stature: Height <= -2.5 SD (<0.6th %ile).
               
            2. Growth Velocity "Red Flags" (Pathologic if below):
               - 2-4 years: < 5.5 cm/year
               - 4-6 years: < 5.0 cm/year
               - >6y to Puberty: Boys < 4 cm/year; Girls < 4.5 cm/year.
               - IMPORTANT: If velocity is present and below these cutoffs, flag it immediately as a primary concern.
               
            3. The "Weight-for-Height" Filter (Crucial for Etiology):
               - Short + High Weight (Stout) → Endocrine causes (Hypothyroidism, GHD, Cushing).
               - Short + Low Weight (Thin) → Systemic causes (Malnutrition, Celiac, Renal, IBD).
               
            4. Bone Age (BA) Interpretation:
               - Significant deviation: >= 20% difference from chronological age.
               - BA = CA: Familial Short Stature.
               - BA < CA (Delayed): CDGP (Constitutional Delay) or Endocrine/Systemic pathology.
               - BA > CA (Advanced): Precocious Puberty, Hyperthyroidism, Obesity.
            
            Requirements:
            1. Format: Strictly use a numbered list (1., 2., 3., etc.).
            2. Style: Plain text only. No markdown.
            3. Length: Short, high-yield points only (maximum 4-5 points).
            4. Tone: Strictly academic and clinical.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
            });
            
            setInsight(cleanMarkdown(response.text || "No clinical insight generated."));
        } catch (err) {
            console.error(err);
            setError("Could not generate clinical analysis. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendChat = async () => {
        if (!chatInput.trim()) return;
        const userMsg = chatInput.trim();
        setChatInput("");
        setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatLoading(true);

        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) throw new Error("API Key not configured");
            const ai = new GoogleGenAI({ apiKey });

             const systemContext = `
            You are Dr. BasharGrowth AI, an expert pediatric endocrinology assistant.
            You are discussing a patient with the following data:
            - Age: ${parseFloat(data.ageYears.toFixed(1))}y
            - Sex: ${sex}
            - Weight Z: ${data.metrics.weightForAge.zScore.toFixed(2)} (${data.metrics.weightForAge.percentile.toFixed(1)}%ile)
            - Height Z: ${data.metrics.heightForAge.zScore.toFixed(2)} (${data.metrics.heightForAge.percentile.toFixed(1)}%ile)
            ${data.growthVelocity ? `- Velocity: ${data.growthVelocity.toFixed(1)} cm/yr` : ''}
            
            Current Clinical Report context:
            ${insight}

            Answer concisely and professionally. Plain text only.
            `;

            let historyText = chatMessages.map(m => `${m.role === 'user' ? 'User' : 'Model'}: ${m.text}`).join('\n');
            historyText += `\nUser: ${userMsg}\nModel:`;

            const fullPrompt = `${systemContext}\n\nChat History:\n${historyText}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
            });

            const reply = response.text || "I couldn't generate a response.";
            setChatMessages(prev => [...prev, { role: 'model', text: cleanMarkdown(reply) }]);

        } catch (err) {
            console.error(err);
            setChatMessages(prev => [...prev, { role: 'model', text: "Error connecting to AI assistant." }]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendChat();
        }
    };

    return (
        <div className="space-y-8 mt-8">
            {/* Main Clinical Report Card */}
            <div className="bg-white rounded-[2rem] p-8 border-4 border-violet-100 shadow-[8px_8px_0px_0px_#ede9fe]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center border-2 border-orange-500 text-orange-600">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        </div>
                        Clinical Growth Analysis
                    </h3>
                    {!insight && !loading && (
                        <button 
                            onClick={generateInsight}
                            className="text-sm font-bold bg-slate-900 text-white px-5 py-3 rounded-xl hover:bg-slate-800 shadow-[3px_3px_0px_0px_#000] active:translate-y-[1px] active:shadow-none transition-all"
                        >
                            Generate Report
                        </button>
                    )}
                </div>

                {loading && (
                    <div className="flex items-center justify-center gap-4 text-violet-600 font-bold p-8 bg-violet-50/50 rounded-2xl border-2 border-dashed border-violet-200">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 bg-violet-600 rounded-full animate-bounce"></div>
                            <div className="w-3 h-3 bg-violet-600 rounded-full animate-bounce delay-75"></div>
                            <div className="w-3 h-3 bg-violet-600 rounded-full animate-bounce delay-150"></div>
                        </div>
                        Generating academic assessment...
                    </div>
                )}

                {error && (
                    <p className="text-sm font-bold text-red-600 bg-red-50 p-4 rounded-xl border-2 border-red-100">{error}</p>
                )}

                {insight && (
                    <>
                        <div className="bg-gradient-to-br from-violet-50 to-white p-6 rounded-2xl border-2 border-violet-100">
                            <div className="prose prose-sm prose-slate max-w-none">
                                <div className="text-slate-800 font-semibold text-sm whitespace-pre-wrap leading-relaxed font-sans">
                                    {insight}
                                </div>
                            </div>
                            <div className="mt-6 flex items-center gap-2 border-t-2 border-violet-100 pt-3">
                                <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">BI</div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    Generated by Dr. Bashar Ibrahim Al-Mizuri
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Interactive Chat (Visible only after report generation) */}
            {insight && (
                <div className="bg-white rounded-[2rem] border-4 border-blue-100 shadow-[8px_8px_0px_0px_#dbeafe] overflow-hidden flex flex-col">
                    <div className="bg-blue-50/50 p-5 border-b-2 border-blue-100 flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse ring-4 ring-green-100"></div>
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-wide">Ask Dr. Bashar AI</h4>
                    </div>
                    
                    <div className="p-6 bg-[#FAFAFA] min-h-[250px] max-h-[450px] overflow-y-auto space-y-6">
                        {chatMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                <p className="text-sm font-bold">Ask follow-up questions...</p>
                            </div>
                        )}
                        
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-5 py-3.5 text-sm font-medium shadow-sm ${
                                    msg.role === 'user' 
                                        ? 'bg-blue-600 text-white rounded-[1.5rem] rounded-tr-none' 
                                        : 'bg-white border-2 border-slate-100 text-slate-700 rounded-[1.5rem] rounded-tl-none'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border-2 border-slate-100 px-5 py-4 rounded-[1.5rem] rounded-tl-none shadow-sm flex gap-2 items-center">
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-100"></div>
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-200"></div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef}></div>
                    </div>

                    <div className="p-4 bg-white border-t-2 border-slate-100 flex gap-3">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your question here..."
                            className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-3 text-sm font-medium focus:ring-0 focus:border-blue-500 focus:bg-white outline-none transition-all"
                            disabled={chatLoading}
                        />
                        <button
                            onClick={handleSendChat}
                            disabled={!chatInput.trim() || chatLoading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white p-3 rounded-2xl transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-[1px]"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeminiInsight;