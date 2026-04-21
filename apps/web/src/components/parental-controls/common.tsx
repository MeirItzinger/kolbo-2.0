import React from 'react';

export function Toggle({ 
  checked, 
  onChange, 
  disabled = false 
}: { 
  checked: boolean; 
  onChange: (v: boolean) => void; 
  disabled?: boolean 
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`h-6 w-11 rounded-full transition-all shrink-0 ${
        checked ? 'bg-primary-500 shadow-[0_0_10px_rgba(var(--color-primary-500-rgb),0.3)]' : 'bg-surface-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function SectionHeader({ 
  title, 
  description, 
  badge 
}: { 
  title: string; 
  description?: string; 
  badge?: string 
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {badge && (
          <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] font-bold text-surface-400 border border-surface-700 uppercase">
            {badge}
          </span>
        )}
      </div>
      {description && <p className="text-sm text-surface-500 mt-1">{description}</p>}
    </div>
  );
}
