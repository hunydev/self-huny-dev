import React, { useMemo } from 'react';
import { Item, Tag } from '../types';
import FeedItem from './FeedItem';
import { format, isToday, isYesterday, startOfWeek, startOfMonth } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Timer } from 'lucide-react';

interface FeedProps {
  items: Item[];
  tags: Tag[];
  onDelete: (id: string) => void;
  onItemClick: (item: Item) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onToggleEncryption?: (id: string) => void;
  isTrashView?: boolean;
  isExpiringView?: boolean;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onEmptyTrash?: () => void;
}

const Feed: React.FC<FeedProps> = ({ 
  items, 
  tags, 
  onDelete, 
  onItemClick, 
  onToggleFavorite, 
  onToggleEncryption,
  isTrashView = false,
  isExpiringView = false,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}) => {
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
    if (isTrashView) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Trash2 className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-lg font-medium text-slate-500">휴지통이 비어 있습니다</p>
          <p className="text-sm">삭제된 아이템이 여기에 표시됩니다.</p>
        </div>
      );
    }

    if (isExpiringView) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Timer className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-lg font-medium text-slate-500">만료 예정 아이템이 없습니다</p>
          <p className="text-sm">만료 기간이 설정된 아이템이 여기에 표시됩니다.</p>
        </div>
      );
    }

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

  // Helper function to format remaining time until expiry
  const formatExpiryTime = (expiresAt: number) => {
    const now = Date.now();
    const diffMs = expiresAt - now;
    
    if (diffMs < 0) return '만료됨';
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) return `${diffMinutes}분 후 만료`;
    if (diffHours < 24) return `${diffHours}시간 후 만료`;
    if (diffDays < 7) return `${diffDays}일 후 만료`;
    return `${format(new Date(expiresAt), 'MM월 dd일')} 만료`;
  };

  // Expiring view - flat list sorted by expiry time (soonest first)
  if (isExpiringView) {
    return (
      <div className="space-y-4 pb-20">
        <div className="flex items-center gap-2 mb-4 pl-1 py-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            만료 예정
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full font-medium">
            {items.length}
          </span>
        </div>
        {settings.compactMode ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {items.map(item => (
              <div key={item.id} className="relative">
                <FeedItem 
                  item={item} 
                  tags={tags} 
                  onDelete={onDelete}
                  onClick={() => onItemClick(item)}
                  onToggleFavorite={onToggleFavorite}
                  onToggleEncryption={onToggleEncryption}
                  compact={true}
                  isTrashView={false}
                  onRestore={onRestore}
                  onPermanentDelete={onPermanentDelete}
                />
                {item.expiresAt && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded-full">
                    {formatExpiryTime(item.expiresAt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid ${gridColsClass} gap-4 items-start`}>
            {items.map(item => (
              <div key={item.id} className="relative">
                <FeedItem 
                  item={item} 
                  tags={tags} 
                  onDelete={onDelete}
                  onClick={() => onItemClick(item)}
                  onToggleFavorite={onToggleFavorite}
                  onToggleEncryption={onToggleEncryption}
                  compact={false}
                  isTrashView={false}
                  onRestore={onRestore}
                  onPermanentDelete={onPermanentDelete}
                />
                {item.expiresAt && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded-full z-10">
                    {formatExpiryTime(item.expiresAt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Trash view header with empty trash button */}
      {isTrashView && items.length > 0 && onEmptyTrash && (
        <div className="mt-2 space-y-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-sm text-slate-600">
              🗑️ 휴지통으로 이동한 아이템은 <strong>30일</strong> 후 자동으로 영구 삭제됩니다.
            </p>
          </div>
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-amber-700">
              <Trash2 size={18} />
              <span className="text-sm font-medium">
                휴지통에 {items.length}개의 아이템이 있습니다
              </span>
            </div>
            <button
              onClick={onEmptyTrash}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              휴지통 비우기
            </button>
          </div>
        </div>
      )}

      {sortedDates.map(dateKey => (
        <div key={dateKey}>
          <div className="flex items-center gap-2 mb-4 pl-1 py-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {getDateLabel(dateKey)}
            </h2>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded-full font-medium">
              {groupedItems[dateKey].length}
            </span>
          </div>
          {settings.compactMode ? (
            /* Compact list view */
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {groupedItems[dateKey].map(item => (
                <FeedItem 
                  key={item.id} 
                  item={item} 
                  tags={tags} 
                  onDelete={isTrashView ? undefined : onDelete}
                  onClick={() => onItemClick(item)}
                  onToggleFavorite={isTrashView ? undefined : onToggleFavorite}
                  onToggleEncryption={isTrashView ? undefined : onToggleEncryption}
                  compact={true}
                  isTrashView={isTrashView}
                  onRestore={onRestore}
                  onPermanentDelete={onPermanentDelete}
                />
              ))}
            </div>
          ) : (
            /* Grid view */
            <div className={`grid ${gridColsClass} gap-4 items-start`}>
              {groupedItems[dateKey].map(item => (
                <FeedItem 
                  key={item.id} 
                  item={item} 
                  tags={tags} 
                  onDelete={isTrashView ? undefined : onDelete}
                  onClick={() => onItemClick(item)}
                  onToggleFavorite={isTrashView ? undefined : onToggleFavorite}
                  onToggleEncryption={isTrashView ? undefined : onToggleEncryption}
                  compact={false}
                  isTrashView={isTrashView}
                  onRestore={onRestore}
                  onPermanentDelete={onPermanentDelete}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Feed;
