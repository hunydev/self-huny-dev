import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useSettings, Settings } from '../contexts/SettingsContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings } = useSettings();

  if (!isOpen) return null;

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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Grid Columns */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Grid Columns (Desktop)
            </label>
            <div className="flex gap-2">
              {([2, 3, 4, 5, 6] as const).map(num => (
                <button
                  key={num}
                  onClick={() => updateSetting('gridColumns', num)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
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
              <option value="relative">Relative (Today, Yesterday...)</option>
              <option value="absolute">Absolute (Dec 6, 2025)</option>
              <option value="both">Both (Today - Dec 6, 2025)</option>
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

          {/* Toggle Options */}
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Show Item Count</span>
              <button
                onClick={() => updateSetting('showItemCount', !settings.showItemCount)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.showItemCount ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.showItemCount ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Compact Mode</span>
              <button
                onClick={() => updateSetting('compactMode', !settings.compactMode)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.compactMode ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.compactMode ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </label>
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
            Reset to Defaults
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
