import React, { useMemo } from 'react';
import { Item, Tag } from '../types';
import FeedItem from './FeedItem';
import { format, isToday, isYesterday, startOfWeek, startOfMonth } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';

interface FeedProps {
  items: Item[];
  tags: Tag[];
  onDelete: (id: string) => void;
  onItemClick: (item: Item) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
}

const Feed: React.FC<FeedProps> = ({ items, tags, onDelete, onItemClick, onToggleFavorite }) => {
  const { settings } = useSettings();

  // Group items based on settings
  const groupedItems = useMemo(() => {
    return items.reduce((groups, item) => {
      let dateKey: string;
      const date = new Date(item.createdAt);
      
      switch (settings.groupBy) {
        case 'week':
          const weekStart = startOfWeek(date, { weekStartsOn: 1 });
          dateKey = format(weekStart, 'yyyy-MM-dd');
          break;
        case 'month':
          const monthStart = startOfMonth(date);
          dateKey = format(monthStart, 'yyyy-MM');
          break;
        case 'day':
        default:
          dateKey = format(date, 'yyyy-MM-dd');
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
      return groups;
    }, {} as Record<string, Item[]>);
  }, [items, settings.groupBy]);

  const sortedDates = Object.keys(groupedItems).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    
    if (settings.groupBy === 'month') {
      if (settings.dateFormat === 'iso') {
        return format(date, 'yyyy-MM');
      }
      return format(date, 'MMMM yyyy');
    }
    
    if (settings.groupBy === 'week') {
      const weekEnd = new Date(date);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (settings.dateFormat === 'iso') {
        return `${format(date, 'yyyy-MM-dd')} ~ ${format(weekEnd, 'yyyy-MM-dd')}`;
      }
      return `${format(date, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    
    // Day grouping
    const relativeLabel = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : null;
    const absoluteLabel = format(date, 'MMMM d, yyyy');
    const isoLabel = format(date, 'yyyy-MM-dd');
    
    switch (settings.dateFormat) {
      case 'iso':
        return isoLabel;
      case 'absolute':
        return absoluteLabel;
      case 'both':
        return relativeLabel ? `${relativeLabel} - ${absoluteLabel}` : absoluteLabel;
      case 'relative':
      default:
        return relativeLabel || absoluteLabel;
    }
  };

  // Grid columns based on settings
  const gridColsClass = useMemo(() => {
    const cols = settings.gridColumns;
    // Base: 1 col on mobile, then scale up
    return `grid-cols-1 sm:grid-cols-2 md:grid-cols-${Math.min(cols, 3)} lg:grid-cols-${Math.min(cols, 4)} xl:grid-cols-${cols}`;
  }, [settings.gridColumns]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p className="text-lg font-medium text-slate-500">No items yet</p>
        <p className="text-sm">Paste something or drop a file to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {sortedDates.map(dateKey => (
        <div key={dateKey}>
          <div className="flex items-center gap-2 mb-4 pl-1 py-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {getDateLabel(dateKey)}
            </h2>
            {settings.showItemCount && (
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded-full font-medium">
                {groupedItems[dateKey].length}
              </span>
            )}
          </div>
          <div className={`grid ${gridColsClass} gap-4`}>
            {groupedItems[dateKey].map(item => (
              <FeedItem 
                key={item.id} 
                item={item} 
                tags={tags} 
                onDelete={onDelete}
                onClick={() => onItemClick(item)}
                onToggleFavorite={onToggleFavorite}
                compact={settings.compactMode}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Feed;
