export default function RuleBreakdownCard({ ruleKey, rule }) {
  const evidenceLines = Object.entries(rule.evidence || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );

  return (
    <div className="bg-[#e2eee4]/60 border border-[#2f6d5a]/30 rounded-xl p-3.5 mb-2.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold text-[#173235] tracking-wide">{rule.label}</span>
        <span className="text-xs font-extrabold text-[#e07050] bg-white px-2 py-0.5 rounded-md border border-[#d8ded5]">
          {rule.points.toFixed(2)} / {rule.weight}
        </span>
      </div>
      {evidenceLines.length > 0 && (
        <ul className="text-xs text-[#526668] font-medium list-disc list-inside space-y-0.5 mt-1.5 pt-1.5 border-t border-[#2f6d5a]/15">
          {evidenceLines.map(([k, v]) => (
            <li key={k}>
              <strong className="text-[#194e42]">{k}:</strong> {String(v)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
