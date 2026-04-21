import React from 'react';
import { Calendar, Plus, Trash2, X as CloseIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from './common';
import type { ParentalControls } from '@/api/profiles';

export function WatchWindowsSection({ 
  value, 
  onChange 
}: { 
  value: ParentalControls['watchWindows']; 
  onChange: (v: ParentalControls['watchWindows']) => void; 
}) {
  // Defensive check and normalization
  const windows = Array.isArray(value?.windows) ? value.windows : [];
  const mode = value?.mode || 'UNIFORM';

  const setMode = (newMode: 'UNIFORM' | 'PER_DAY') => {
    onChange({ mode: newMode, windows });
  };

  const addSlot = (dayOfWeek: number = -1) => {
    const newWindows = [...windows, { dayOfWeek, startTime: '08:00', endTime: '20:00' }];
    onChange({ mode, windows: newWindows });
  };

  const updateSlot = (index: number, field: string, v: string | number) => {
    const newWindows = [...windows];
    newWindows[index] = { ...newWindows[index], [field]: v };
    onChange({ mode, windows: newWindows });
  };

  const removeSlot = (index: number) => {
    onChange({ mode, windows: windows.filter((_, i) => i !== index) });
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary-400" />
          Watch Windows
        </CardTitle>
        <CardDescription>Specify the times of day content can be viewed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex bg-surface-800 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setMode('UNIFORM')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'UNIFORM' ? 'bg-primary-500 text-white shadow-lg' : 'text-surface-400 hover:text-white'}`}
          >EVERY DAY THE SAME</button>
          <button 
            onClick={() => setMode('PER_DAY')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'PER_DAY' ? 'bg-primary-500 text-white shadow-lg' : 'text-surface-400 hover:text-white'}`}
          >DIFFERENT PER DAY</button>
        </div>

        {mode === 'UNIFORM' ? (
          <div className="space-y-3">
             <div className="flex items-center justify-between group">
                <SectionHeader title="Allowed Hours" description="Applies to all days of the week" />
                <Button variant="outline" size="sm" onClick={() => addSlot(-1)} className="rounded-full bg-primary-500/10 border-primary-500/20 text-primary-400 hover:bg-primary-500 hover:text-white py-1">
                   <Plus className="h-3.5 w-3.5 mr-1" /> Add Slot
                </Button>
             </div>
             <div className="grid gap-2">
                {windows.filter(w => w.dayOfWeek === -1).map((w, idx) => {
                  const globalIdx = windows.indexOf(w);
                  return (
                    <div key={globalIdx} className="flex items-center gap-4 bg-surface-800/40 p-4 rounded-2xl border border-surface-800 group animate-in slide-in-from-left-2">
                       <span className="text-xs font-bold text-surface-500 uppercase tracking-widest min-w-[80px]">Window {idx + 1}</span>
                       <div className="flex items-center gap-3">
                          <Input type="time" value={w.startTime} onChange={e => updateSlot(globalIdx, 'startTime', e.target.value)} className="bg-surface-900 border-surface-700 w-32" />
                          <span className="text-surface-600 font-bold">TO</span>
                          <Input type="time" value={w.endTime} onChange={e => updateSlot(globalIdx, 'endTime', e.target.value)} className="bg-surface-900 border-surface-700 w-32" />
                       </div>
                       <button onClick={() => removeSlot(globalIdx)} className="ml-auto text-surface-500 hover:text-red-400 transition-colors">
                          <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                  );
                })}
                {windows.filter(w => w.dayOfWeek === -1).length === 0 && (
                   <p className="text-center text-sm text-surface-600 py-10 bg-surface-800/20 border border-dashed border-surface-800 rounded-2xl italic">
                      No windows set. Restricted profiles won't be able to watch content.
                   </p>
                )}
             </div>
          </div>
        ) : (
          <div className="space-y-4">
             {DAYS.map((dayName, dayIdx) => {
               const dayWindows = windows.filter(w => w.dayOfWeek === dayIdx);
               return (
                 <div key={dayIdx} className="bg-surface-950/50 border border-surface-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                       <h4 className="font-bold text-white uppercase tracking-widest text-sm">{dayName}</h4>
                       <Button variant="ghost" size="sm" onClick={() => addSlot(dayIdx)} className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary-400 hover:text-primary-300">
                          <Plus className="h-3 w-3 mr-1" /> Add Range
                       </Button>
                    </div>
                    <div className="space-y-2">
                       {dayWindows.map((w, idx) => {
                          const globalIdx = windows.indexOf(w);
                          return (
                            <div key={globalIdx} className="flex items-center gap-3 bg-surface-800/30 p-2.5 rounded-xl border border-surface-800 animate-in fade-in duration-300">
                               <Input type="time" value={w.startTime} onChange={e => updateSlot(globalIdx, 'startTime', e.target.value)} className="bg-surface-950 h-9 border-surface-800" />
                               <span className="text-[10px] font-bold text-surface-600">TO</span>
                               <Input type="time" value={w.endTime} onChange={e => updateSlot(globalIdx, 'endTime', e.target.value)} className="bg-surface-950 h-9 border-surface-800" />
                               <button onClick={() => removeSlot(globalIdx)} className="p-1.5 text-surface-600 hover:text-red-500">
                                  <CloseIcon className="h-3.5 w-3.5" />
                               </button>
                            </div>
                          );
                       })}
                       {dayWindows.length === 0 && <p className="text-[10px] text-surface-600 italic px-2">No windows defined for {dayName}.</p>}
                    </div>
                 </div>
               );
             })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
