import React, { useRef } from "react";
import { ProcessorConfig, LogoPosition } from "../types";
import { Image, Trash2, Sliders, Sparkles, CheckCircle2 } from "lucide-react";

interface LogoUploaderProps {
  config: ProcessorConfig;
  onChange: (config: ProcessorConfig) => void;
  logoFile: File | null;
  onLogoChange: (file: File | null) => void;
  logoPreviewUrl: string | null;
  noCardStyle?: boolean;
}

const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: "top-left", label: "Góc Trên - Trái" },
  { value: "top-right", label: "Góc Trên - Phải" },
  { value: "bottom-left", label: "Góc Dưới - Trái" },
  { value: "bottom-right", label: "Góc Dưới - Phải" },
  { value: "top-center", label: "Giữa - Trên" },
  { value: "bottom-center", label: "Giữa - Dưới" },
  { value: "center", label: "Chính Giữa" },
];

export default function LogoUploader({
  config,
  onChange,
  logoFile,
  onLogoChange,
  logoPreviewUrl,
  noCardStyle,
}: LogoUploaderProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onLogoChange(e.target.files[0]);
    }
  };

  const removeLogo = () => {
    onLogoChange(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  return (
    <div className={noCardStyle ? "space-y-4" : "bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-xl border border-slate-800 p-5 space-y-4"} id="logo-uploader">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Logo Thương Hiệu</h2>
        </div>
        {logoFile && (
          <button
            onClick={removeLogo}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Xóa logo
          </button>
        )}
      </div>

      {logoPreviewUrl ? (
        <div className="flex items-center gap-3 p-3 bg-indigo-950/20 rounded-xl border border-indigo-900/40">
          <div className="w-12 h-12 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden p-1 shrink-0">
            <img src={logoPreviewUrl} alt="Logo Brand" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{logoFile?.name || "Logo đã tải"}</p>
            <p className="text-[10px] text-slate-500 font-mono">READY // SIZE_PRESERVED</p>
          </div>
        </div>
      ) : (
        <div
          onClick={() => logoInputRef.current?.click()}
          className="border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-800/30 transition-colors"
        >
          <Image className="w-6 h-6 text-slate-500 mx-auto mb-2" />
          <p className="text-xs font-semibold text-indigo-400">Chọn hoặc thả Logo tại đây</p>
          <p className="text-[10px] text-slate-500 mt-1">PNG, SVG (Khuyên dùng nền trong suốt)</p>
        </div>
      )}
      <input
        type="file"
        ref={logoInputRef}
        onChange={handleLogoUpload}
        accept="image/png, image/svg+xml, image/jpeg"
        className="hidden"
      />

      {/* Cấu hình thêm cho Logo khi KHÔNG DÙNG CUSTOM LAYOUT */}
      {logoPreviewUrl && !config.useCustomLayout && (
        <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 mt-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Vị trí chèn Logo (Tự động)</label>
            <select
              value={config.logoPosition}
              onChange={(e) => onChange({ ...config, logoPosition: e.target.value as LogoPosition })}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
            >
              {LOGO_POSITIONS.map((pos) => (
                <option key={pos.value} value={pos.value} className="bg-slate-950">
                  {pos.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between mb-1">
                <span>Kích thước ({config.logoScale}%)</span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={config.logoScale}
                onChange={(e) => onChange({ ...config, logoScale: parseInt(e.target.value) })}
                className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between mb-1">
                <span>Căn biên ({config.logoPadding}px)</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.logoPadding}
                onChange={(e) => onChange({ ...config, logoPadding: parseInt(e.target.value) })}
                className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
      {/* Brand Logos Quick Selection */}
      <div className="space-y-2 mt-3 pt-3 border-t border-slate-800/60">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Logo Thương Hiệu Có Sẵn</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              onLogoChange(null);
              onChange({
                ...config,
                logoUrl: "/logos/JBL-logo.png",
              });
            }}
            className={`relative p-3 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer bg-white ${
              config.logoUrl === "/logos/JBL-logo.png" && !logoFile
                ? "border-indigo-500 shadow-md shadow-indigo-950/20"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="w-12 h-8 flex items-center justify-center overflow-hidden shrink-0 mx-auto">
              <img src="/logos/JBL-logo.png" alt="JBL" className="max-w-full max-h-full object-contain pointer-events-none" />
            </div>
            {config.logoUrl === "/logos/JBL-logo.png" && !logoFile && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </button>
          
          <button
            type="button"
            onClick={() => {
              onLogoChange(null);
              onChange({
                ...config,
                logoUrl: "/logos/HK-logo.png",
              });
            }}
            className={`relative p-3 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer bg-white ${
              config.logoUrl === "/logos/HK-logo.png" && !logoFile
                ? "border-indigo-500 shadow-md shadow-indigo-950/20"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="w-12 h-8 flex items-center justify-center overflow-hidden shrink-0 mx-auto">
              <img src="/logos/HK-logo.png" alt="HK" className="max-w-full max-h-full object-contain pointer-events-none" />
            </div>
            {config.logoUrl === "/logos/HK-logo.png" && !logoFile && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
