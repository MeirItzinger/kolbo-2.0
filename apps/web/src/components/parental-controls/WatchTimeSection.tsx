import React, { useState } from 'react';
import { Clock, Settings, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from './common';
import type { ParentalControls } from '@/api/profiles';

export function WatchTimeSection({ 
  value, 
  onChange, 
  channels 
}: { 
  value: ParentalControls['watchTime']; 
  onChange: (v: ParentalControls['watchTime']) => void; 
  channels: any[];
}) {
  const [expandedSection, setExpandedSection] = useState<'daily' | 'channels' | null>(null);

  const setMode = (mode: 'UNIFORM' | 'PER_DAY') => {
    onChange({ ...value, mode });
  };

  const updateDaily = (minutes: number | null) => {
    onChange({ ...value, dailyLimitMinutes: minutes });
  };

  const updateDayLimit = (day: string, minutes: number | null) => {
    const limits = { ...value.perDayLimits };
    if (minutes === null) delete limits[day];
    else limits[day] = minutes;
    onChange({ ...value, perDayLimits: limits });
  };

  const updateChannelLimit = (channelId: string, minutes: number | null) => {
    const limits = { ...value.perChannelLimits };
    if (minutes === null) delete limits[channelId];
    else limits[channelId] = minutes;
    onChange({ ...value, perChannelLimits: limits });
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary-400" />
          Watch Time Limits
        </CardTitle>
        <CardDescription>Cap viewing time globally, by day, or by channel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global/Daily Limit */}
        <div className="bg-surface-950/50 border border-surface-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-6">
             <SectionHeader title="Daily Limits" description="Set maximum time allowed per day" />
             <div className="flex bg-surface-800 p-1 rounded-lg">
                <button 
                  onClick={() => setMode('UNIFORM')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${value.mode === 'UNIFORM' ? 'bg-primary-500 text-white shadow-lg' : 'text-surface-400 hover:text-white'}`}
                >UNIFORM</button>
                <button 
                  onClick={() => setMode('PER_DAY')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${value.mode === 'PER_DAY' ? 'bg-primary-500 text-white shadow-lg' : 'text-surface-400 hover:text-white'}`}
                >PER-DAY</button>
             </div>
          </div>

          {value.mode === 'UNIFORM' ? (
            <div className="flex items-center gap-4 bg-surface-800/40 p-4 rounded-xl border border-surface-800">
               <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500">
                  <Clock className="h-5 w-5" />
               </div>
               <div className="flex-1">
                 <p className="text-sm font-medium text-white mb-1">Same limit every day</p>
                 <Input
                  type="number"
                  placeholder="Unlimited"
                  value={value.dailyLimitMinutes ?? ''}
                  onChange={e => updateDaily(e.target.value ? parseInt(e.target.value) : null)}
                  className="bg-surface-900 max-w-[120px]"
                />
               </div>
               <span className="text-sm font-bold text-surface-500">MINUTES</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {DAYS.map(day => (
                 <div key={day} className="bg-surface-800/40 p-3 rounded-xl border border-surface-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">{day}</span>
                    <div className="flex items-center gap-2">
                       <Input
                        type="number"
                        placeholder="--"
                        value={value.perDayLimits[day] ?? ''}
                        onChange={e => updateDayLimit(day, e.target.value ? parseInt(e.target.value) : null)}
                        className="bg-surface-900 w-16 h-8 text-center text-xs"
                      />
                      <span className="text-[10px] font-bold text-surface-600">MIN</span>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* Per-Channel Limits */}
        <div className="bg-surface-950/50 border border-surface-800 rounded-xl overflow-hidden">
          <button 
             onClick={() => setExpandedSection(expandedSection === 'channels' ? null : 'channels')}
             className="w-full flex items-center justify-between p-5 hover:bg-surface-800 transition-colors"
          >
            <div className="flex items-center gap-3">
               <Settings className="h-5 w-5 text-primary-400" />
               <div className="text-left">
                  <p className="text-sm font-semibold text-white">Per-Channel Limits</p>
                  <p className="text-xs text-surface-500">{Object.keys(value.perChannelLimits || {}).length} channels restricted</p>
               </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-surface-500 transition-transform ${expandedSection === 'channels' ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSection === 'channels' && (
            <div className="p-5 pt-0 border-t border-surface-800 animate-in slide-in-from-top-2">
               <div className="grid gap-2 mt-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  {channels.map(ch => (
                    <div key={ch.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-800 bg-surface-900/30">
                       <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-surface-800 overflow-hidden border border-surface-700">
                             {ch.logoUrl && <img src={ch.logoUrl} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <span className="text-sm font-medium text-white">{ch.name}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            value={value.perChannelLimits[ch.id] ?? ''}
                            onChange={e => updateChannelLimit(ch.id, e.target.value ? parseInt(e.target.value) : null)}
                            className="bg-surface-900 w-24 h-9 text-right"
                          />
                          <span className="text-xs font-bold text-surface-500">MIN</span>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
