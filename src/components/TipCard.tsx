import { useState } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';

interface TipCardProps {
  icon: LucideIcon;
  title: string;
  currentClaim?: string;
  optimalClaim?: string;
  extraSavings?: number;
  body: string;
  legalBasis: string;
  action?: React.ReactNode;
  defaultExpanded?: boolean;
  missingData?: string;
}

export function TipCard({
  icon: Icon,
  title,
  currentClaim,
  optimalClaim,
  extraSavings,
  body,
  legalBasis,
  action,
  defaultExpanded = false,
  missingData,
}: TipCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-shadow hover:shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
            {extraSavings !== undefined && extraSavings > 0 && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                Save ${extraSavings.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
          {(currentClaim || optimalClaim) && (
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              {currentClaim && <span>Current: <span className="font-medium text-gray-700 dark:text-gray-300">{currentClaim}</span></span>}
              {optimalClaim && <span>Optimal: <span className="font-medium text-emerald-600 dark:text-emerald-400">{optimalClaim}</span></span>}
            </div>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          {extraSavings !== undefined && extraSavings > 0 && (
            <div className="py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Potential extra savings this year</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ${extraSavings.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}

          {missingData ? (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300">{missingData}</p>
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
              {body}
            </div>
          )}

          {action && !missingData && (
            <div className="mt-4">
              {action}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{legalBasis}</p>
          </div>
        </div>
      )}
    </div>
  );
}
