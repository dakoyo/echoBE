import React from 'react';
import { Role } from '../App.js';
import { SettingsIcon } from './icons/SettingsIcon.js';
import { CloseIcon } from './icons/CloseIcon.js';

interface SidebarProps {
  role: Role;
  onClose: () => void;
  audibleRange: number;
  onAudibleRangeChange: (value: number) => void;
  spectatorVoice: boolean;
  onSpectatorVoiceChange: (checked: boolean) => void;
  audioInputDevices: MediaDeviceInfo[];
  selectedAudioInput: string;
  onAudioInputChange: (deviceId: string) => void;
  audioOutputDevices: MediaDeviceInfo[];
  selectedAudioOutput: string;
  onAudioOutputChange: (deviceId: string) => void;
  isNoiseSuppressionEnabled: boolean;
  onNoiseSuppressionChange: (enabled: boolean) => void;
}

const SettingCategory: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
    <div>
        <h3 className="text-xl text-white mb-3 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            {title}
        </h3>
        <div className="flex flex-col gap-4 pl-2">{children}</div>
    </div>
);

interface SelectControlProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    disabled?: boolean;
}

const SelectControl: React.FC<SelectControlProps> = ({label, value, onChange, options, disabled = false}) => (
    <div>
        <label htmlFor={label} className={`text-sm block mb-1 ${disabled ? 'text-gray-500' : 'text-[#A9A9A9]'}`}>{label}</label>
        <div className="relative">
            <select
                id={label}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-full appearance-none bg-[#313131] border-2 border-t-[#272727] border-l-[#272727] border-b-[#545454] border-r-[#545454] text-white py-2 px-3 focus:outline-none focus:bg-[#454545] disabled:bg-gray-600 disabled:text-gray-400 disabled:border-gray-700 disabled:cursor-not-allowed"
            >
                {options.length === 0 && <option value="">デバイスが見つかりません</option>}
                {options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
            <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${disabled ? 'text-gray-500' : 'text-white'}`}>
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
    </div>
);


const RangeControl: React.FC<{label: string, value: number, onChange: (value: number) => void, min?: number, max?: number, unit?: string, disabled?: boolean}> = ({label, value, onChange, min = 0, max = 100, unit = '', disabled = false}) => (
    <div>
        <div className="flex justify-between items-baseline mb-1">
          <label htmlFor={label} className={`text-sm ${disabled ? 'text-gray-500' : 'text-[#A9A9A9]'}`}>{label}</label>
          <span className="text-white text-lg font-mono">{value}{unit}</span>
        </div>
        <input
            id={label}
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
            disabled={disabled}
        />
    </div>
);

const ToggleControl: React.FC<{label: string, checked: boolean, onChange: (checked: boolean) => void, disabled?: boolean}> = ({label, checked, onChange, disabled = false}) => (
    <div className="flex items-center justify-between">
        <label className={`text-sm flex-grow pr-4 ${disabled ? 'text-gray-500' : 'text-[#A9A9A9]'}`}>{label}</label>
        <button
            onClick={() => onChange(!checked)}
            aria-pressed={checked}
            disabled={disabled}
            className={`w-20 h-8 text-sm border-2 flex items-center justify-center flex-shrink-0 ${
                checked
                ? 'bg-[#58A445] text-white border-t-[#94E37E] border-l-[#94E37E] border-b-[#3F7A3E] border-r-[#3F7A3E] hover:bg-[#6BC056] active:bg-[#58A445] active:border-t-[#3F7A3E] active:border-l-[#3F7A3E] active:border-b-[#94E37E] active:border-r-[#94E37E]'
                : 'bg-[#A9A9A9] text-[#212121] border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#5A5A5A] border-r-[#5A5A5A] hover:bg-[#BBBBBB] active:bg-[#A9A9A9] active:border-t-[#5A5A5A] active:border-l-[#5A5A5A] active:border-b-[#FFFFFF] active:border-r-[#FFFFFF]'
            } disabled:bg-gray-600 disabled:text-gray-400 disabled:border-gray-700 disabled:cursor-not-allowed disabled:hover:bg-gray-600`}
        >
            {checked ? 'オン' : 'オフ'}
        </button>
    </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ 
  role, 
  onClose, 
  audibleRange, 
  onAudibleRangeChange, 
  spectatorVoice, 
  onSpectatorVoiceChange,
  audioInputDevices,
  selectedAudioInput,
  onAudioInputChange,
  audioOutputDevices,
  selectedAudioOutput,
  onAudioOutputChange,
  isNoiseSuppressionEnabled,
  onNoiseSuppressionChange
}) => {
  const isOwner = role === 'owner';
  
  const audioInputOptions = audioInputDevices.map((device, index) => ({
    value: device.deviceId,
    label: device.label || `マイク ${index + 1}`,
  }));

  const audioOutputOptions = audioOutputDevices.map((device, index) => ({
    value: device.deviceId,
    label: device.label || `スピーカー ${index + 1}`,
  }));
  
  return (
    <aside className="relative h-full w-72 bg-[#3C3C3C] border-r-4 border-[#272727] p-6 flex-shrink-0 flex flex-col gap-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#A9A9A9] hover:text-white md:hidden"
          aria-label="設定メニューを閉じる"
        >
          <CloseIcon className="w-6 h-6" />
        </button>

        <SettingCategory title="音声設定">
            <SelectControl 
                label="入力デバイス (マイク)"
                value={selectedAudioInput}
                onChange={onAudioInputChange}
                options={audioInputOptions}
            />
            <SelectControl 
                label="出力デバイス (スピーカー)"
                value={selectedAudioOutput}
                onChange={onAudioOutputChange}
                options={audioOutputOptions}
            />
        </SettingCategory>

        <SettingCategory title="ルーム設定">
            <RangeControl 
                label="デフォルトの聞こえる声の範囲" 
                value={audibleRange} 
                onChange={onAudibleRangeChange}
                min={0}
                max={100}
                unit="m"
                disabled={!isOwner}
            />
            <ToggleControl 
                label="観戦者の声も聞こえるようにする" 
                checked={spectatorVoice}
                onChange={onSpectatorVoiceChange}
                disabled={!isOwner}
            />
        </SettingCategory>

        <SettingCategory title="高度な音声設定">
            <ToggleControl 
                label="ノイズ抑制" 
                checked={isNoiseSuppressionEnabled}
                onChange={onNoiseSuppressionChange}
            />
        </SettingCategory>
    </aside>
  );
};
