'use client';

import type { CoEExplanation } from '@/lib/rules/coe';

type CoEExplanationCardProps = {
  coe: CoEExplanation;
  variant?: 'compact' | 'detailed';
  className?: string;
};

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function deltaTone(value: number): string {
  if (value > 0.03) return 'bg-emerald-100 text-emerald-700';
  if (value < -0.03) return 'bg-rose-100 text-rose-700';
  return 'bg-gray-100 text-gray-600';
}

export function CoEExplanationCard({
  coe,
  variant = 'compact',
  className = '',
}: CoEExplanationCardProps) {
  return (
    <div className={`rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-indigo-700">CoE 感情変化の説明</p>
        <div className="flex gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${deltaTone(coe.delta.pleasure)}`}
          >
            P {formatSigned(coe.delta.pleasure)}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${deltaTone(coe.delta.arousal)}`}
          >
            A {formatSigned(coe.delta.arousal)}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${deltaTone(coe.delta.dominance)}`}
          >
            D {formatSigned(coe.delta.dominance)}
          </span>
        </div>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-indigo-900">{coe.summary}</p>

      {coe.intentReason && (
        <p className="mt-2 rounded bg-white/70 px-2 py-1 text-[11px] text-gray-700">
          Planner意図: {coe.intentReason}
        </p>
      )}

      {coe.topDrivers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {coe.topDrivers.map((driver, index) => (
            <span key={`${driver.axis}-${driver.factorKey}-${index}`} className="rounded bg-white px-2 py-0.5 text-[10px] text-gray-700">
              {driver.axisShortLabel}・{driver.factorLabel} {formatSigned(driver.contribution)}
            </span>
          ))}
        </div>
      )}

      {variant === 'detailed' && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {coe.axisSummaries.map((axis) => (
            <div key={axis.axis} className="rounded border border-white bg-white p-2">
              <p className="text-[11px] font-semibold text-gray-700">
                {axis.axisShortLabel} ({axis.axisLabel})
              </p>
              <p className="mt-0.5 text-[11px] font-mono text-gray-500">
                {axis.before.toFixed(2)} → {axis.after.toFixed(2)} ({formatSigned(axis.delta)})
              </p>
              <div className="mt-1.5 space-y-1">
                {axis.topDrivers.map((driver, index) => (
                  <p key={`${axis.axis}-${driver.factorKey}-${index}`} className="text-[10px] text-gray-600">
                    {driver.factorLabel}: {formatSigned(driver.contribution)}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
