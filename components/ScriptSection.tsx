
import React from 'react';

interface ScriptSectionProps {
  title: string;
  content: string;
  color: string;
  onChange: (newText: string) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  minChars?: number;
  maxChars?: number;
}

const ScriptSection: React.FC<ScriptSectionProps> = ({ 
  title, 
  content, 
  color, 
  onChange, 
  onRegenerate,
  isRegenerating,
  minChars = 140,
  maxChars = 180
}) => {
  const charCount = content ? content.length : 0;
  
  // Logic kiểm tra độ dài theo yêu cầu động
  const isValid = charCount >= minChars && charCount <= maxChars;
  const isTooShort = charCount > 0 && charCount < minChars;
  const isTooLong = charCount > maxChars;

  return (
    <div className={`p-4 rounded-xl border-l-4 ${color} bg-white shadow-sm mb-4 group transition-all ${isValid ? 'ring-1 ring-green-100 bg-green-50/10' : ''}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
           <span className="text-xs text-slate-400">Click to edit</span>
        </div>
      </div>
      
      <div className="relative">
        <textarea
          className={`w-full text-slate-800 text-sm leading-relaxed font-semibold resize-y min-h-[180px] focus:outline-none focus:bg-slate-50 rounded p-2 -ml-2 bg-transparent border border-transparent hover:border-slate-200 transition-all ${isRegenerating ? 'opacity-30 pointer-events-none' : ''}`}
          value={content || ""}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Đang chờ kịch bản..."
        />
        {isRegenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-between items-center border-t border-slate-50 pt-2">
        {onRegenerate ? (
          <button 
            onClick={onRegenerate}
            disabled={isRegenerating}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-sm ${
              isValid 
              ? 'bg-slate-100 text-slate-500 hover:bg-orange-600 hover:text-white' 
              : 'bg-orange-600 text-white hover:bg-orange-700 animate-pulse'
            } disabled:opacity-50`}
          >
            <svg className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Tạo lại
          </button>
        ) : (
          <div className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter italic">
            {isValid ? 'Đạt mục tiêu ✓' : `Cần ${minChars}-${maxChars} ký tự`}
          </div>
        )}
        
        <span className={`text-xs px-2 py-1 rounded-full font-black tabular-nums transition-all ${
            isValid 
            ? 'bg-green-100 text-green-700' 
            : isTooLong || isTooShort 
                ? 'bg-red-100 text-red-600 animate-pulse' 
                : 'bg-slate-100 text-slate-500'
        }`}>
          {charCount} / {maxChars}
        </span>
      </div>
    </div>
  );
};

export default ScriptSection;
