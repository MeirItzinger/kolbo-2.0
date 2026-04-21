import React, { useState, useMemo } from 'react';
import { ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Toggle } from './common';

export function BlockedCategoriesSection({ 
  value, 
  onChange, 
  categories, 
  channels,
  isLoading 
}: { 
  value: string[]; 
  onChange: (v: string[]) => void; 
  categories: any[]; 
  channels: any[];
  isLoading: boolean;
}) {
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  const categoriesByChannel = useMemo(() => {
    const map: Record<string, any[]> = {};
    categories.forEach(cat => {
      if (!map[cat.channelId]) map[cat.channelId] = [];
      map[cat.channelId].push(cat);
    });
    return map;
  }, [categories]);

  const toggleCategory = (catName: string) => {
    if (value.includes(catName)) {
      onChange(value.filter(v => v !== catName));
    } else {
      onChange([...value, catName]);
    }
  };

  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle>Blocked Categories</CardTitle>
        <CardDescription>Hide entire categories of content, grouped by channel</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (
          <div className="space-y-3">
            {channels.map(channel => {
              const channelCats = categoriesByChannel[channel.id] || [];
              if (channelCats.length === 0) return null;
              
              const isExpanded = expandedChannel === channel.id;
              const activeCount = channelCats.filter(c => value.includes(c.name)).length;

              return (
                <div key={channel.id} className="border border-surface-800 rounded-xl overflow-hidden bg-surface-900/30 transition-all">
                  <button
                    onClick={() => setExpandedChannel(isExpanded ? null : channel.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-surface-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-surface-800 border border-surface-700 overflow-hidden shrink-0">
                         {channel.logoUrl && <img src={channel.logoUrl} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">{channel.name}</p>
                        <p className="text-xs text-surface-500">{channelCats.length} categories available</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {activeCount > 0 && (
                        <span className="bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30">
                          {activeCount} BLOCKED
                        </span>
                      )}
                      <ChevronRight className={`h-4 w-4 text-surface-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 animate-in slide-in-from-top-2">
                       {channelCats.map(cat => {
                         const isBlocked = value.includes(cat.name);
                         return (
                           <label 
                             key={cat.id} 
                             className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                               isBlocked ? 'bg-red-500/5 border-red-500/20' : 'bg-surface-800/20 border-surface-800 hover:border-surface-700'
                             }`}
                           >
                             <span className={`text-sm font-medium ${isBlocked ? 'text-red-400' : 'text-surface-300'}`}>
                               {cat.name}
                             </span>
                             <Toggle checked={isBlocked} onChange={() => toggleCategory(cat.name)} />
                           </label>
                         );
                       })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {Object.keys(categoriesByChannel).length === 0 && (
              <div className="flex flex-col items-center py-10 opacity-40">
                <AlertCircle className="h-10 w-10 mb-2" />
                <p className="text-sm">Available once content is tagged</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
