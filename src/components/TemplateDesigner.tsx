import React, { useState, useRef, useEffect } from "react";
import { ProcessorConfig, ElementLayout, LayoutPreset } from "../types";
import { Move, RotateCw, Maximize, RefreshCw, Layout, ToggleLeft, ToggleRight, Sparkles, Save, Trash2 } from "lucide-react";

interface TemplateDesignerProps {
  config: ProcessorConfig;
  onChange: (config: ProcessorConfig) => void;
  logoPreviewUrl: string | null;
  productPreviewUrl: string | null;
  onLogoFileChange?: (file: File | null) => void;
}

export const SYSTEM_PRESETS: LayoutPreset[] = [
  {
    id: "jbl-thumb",
    name: "JBL Thumb",
    isSystem: true,
    useCustomLayout: true,
    logoLayout: { x: 5, y: 5, width: 25, height: 25, rotation: 0 },
    productLayout: { x: 15, y: 22, width: 70, height: 70, rotation: 0 },
  },
  {
    id: "hk-thumb",
    name: "HK Thumb",
    isSystem: true,
    useCustomLayout: true,
    logoLayout: { x: 27, y: -4, width: 47, height: 28, rotation: 0 },
    productLayout: { x: 15, y: 22, width: 70, height: 70, rotation: 0 },
  },
];

export default function TemplateDesigner({
  config,
  onChange,
  logoPreviewUrl,
  productPreviewUrl,
  onLogoFileChange,
}: TemplateDesignerProps) {
  const [selectedElement, setSelectedElement] = useState<"canvas" | "product" | "logo">("canvas");
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, elemX: 0, elemY: 0 });

  // Preset States
  const [customPresets, setCustomPresets] = useState<LayoutPreset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Load custom presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("custom_layout_presets");
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {
        console.error("Lỗi đọc layout presets:", e);
      }
    }
  }, []);

  const saveCustomPresets = (presets: LayoutPreset[]) => {
    setCustomPresets(presets);
    localStorage.setItem("custom_layout_presets", JSON.stringify(presets));
  };

  const handleSaveCurrentPreset = () => {
    if (!newPresetName.trim()) return;
    
    const pLayout: ElementLayout = config.productLayout || { x: 15, y: 22, width: 70, height: 70, rotation: 0 };
    const lLayout: ElementLayout = config.logoLayout || { x: 70, y: 70, width: 20, height: 20, rotation: 0 };
    
    const newPreset: LayoutPreset = {
      id: "preset-" + Date.now(),
      name: newPresetName.trim(),
      productLayout: { ...pLayout },
      logoLayout: { ...lLayout },
      useCustomLayout: true,
    };

    const updated = [...customPresets, newPreset];
    saveCustomPresets(updated);
    setNewPresetName("");
    setShowSaveModal(false);
  };

  const handleDeletePreset = (id: string) => {
    const updated = customPresets.filter((p) => p.id !== id);
    saveCustomPresets(updated);
  };

  const handleClearCustomPresets = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tất cả các mẫu tự tạo?")) {
      saveCustomPresets([]);
    }
  };

  const handleApplyPreset = (preset: LayoutPreset) => {
    let updatedLogoUrl = config.logoUrl;
    
    // Auto sync system preset with its corresponding brand logo
    if (preset.id === "jbl-thumb") {
      updatedLogoUrl = "/logos/JBL-logo.png";
      if (onLogoFileChange) onLogoFileChange(null);
    } else if (preset.id === "hk-thumb") {
      updatedLogoUrl = "/logos/HK-logo.png";
      if (onLogoFileChange) onLogoFileChange(null);
    }

    onChange({
      ...config,
      useCustomLayout: true,
      logoLayout: { ...preset.logoLayout },
      productLayout: { ...preset.productLayout },
      logoUrl: updatedLogoUrl,
    });
  };

  const allPresets = [...SYSTEM_PRESETS, ...customPresets];

  const isPresetActive = (preset: LayoutPreset) => {
    const pLayout = config.productLayout || { x: 15, y: 22, width: 70, height: 70, rotation: 0 };
    const lLayout = config.logoLayout || { x: 70, y: 70, width: 20, height: 20, rotation: 0 };
    
    const pMatch = 
      Math.abs(pLayout.x - preset.productLayout.x) < 0.5 &&
      Math.abs(pLayout.y - preset.productLayout.y) < 0.5 &&
      Math.abs(pLayout.width - preset.productLayout.width) < 0.5 &&
      Math.abs(pLayout.height - preset.productLayout.height) < 0.5;

    const lMatch = 
      Math.abs(lLayout.x - preset.logoLayout.x) < 0.5 &&
      Math.abs(lLayout.y - preset.logoLayout.y) < 0.5 &&
      Math.abs(lLayout.width - preset.logoLayout.width) < 0.5 &&
      Math.abs(lLayout.height - preset.logoLayout.height) < 0.5;

    return pMatch && lMatch;
  };

  // Get active layout configurations, provide defaults if they don't exist yet
  const useCustomLayout = true;
  const pLayout: ElementLayout = config.productLayout || { x: 15, y: 22, width: 70, height: 70, rotation: 0 };
  const lLayout: ElementLayout = config.logoLayout || { x: 70, y: 70, width: 20, height: 20, rotation: 0 };

  const activeLayout = selectedElement === "product" ? pLayout : lLayout;

  const updateActiveLayout = (updates: Partial<ElementLayout>) => {
    const updatedLayout = { ...activeLayout, ...updates };
    
    if (selectedElement === "product") {
      onChange({
        ...config,
        productLayout: updatedLayout,
        // Make sure it initializes custom layout values
        logoLayout: config.logoLayout || lLayout,
      });
    } else {
      onChange({
        ...config,
        logoLayout: updatedLayout,
        productLayout: config.productLayout || pLayout,
      });
    }
  };

  // Gom chiều rộng và chiều cao thành 1: Scale theo %. Bảo lưu hồng tâm ở giữa.
  const handleScaleChange = (newScale: number) => {
    const currentWidth = activeLayout.width;
    const currentHeight = activeLayout.height;
    const currentX = activeLayout.x;
    const currentY = activeLayout.y;
    
    // Tính hồng tâm hiện tại
    const centerX = currentX + currentWidth / 2;
    const centerY = currentY + currentHeight / 2;
    
    // Tỉ lệ hiện tại (width / height)
    const ratio = currentWidth / currentHeight || 1;
    
    // scale mới gán cho width, và height điều chỉnh theo ratio
    const newWidth = newScale;
    const newHeight = newScale / ratio;
    
    // Tính x, y mới sao cho hồng tâm không thay đổi
    const newX = centerX - newWidth / 2;
    const newY = centerY - newHeight / 2;
    
    updateActiveLayout({
      x: Math.round(newX * 10) / 10,
      y: Math.round(newY * 10) / 10,
      width: Math.round(newWidth * 10) / 10,
      height: Math.round(newHeight * 10) / 10,
    });
  };

  const handleToggleCustomLayout = (enable: boolean) => {
    onChange({
      ...config,
      useCustomLayout: enable,
      productLayout: config.productLayout || pLayout,
      logoLayout: config.logoLayout || lLayout,
    });
  };

  const handleResetLayout = () => {
    onChange({
      ...config,
      productLayout: { x: 15, y: 22, width: 70, height: 70, rotation: 0 },
      logoLayout: { x: 70, y: 70, width: 20, height: 20, rotation: 0 },
    });
  };

  // Drag and Drop implementation
  const handleMouseDown = (e: React.MouseEvent, type: "product" | "logo") => {
    e.preventDefault();
    setSelectedElement(type);
    
    if (!useCustomLayout) return; // Drag is disabled if custom layout is off

    isDraggingRef.current = true;
    const currentLayout = type === "product" ? pLayout : lLayout;
    
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      elemX: currentLayout.x,
      elemY: currentLayout.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;

      // Keep within bounds of 0-100 (optional but recommended for UX)
      let newX = Math.round(Math.max(-20, Math.min(120, dragStartRef.current.elemX + deltaX)));
      let newY = Math.round(Math.max(-20, Math.min(120, dragStartRef.current.elemY + deltaY)));

      // Magnetic center snaps (within 2%)
      if (Math.abs(newX + (selectedElement === "product" ? pLayout.width : lLayout.width) / 2 - 50) < 2.5) {
        newX = 50 - (selectedElement === "product" ? pLayout.width : lLayout.width) / 2;
      }
      if (Math.abs(newY + (selectedElement === "product" ? pLayout.height : lLayout.height) / 2 - 50) < 2.5) {
        newY = 50 - (selectedElement === "product" ? pLayout.height : lLayout.height) / 2;
      }

      updateActiveLayout({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [selectedElement, pLayout, lLayout, useCustomLayout]);

  // Calculate Aspect Ratio box dimensions
  const aspectW = config.width || 800;
  const aspectH = config.height || 800;
  const aspectRatio = aspectW / aspectH;

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-xl border border-slate-800 p-6 space-y-5" id="template-designer">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Layout className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Thiết kế Layout mẫu</h3>
            <p className="text-[10px] text-slate-500 font-mono">DRAG // RESIZE // ROTATE TEMPLATE</p>
          </div>
        </div>
      </div>

      {/* Quick Layout Presets Selection */}
      <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chọn nhanh Layout mẫu</span>
          {customPresets.length > 0 && (
            <button
              type="button"
              onClick={handleClearCustomPresets}
              className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              Xóa các mẫu tự tạo
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {allPresets.map((preset) => (
            <div key={preset.id} className="relative group flex items-center">
              <button
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isPresetActive(preset)
                    ? "bg-indigo-600/20 border border-indigo-500 text-indigo-300 shadow-md shadow-indigo-950/10"
                    : "bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>{preset.isSystem ? "⚡" : "👤"}</span>
                {preset.name}
              </button>

              {!preset.isSystem && (
                <button
                  type="button"
                  onClick={() => handleDeletePreset(preset.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-600 hover:bg-rose-500 rounded-full flex items-center justify-center text-[10px] text-white font-black cursor-pointer shadow-md transition-colors"
                  title="Xóa mẫu này"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {/* Save current as custom preset */}
          <button
            type="button"
            onClick={() => {
              setNewPresetName(`Mẫu tự tạo ${customPresets.length + 1}`);
              setShowSaveModal(true);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-dashed border-indigo-500/50 hover:border-indigo-500 text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Lưu mẫu hiện tại
          </button>
        </div>
      </div>

      {/* Interactive Canvas Container */}
      <div className="flex items-center justify-center bg-slate-950 rounded-2xl p-4 border border-slate-800 overflow-hidden relative">
        <div
          ref={containerRef}
          style={{
            aspectRatio: `${aspectRatio}`,
            backgroundColor: config.backgroundColor === "transparent" ? "transparent" : config.backgroundColor,
            backgroundImage: config.backgroundColor === "transparent" ? "linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)" : "none",
            backgroundSize: "8px 8px",
          }}
          className="w-full max-w-[340px] relative shadow-2xl rounded-lg border border-slate-800 overflow-hidden"
        >
          {/* Product Box */}
          <div
            onMouseDown={(e) => handleMouseDown(e, "product")}
            style={{
              left: `${pLayout.x}%`,
              top: `${pLayout.y}%`,
              width: `${pLayout.width}%`,
              height: `${pLayout.height}%`,
              transform: `rotate(${pLayout.rotation}deg)`,
              transformOrigin: "center center",
            }}
            className={`absolute flex items-center justify-center p-1 transition-shadow select-none cursor-move ${
              selectedElement === "product"
                ? "border-2 border-dashed border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/10 z-20"
                : "border border-dashed border-indigo-400/50 bg-indigo-500/5 hover:border-indigo-400"
            }`}
          >
            {productPreviewUrl ? (
              <img
                src={productPreviewUrl}
                alt="Product preview"
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div className="text-center text-indigo-400/80 font-mono text-[9px] pointer-events-none">
                <Move className="w-4 h-4 mx-auto mb-1 animate-pulse" />
                SẢN PHẨM ({Math.round(pLayout.width)}%)
              </div>
            )}
          </div>

          {/* Logo Box */}
          <div
            onMouseDown={(e) => handleMouseDown(e, "logo")}
            style={{
              left: `${lLayout.x}%`,
              top: `${lLayout.y}%`,
              width: `${lLayout.width}%`,
              height: `${lLayout.height}%`,
              transform: `rotate(${lLayout.rotation}deg)`,
              transformOrigin: "center center",
            }}
            className={`absolute flex items-center justify-center p-1 transition-shadow select-none cursor-move ${
              selectedElement === "logo"
                ? "border-2 border-dashed border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10 z-20"
                : "border border-dashed border-emerald-400/50 bg-emerald-500/5 hover:border-emerald-400"
            }`}
          >
            {logoPreviewUrl ? (
              <img
                src={logoPreviewUrl}
                alt="Logo preview"
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div className="text-center text-emerald-400/80 font-mono text-[9px] pointer-events-none">
                <Sparkles className="w-3.5 h-3.5 mx-auto mb-1" />
                LOGO ({Math.round(lLayout.width)}%)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Layer selector tabs */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedElement("canvas")}
            className={`py-2 text-[10px] md:text-xs font-bold rounded-lg transition-all cursor-pointer ${
              selectedElement === "canvas"
                ? "bg-slate-800 text-white shadow-md border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Cấu hình Canvas
          </button>
          <button
            type="button"
            onClick={() => setSelectedElement("product")}
            className={`py-2 text-[10px] md:text-xs font-bold rounded-lg transition-all cursor-pointer ${
              selectedElement === "product"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Căn Ảnh Sản Phẩm
          </button>
          <button
            type="button"
            onClick={() => setSelectedElement("logo")}
            className={`py-2 text-[10px] md:text-xs font-bold rounded-lg transition-all cursor-pointer ${
              selectedElement === "logo"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Căn Logo Brand
          </button>
        </div>

        {/* Quick Precision sliders / Canvas Settings */}
        {selectedElement === "canvas" ? (
          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-4 animate-in fade-in duration-200">
            {/* Title */}
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono border-b border-slate-800 pb-2">
              <span className="text-slate-400">Thiết lập Canvas</span>
              <span>KÍCH THƯỚC • NỀN • CHỐNG LỆCH</span>
            </div>

            {/* Kích thước Thumbnail */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Kích thước (px)</label>
              
              {/* Preset list */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "800 x 800", w: 800, h: 800 },
                  { label: "1200 x 1200", w: 1200, h: 1200 },
                  { label: "1920 x 1080", w: 1920, h: 1080 },
                  { label: "1200 x 630", w: 1200, h: 630 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange({ ...config, width: preset.w, height: preset.h })}
                    className={`py-1.5 px-1 text-[10px] text-center rounded-lg border transition-all cursor-pointer truncate ${
                      config.width === preset.w && config.height === preset.h
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-300 font-semibold"
                        : "border-slate-800 bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Chiều rộng (W)</label>
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    value={config.width}
                    onChange={(e) => onChange({ ...config, width: parseInt(e.target.value) || 800 })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 text-indigo-300 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Chiều cao (H)</label>
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    value={config.height}
                    onChange={(e) => onChange({ ...config, height: parseInt(e.target.value) || 800 })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 text-indigo-300 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Màu nền & Chống lệch cùng một hàng chia 2 cột */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/40 pt-4">
              {/* Màu nền */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Màu nền canvas</label>
                <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <input
                    type="color"
                    value={config.backgroundColor.startsWith("#") ? config.backgroundColor : "#ffffff"}
                    onChange={(e) => onChange({ ...config, backgroundColor: e.target.value })}
                    className="w-7 h-7 p-0 border border-slate-800 bg-transparent rounded cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={config.backgroundColor}
                    onChange={(e) => onChange({ ...config, backgroundColor: e.target.value })}
                    placeholder="#ffffff hoặc transparent"
                    className="w-full px-1.5 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] uppercase font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, backgroundColor: config.backgroundColor === "transparent" ? "#ffffff" : "transparent" })}
                    className={`px-2 py-1 rounded border text-[10px] font-semibold font-mono transition-colors cursor-pointer shrink-0 ${
                      config.backgroundColor === "transparent"
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                        : "border-slate-800 hover:border-slate-700 text-slate-400"
                    }`}
                  >
                    Trong suốt
                  </button>
                </div>
              </div>

              {/* Chống lệch tự động */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Chống lệch tự động</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.autoCenter}
                      onChange={(e) => onChange({ ...config, autoCenter: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="p-2 bg-slate-950/40 rounded-xl border border-slate-800 text-[9px] text-slate-400 leading-normal">
                  Cắt bỏ lề thừa của ảnh gốc, tự động căn sản phẩm vào chính giữa khung hình.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-4 animate-in fade-in duration-200">
            {/* Coordinate display */}
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono border-b border-slate-800 pb-2">
              <span className={selectedElement === "product" ? "text-indigo-400" : "text-emerald-400"}>
                Lớp Đang Chọn: {selectedElement === "product" ? "Sản Phẩm" : "Brand Logo"}
              </span>
              <span>
                X: {Math.round(activeLayout.x)}% | Y: {Math.round(activeLayout.y)}%
              </span>
            </div>

            {/* Slider 1: Scale (%) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <Maximize className="w-3.5 h-3.5 text-slate-500" /> Kích thước (Scale)
                </span>
                <span className="font-mono text-indigo-400">{Math.round(activeLayout.width)}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="120"
                value={Math.round(activeLayout.width)}
                onChange={(e) => handleScaleChange(parseInt(e.target.value))}
                className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Slider 2: Rotation */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <RotateCw className="w-3.5 h-3.5 text-slate-500" /> Góc xoay (Angle)
                </span>
                <span className="font-mono text-indigo-400">{activeLayout.rotation}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={activeLayout.rotation}
                onChange={(e) => updateActiveLayout({ rotation: parseInt(e.target.value) })}
                className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Micro coordinate adjust buttons for accessibility */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => updateActiveLayout({ y: Math.max(-50, activeLayout.y - 1) })}
                className="p-1.5 border border-slate-800 hover:border-slate-700 bg-slate-950 text-[10px] text-slate-300 rounded font-semibold cursor-pointer"
              >
                ▲ LÊN
              </button>
              <button
                type="button"
                onClick={() => updateActiveLayout({ y: Math.min(150, activeLayout.y + 1) })}
                className="p-1.5 border border-slate-800 hover:border-slate-700 bg-slate-950 text-[10px] text-slate-300 rounded font-semibold cursor-pointer"
              >
                ▼ XUỐNG
              </button>
              <button
                type="button"
                onClick={() => updateActiveLayout({ x: Math.max(-50, activeLayout.x - 1) })}
                className="p-1.5 border border-slate-800 hover:border-slate-700 bg-slate-950 text-[10px] text-slate-300 rounded font-semibold cursor-pointer"
              >
                ◀ TRÁI
              </button>
              <button
                type="button"
                onClick={() => updateActiveLayout({ x: Math.min(150, activeLayout.x + 1) })}
                className="p-1.5 border border-slate-800 hover:border-slate-700 bg-slate-950 text-[10px] text-slate-300 rounded font-semibold cursor-pointer"
              >
                ▶ PHẢI
              </button>
            </div>

            {/* Quick helper action keys */}
            <div className="flex gap-2.5 justify-between pt-2">
              <button
                type="button"
                onClick={() => updateActiveLayout({ x: 50 - activeLayout.width / 2, y: 50 - activeLayout.height / 2, rotation: 0 })}
                className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
              >
                <RefreshCw className="w-3 h-3" /> Căn chính giữa
              </button>
              <button
                type="button"
                onClick={handleResetLayout}
                className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer font-bold"
              >
                Khôi phục mặc định
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save Custom Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider">Lưu Layout Tự Chọn</h4>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tên mẫu thiết kế</label>
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Nhập tên mẫu..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCurrentPreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-950/30 cursor-pointer transition-colors"
              >
                Lưu mẫu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
