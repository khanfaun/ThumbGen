import React from "react";
import { ProcessingHistoryItem } from "../types";
import { History, Trash2, RotateCcw, Calendar, CheckSquare, Settings } from "lucide-react";

interface HistoryPanelProps {
  history: ProcessingHistoryItem[];
  onApplyConfig: (config: any) => void;
  onClearHistory: () => void;
  heightClass?: string;
}

export default function HistoryPanel({
  history,
  onApplyConfig,
  onClearHistory,
  heightClass,
}: HistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-xl border border-slate-800 p-5 space-y-4" id="history-panel">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Lịch sử xử lý</h3>
        </div>
        <button
          onClick={onClearHistory}
          className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 hover:bg-rose-950/30 px-2.5 py-1.5 border border-rose-900/30 rounded-lg cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả
        </button>
      </div>

      {/* History Items List */}
      <div className={`space-y-3 overflow-y-auto divide-y divide-slate-800/40 pr-1 custom-scrollbar ${heightClass || "max-h-[250px]"}`}>
        {history.map((item) => {
          const date = new Date(item.timestamp).toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          });

          return (
            <div key={item.id} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 truncate max-w-[150px] sm:max-w-[250px]">
                    {item.folderName || "Ảnh tải lên trực tiếp"}
                  </span>
                  <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400 flex items-center gap-1 font-mono">
                    <CheckSquare className="w-3 h-3 text-emerald-400" /> {item.successfulImages}/{item.totalImages} ảnh
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-600" /> {date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Settings className="w-3 h-3 text-slate-600" /> {item.config.width}x{item.config.height}px • Padding {item.config.paddingPercent}%
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApplyConfig(item.config)}
                  className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-900 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                  title="Áp dụng lại cấu hình này"
                >
                  <RotateCcw className="w-3 h-3 text-indigo-400" /> Cấu hình gốc
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
