import React, { useState, useMemo } from 'react';
import { Item, Tag } from '../types';
import { ChevronLeft, ChevronRight, Bell, Calendar, FileText, Image as ImageIcon, Video, File as FileIcon, Link as LinkIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getFileUrl } from '../services/db';

interface ScheduledViewProps {
  items: Item[];
  tags: Tag[];
  onItemClick: (item: Item) => void;
}

// 남은 시간을 human-readable 형식으로 변환
const getTimeRemaining = (reminderAt: number): string => {
  const now = Date.now();
  const diff = reminderAt - now;
  
  if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (absDiff < 60000) return '방금 전';
    if (absDiff < 3600000) return `${Math.floor(absDiff / 60000)}분 전`;
    if (absDiff < 86400000) return `${Math.floor(absDiff / 3600000)}시간 전`;
    if (absDiff < 604800000) return `${Math.floor(absDiff / 86400000)}일 전`;
    return format(new Date(reminderAt), 'M월 d일', { locale: ko });
  }
  
  if (diff < 60000) return '곧';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 후`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 후`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 후`;
  if (diff < 2592000000) return `${Math.floor(diff / 604800000)}주 후`;
  return format(new Date(reminderAt), 'M월 d일', { locale: ko });
};

// 아이템 타입 아이콘
const getTypeIcon = (type: string) => {
  switch (type) {
    case 'text': return <FileText size={14} className="text-slate-400" />;
    case 'link': return <LinkIcon size={14} className="text-blue-400" />;
    case 'image': return <ImageIcon size={14} className="text-emerald-400" />;
    case 'video': return <Video size={14} className="text-purple-400" />;
    case 'file': return <FileIcon size={14} className="text-orange-400" />;
    default: return <FileText size={14} className="text-slate-400" />;
  }
};

// 캘린더 셀용 아이템 썸네일
const ItemThumbnail: React.FC<{ item: Item; onClick: (e: React.MouseEvent) => void }> = ({ item, onClick }) => {
  const fileUrl = item.fileKey ? getFileUrl(item.fileKey) : null;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(e);
  };
  
  // 이미지 아이템
  if (item.type === 'image' && fileUrl) {
    return (
      <button
        onClick={handleClick}
        className="w-6 h-6 rounded overflow-hidden bg-slate-200 hover:ring-2 hover:ring-indigo-400 transition-all shrink-0"
        title={item.title || item.fileName || '이미지'}
      >
        <img src={fileUrl} alt="" className="w-full h-full object-cover" />
      </button>
    );
  }
  
  // OG 이미지가 있는 경우
  if (item.ogImage) {
    return (
      <button
        onClick={handleClick}
        className="w-6 h-6 rounded overflow-hidden bg-slate-200 hover:ring-2 hover:ring-indigo-400 transition-all shrink-0"
        title={item.title || item.ogTitle || 'Link'}
      >
        <img src={item.ogImage} alt="" className="w-full h-full object-cover" />
      </button>
    );
  }
  
  // 타입별 아이콘
  const iconBgMap: Record<string, string> = {
    text: 'bg-slate-100',
    link: 'bg-blue-100',
    video: 'bg-purple-100',
    file: 'bg-orange-100',
    image: 'bg-emerald-100',
  };
  const iconBg = iconBgMap[item.type] || 'bg-slate-100';
  
  return (
    <button
      onClick={handleClick}
      className={`w-6 h-6 rounded ${iconBg} flex items-center justify-center hover:ring-2 hover:ring-indigo-400 transition-all shrink-0`}
      title={item.title || item.content?.slice(0, 30) || item.fileName || '아이템'}
    >
      {getTypeIcon(item.type)}
    </button>
  );
};

const ScheduledView: React.FC<ScheduledViewProps> = ({ items, tags: _tags, onItemClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 아이템들을 날짜별로 그룹화
  const itemsByDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    items.forEach(item => {
      if (item.reminderAt) {
        const dateKey = format(new Date(item.reminderAt), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(item);
      }
    });
    return map;
  }, [items]);

  // 선택된 날짜의 아이템 또는 전체 아이템 (정렬됨)
  // 리스트 뷰에서는 오늘 이전 날짜의 지난 일정은 표시하지 않음
  const displayItems = useMemo(() => {
    let filtered = items;
    
    if (selectedDate) {
      // 특정 날짜 선택 시 해당 날짜 아이템만
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      filtered = itemsByDate.get(dateKey) || [];
    } else {
      // 전체 보기 시: 오늘 날짜의 지난 일정 + 미래 일정만 표시
      const todayStart = startOfDay(new Date()).getTime();
      filtered = items.filter(item => {
        if (!item.reminderAt) return false;
        // 오늘 이후 시작되는 날짜의 아이템은 모두 표시
        // 오늘 날짜 아이템은 지났어도 표시
        return item.reminderAt >= todayStart;
      });
    }
    
    // 가까운 시일이 위로 오도록 정렬
    return filtered.sort((a, b) => (a.reminderAt || 0) - (b.reminderAt || 0));
  }, [items, selectedDate, itemsByDate]);

  // 캘린더 날짜 생성
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(null);
  };

  const handleDateClick = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    if (itemsByDate.has(dateKey)) {
      setSelectedDate(selectedDate && isSameDay(selectedDate, date) ? null : date);
    }
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4 bg-slate-50">
      {/* 캘린더 영역 - 모바일에서 상단, 데스크톱에서 좌측 */}
      <div className="lg:flex-[3] bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col min-h-[400px] lg:min-h-0">
        {/* 캘린더 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              오늘
            </button>
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day, i) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-2 ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 캘린더 그리드 */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {calendarDays.map((day, i) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayItems = itemsByDate.get(dateKey) || [];
            const hasItems = dayItems.length > 0;
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const dayOfWeek = day.getDay();

            return (
              <div
                key={i}
                onClick={() => handleDateClick(day)}
                className={`
                  relative p-1.5 rounded-lg text-sm transition-all min-h-[70px] lg:min-h-[80px] flex flex-col
                  ${!isCurrentMonth ? 'text-slate-300 bg-slate-50/50' : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-slate-700'}
                  ${isToday(day) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                  ${isSelected 
                    ? 'bg-indigo-600 text-white shadow-inner' 
                    : hasItems 
                      ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer' 
                      : 'bg-white'}
                  ${hasItems ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <span className={`text-xs font-medium ${isToday(day) ? 'font-bold' : ''} ${isSelected ? 'text-white' : ''}`}>
                  {format(day, 'd')}
                </span>
                {/* 아이템 썸네일 그리드 */}
                {hasItems && (
                  <div className="flex flex-wrap gap-0.5 mt-1 overflow-hidden flex-1">
                    {dayItems.slice(0, 6).map(item => (
                      <ItemThumbnail 
                        key={item.id} 
                        item={item} 
                        onClick={() => onItemClick(item)}
                      />
                    ))}
                    {dayItems.length > 6 && (
                      <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-medium">
                        +{dayItems.length - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 범례 - 데스크톱에서만 */}
        <div className="hidden lg:flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></div>
            <span>일정 있음</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded ring-2 ring-indigo-500"></div>
            <span>오늘</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-indigo-100"></div>
            <span>선택됨</span>
          </div>
        </div>
      </div>

      {/* 리스트 영역 - 모바일에서 하단, 데스크톱에서 우측 */}
      <div className="lg:flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[300px] lg:min-h-0 lg:min-w-[280px]">
        {/* 리스트 헤더 */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">
              {selectedDate 
                ? format(selectedDate, 'M월 d일 일정', { locale: ko })
                : '전체 일정'
              }
            </h3>
            <span className="text-sm text-slate-500">{displayItems.length}개</span>
          </div>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-indigo-600 hover:text-indigo-700 mt-1"
            >
              전체 보기
            </button>
          )}
        </div>

        {/* 아이템 리스트 */}
        <div className="flex-1 overflow-y-auto">
          {displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 min-h-[150px]">
              <Bell size={32} className="mb-2 opacity-50" />
              <p className="text-sm">일정이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {displayItems.map(item => {
                const isPastDue = item.reminderAt && item.reminderAt < Date.now();
                const timeRemaining = item.reminderAt ? getTimeRemaining(item.reminderAt) : '';
                
                return (
                  <button
                    key={item.id}
                    onClick={() => onItemClick(item)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-start gap-3"
                  >
                    {/* 타입 아이콘 */}
                    <div className="mt-0.5 shrink-0">
                      {getTypeIcon(item.type)}
                    </div>

                    {/* 콘텐츠 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {item.title || item.content?.slice(0, 50) || item.fileName || '제목 없음'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400">
                          {item.reminderAt && format(new Date(item.reminderAt), 'M/d HH:mm', { locale: ko })}
                        </span>
                        <span className={`text-[11px] font-medium ${
                          isPastDue ? 'text-red-500' : 'text-blue-500'
                        }`}>
                          {timeRemaining}
                        </span>
                      </div>
                    </div>

                    {/* 알림 표시 */}
                    <div className={`shrink-0 ${isPastDue ? 'text-red-400' : 'text-blue-400'}`}>
                      <Bell size={14} fill="currentColor" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduledView;
