import React from 'react';
import { Item, Tag } from '../types';
import FeedItem from './FeedItem';
import { format, isToday, isYesterday } from 'date-fns';

interface FeedProps {
  items: Item[];
  tags: Tag[];
  onDelete: (id: string) => void;
}

const Feed: React.FC<FeedProps> = ({ items, tags, onDelete }) => {
  // Group items by date
  const groupedItems = items.reduce((groups, item) => {
    const dateKey = format(item.createdAt, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(item);
    return groups;
  }, {} as Record<string, Item[]>);

  const sortedDates = Object.keys(groupedItems).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

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
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pl-1 sticky top-0 bg-slate-50/95 backdrop-blur-sm py-2 z-10">
            {getDateLabel(dateKey)}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {groupedItems[dateKey].map(item => (
              <FeedItem 
                key={item.id} 
                item={item} 
                tags={tags} 
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Feed;
