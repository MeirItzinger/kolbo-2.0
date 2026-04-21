import React from 'react';
import { Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Toggle } from './common';
import type { ParentalControls } from '@/api/profiles';

export function ContentFiltersSection({ 
  value, 
  onChange 
}: { 
  value: ParentalControls['contentFilters']; 
  onChange: (v: ParentalControls['contentFilters']) => void; 
}) {
  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
           <Shield className="h-5 w-5 text-primary-400" />
           Content Filters
        </CardTitle>
        <CardDescription>Apply general content restrictions platform-wide</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-surface-800">
        <div className="flex items-center justify-between py-4 group">
          <div>
            <p className="text-white font-medium group-hover:text-primary-400 transition-colors">Kol Isha</p>
            <p className="text-sm text-surface-500">Filter content with female singing (applied automatically for kids)</p>
          </div>
          <Toggle
            checked={value.kolIsha}
            onChange={() => onChange({ ...value, kolIsha: !value.kolIsha })}
          />
        </div>
        <div className="flex items-center justify-between py-4 group">
          <div>
            <p className="text-white font-medium group-hover:text-primary-400 transition-colors">Women Only</p>
            <p className="text-sm text-surface-500">Enable women-only filter for the current profile</p>
          </div>
          <Toggle
            checked={value.womenOnly}
            onChange={() => onChange({ ...value, womenOnly: !value.womenOnly })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

const AGE_RATINGS = [
  { key: 'G', label: 'TV-G', desc: 'General Audience' },
  { key: 'PG', label: 'TV-PG', desc: 'Parental Guidance' },
  { key: 'PG-13', label: 'TV-14', desc: 'Parents Strongly Cautioned' },
  { key: 'R', label: 'TV-MA', desc: 'Mature Audiences Only' },
];

export function AgeRatingSection({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle>Maturity Rating Cap</CardTitle>
        <CardDescription>Videos with a higher rating than this will be hidden from this profile</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            onClick={() => onChange(null)}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center ${
              value === null 
                ? 'bg-primary-500/10 border-primary-500 shadow-[0_0_15px_rgba(var(--color-primary-500-rgb),0.1)]' 
                : 'bg-surface-800/40 border-surface-800 hover:border-surface-700'
            }`}
          >
            <span className={`text-sm font-bold ${value === null ? 'text-primary-400' : 'text-white'}`}>No limit</span>
            <span className="text-[10px] text-surface-500 mt-1 uppercase font-bold tracking-widest">All content</span>
          </button>
          
          {AGE_RATINGS.map(rating => (
            <button
              key={rating.key}
              onClick={() => onChange(rating.key)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center ${
                value === rating.key 
                  ? 'bg-primary-500/10 border-primary-500 shadow-[0_0_15px_rgba(var(--color-primary-500-rgb),0.1)]' 
                  : 'bg-surface-800/40 border-surface-800 hover:border-surface-700'
              }`}
            >
              <span className={`text-sm font-bold ${value === rating.key ? 'text-primary-400' : 'text-white'}`}>{rating.label}</span>
              <span className="text-[10px] text-surface-500 mt-1 uppercase font-bold tracking-widest truncate w-full">{rating.desc}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
