import React from 'react';
import { X, RotateCcw, Grid3X3, List } from 'lucide-react';
import { useSettings, Settings } from '../contexts/SettingsContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings } = useSettings();

  if (!isOpen) return null;

  const isGridView = !settings.compactMode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-lg text-slate-800">Settings</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* View Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              View Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateSetting('compactMode', false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  isGridView
                    ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                }`}
              >
                <Grid3X3 size={16} />
                Grid
              </button>
              <button
                onClick={() => updateSetting('compactMode', true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  !isGridView
                    ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                }`}
              >
                <List size={16} />
                List
              </button>
            </div>
          </div>

          {/* Grid View Options - Only show when Grid is selected */}
          {isGridView && (
            <div className="pl-3 border-l-2 border-indigo-200 space-y-4">
              {/* Grid Columns */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Grid Columns (Desktop)
                </label>
                <div className="flex gap-1.5">
                  {([2, 3, 4, 5, 6] as const).map(num => (
                    <button
                      key={num}
                      onClick={() => updateSetting('gridColumns', num)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        settings.gridColumns === num
                          ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Fit Mode */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  이미지 표시 방식
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateSetting('imageFit', 'cover')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-sm font-medium transition-colors ${
                      settings.imageFit === 'cover'
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                    }`}
                  >
                    Fill (채우기)
                  </button>
                  <button
                    onClick={() => updateSetting('imageFit', 'contain')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-sm font-medium transition-colors ${
                      settings.imageFit === 'contain'
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                    }`}
                  >
                    Fit (맞추기)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Date Format & Group By - 2 columns on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date Format */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date Format
              </label>
              <select
                value={settings.dateFormat}
                onChange={(e) => updateSetting('dateFormat', e.target.value as Settings['dateFormat'])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="iso">ISO (2025-12-06)</option>
                <option value="relative">Relative</option>
                <option value="absolute">Absolute</option>
                <option value="both">Both</option>
              </select>
            </div>

            {/* Group By */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Group Items By
              </label>
              <select
                value={settings.groupBy}
                onChange={(e) => updateSetting('groupBy', e.target.value as Settings['groupBy'])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              글꼴
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'system', label: 'System Default', fontClass: '' },
                { value: 'pretendard', label: 'Pretendard', fontClass: 'font-pretendard' },
                { value: 'noto-sans', label: 'Noto Sans KR', fontClass: 'font-noto-sans' },
                { value: 'inter', label: 'Inter', fontClass: 'font-inter' },
                { value: 'spoqa', label: 'Spoqa Han Sans', fontClass: 'font-spoqa' },
              ].map(font => (
                <button
                  key={font.value}
                  onClick={() => updateSetting('fontFamily', font.value as Settings['fontFamily'])}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    settings.fontFamily === font.value
                      ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                  }`}
                  style={{
                    fontFamily: font.value === 'system' ? 'inherit' :
                      font.value === 'pretendard' ? '"Pretendard Variable", Pretendard, sans-serif' :
                      font.value === 'noto-sans' ? '"Noto Sans KR", sans-serif' :
                      font.value === 'inter' ? '"Inter", sans-serif' :
                      '"Spoqa Han Sans Neo", sans-serif'
                  }}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Shortcut */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              아이템 저장 단축키
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateSetting('submitShortcut', 'ctrl+enter')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  settings.submitShortcut === 'ctrl+enter'
                    ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                }`}
              >
                Ctrl + Enter
              </button>
              <button
                onClick={() => updateSetting('submitShortcut', 'enter')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  settings.submitShortcut === 'enter'
                    ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                }`}
              >
                Enter
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {settings.submitShortcut === 'enter' 
                ? '줄바꿈: Shift + Enter' 
                : '일반 Enter로 줄바꿈 가능'}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between">
          <button
            onClick={resetSettings}
            className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
