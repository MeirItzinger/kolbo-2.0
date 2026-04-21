import React, { useState } from 'react';
import type { ParentalControls } from '@/api/profiles';
import { Search, Plus, Trash2, ChevronDown, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toggle } from './common';

export function AllowedChannelsSection({ 
  useChannelAllowlist,
  allowedChannels,
  onChange, 
  channels, 
  isLoading 
}: { 
  useChannelAllowlist: boolean;
  allowedChannels: string[];
  onChange: <K extends keyof ParentalControls>(field: K, value: ParentalControls[K]) => void;
  channels: any[];
  isLoading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = channels.filter(ch => 
    !allowedChannels.includes(ch.id) &&
    (ch.name.toLowerCase().includes(search.toLowerCase()) || 
     ch.slug.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card className="overflow-visible border-surface-800 bg-surface-900/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-surface-800">
        <div>
          <CardTitle className="text-xl font-bold">Channel Allow-list</CardTitle>
          <CardDescription>Restrict access to specific channels only</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-surface-500">
            {useChannelAllowlist ? 'Enabled' : 'Disabled'}
          </span>
          <Toggle 
            checked={useChannelAllowlist} 
            onChange={(v) => onChange('useChannelAllowlist', v)} 
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!useChannelAllowlist ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-surface-800 flex items-center justify-center mb-3">
              <Eye className="h-6 w-6 text-surface-500" />
            </div>
            <p className="text-surface-400">All channels are currently visible.</p>
            <p className="text-xs text-surface-600 mt-1">Enable the toggle above to start restricting channels.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <div
                onClick={() => !isLoading && setIsOpen(!isOpen)}
                className="flex items-center justify-between rounded-xl border border-surface-700 bg-surface-800 px-4 py-3 cursor-pointer hover:border-primary-500/50 hover:bg-surface-750 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary-500" />
                  <span className="text-surface-300 font-medium">
                    {isLoading ? 'Loading channels...' : 'Add channel to allow-list'}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-surface-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </div>

              {isOpen && (
                <div className="absolute z-50 mt-2 w-full rounded-2xl border border-surface-700 bg-surface-900 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-200">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
                    <Input
                      autoFocus
                      placeholder="Search channels..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-10 bg-surface-800 border-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {filteredOptions.length === 0 ? (
                      <p className="p-8 text-center text-sm text-surface-500 italic">No matching channels found</p>
                    ) : (
                      <div className="grid gap-1">
                        {filteredOptions.map(ch => (
                          <button
                            key={ch.id}
                            onClick={() => {
                              onChange('allowedChannels', [...allowedChannels, ch.id]);
                              setIsOpen(false);
                              setSearch('');
                            }}
                            className="w-full flex items-center gap-3 rounded-xl p-2.5 text-left hover:bg-primary-500/10 transition-colors group"
                          >
                            <div className="h-10 w-10 rounded-full bg-surface-800 border border-surface-700 overflow-hidden shrink-0">
                              {ch.logoUrl ? <img src={ch.logoUrl} alt="" className="h-full w-full object-cover" /> : null}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white group-hover:text-primary-400 transition-colors">{ch.name}</p>
                              <p className="text-xs text-surface-500">@{ch.slug}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {allowedChannels.map(chId => {
                const ch = channels.find(c => c.id === chId);
                return (
                  <div key={chId} className="flex items-center justify-between rounded-xl border border-primary-500/20 bg-primary-500/5 p-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-surface-800 overflow-hidden shrink-0 border border-primary-500/20">
                         {ch?.logoUrl && <img src={ch.logoUrl} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <span className="text-sm font-medium text-white truncate">{ch?.name || 'Unknown Channel'}</span>
                    </div>
                    <button 
                      onClick={() => onChange('allowedChannels', allowedChannels.filter(c => c !== chId))}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-surface-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            
            {allowedChannels.length === 0 && (
              <p className="text-center text-sm text-surface-600 py-4 italic border border-dashed border-surface-800 rounded-xl">
                No channels restricted yet. Add your first allowed channel.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
