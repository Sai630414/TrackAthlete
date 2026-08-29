import { useState } from 'react';
import RuleBreakdownCard from './RuleBreakdownCard';

const SPORT_ICONS = { Taekwondo: '🥋', Badminton: '🏸', 'Table Tennis': '🏓' };

export default function SportRankCard({ rank, result }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-5 mb-4 shadow-sm hover:shadow-md transition-all">
      <div
        className="flex justify-between items-center cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-[#e07050]">#{rank}</span>
          <span className="text-lg font-bold text-[#173235]">
            {SPORT_ICONS[result.sport] || '🏅'} {result.sport}
          </span>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold text-[#194e42]">{result.scoreRounded} <span className="text-xs font-normal text-[#697c7c]">/ 100</span></div>
          <div className="text-xs font-bold text-[#e07050] mt-0.5">{open ? 'Hide details ▲' : 'Why this score? ▼'}</div>
        </div>
      </div>

      <div className="mt-3.5 bg-[#e2eee4] rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full bg-[#e07050] rounded-full transition-all duration-500"
          style={{ width: `${Math.min(result.score, 100)}%` }}
        />
      </div>

      {open && (
        <div className="mt-4 pt-3 border-t border-[#d8ded5]/80 space-y-2">
          {Object.entries(result.rules).map(([key, rule]) => (
            <RuleBreakdownCard key={key} ruleKey={key} rule={rule} />
          ))}
        </div>
      )}
    </div>
  );
}
