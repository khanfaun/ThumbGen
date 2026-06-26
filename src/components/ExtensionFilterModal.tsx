import React from "react";
import { Filter, Check } from "lucide-react";

interface ExtensionFilterModalProps {
  isOpen: boolean;
  files: { name: string }[];
  detectedExtensions: string[];
  selectedExtensions: string[];
  onToggleExtension: (ext: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  mainFolderName?: string;
  onChangeMainFolderName?: (name: string) => void;
}

export default function ExtensionFilterModal({
  isOpen,
  files,
  detectedExtensions,
  selectedExtensions,
  onToggleExtension,
  onCancel,
  onConfirm,
  mainFolderName = "",
  onChangeMainFolderName,
}: ExtensionFilterModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Filter className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Lọc đuôi file thư mục</h3>
            <p className="text-[10px] text-slate-400">Chọn định dạng tệp bạn muốn tải lên</p>
          </div>
        </div>

        <div className="space-y-3">
          {onChangeMainFolderName && (
            <div className="space-y-1.5 bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Tên thư mục xuất chính (ZIP)</label>
              <input
                type="text"
                value={mainFolderName}
                onChange={(e) => onChangeMainFolderName(e.target.value)}
                placeholder="Ví dụ: JBL Clip 5"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none transition-all placeholder:text-slate-600"
              />
            </div>
          )}

          <p className="text-xs text-slate-300">
            Phát hiện <span className="font-bold text-indigo-400 font-mono">{files.length}</span> tệp hình ảnh. Hãy chọn các loại đuôi file mong muốn:
          </p>

          <div className="space-y-2">
            {detectedExtensions.map((ext) => {
              const count = files.filter(f => {
                const parts = f.name.split(".");
                return parts.length > 1 && parts[parts.length - 1].toUpperCase() === ext;
              }).length;
              const isChecked = selectedExtensions.includes(ext);

              return (
                <button
                  key={ext}
                  type="button"
                  onClick={() => onToggleExtension(ext)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                    isChecked
                      ? "border-indigo-500/80 bg-indigo-950/20 text-slate-200"
                      : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      isChecked
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-slate-700 bg-slate-950"
                    }`}>
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-bold font-mono tracking-wider">.{ext}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                    {count} file
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 px-4 border border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={selectedExtensions.length === 0}
            className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
          >
            Tải lên {files.filter(f => {
              const parts = f.name.split(".");
              const ext = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
              return selectedExtensions.includes(ext);
            }).length} tệp
          </button>
        </div>
      </div>
    </div>
  );
}
