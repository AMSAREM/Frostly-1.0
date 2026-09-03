import React, { useMemo } from 'react';
import { QrCode, ShieldCheck } from 'lucide-react';

interface TraceabilityQRCodeProps {
  seed: string;
  lotId: string;
  species: string;
  size?: number;
}

export const TraceabilityQRCode: React.FC<TraceabilityQRCodeProps> = ({
  seed,
  lotId,
  species,
  size = 140
}) => {
  // Generate a deterministic visual matrix pattern based on seed string
  const generateMatrix = (str: string) => {
    const matrix: boolean[][] = [];
    const gridSize = 19;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < gridSize; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < gridSize; c++) {
        // Corner positioning markers (standard QR anchors)
        const isTopLeftCorner = r < 5 && c < 5;
        const isTopRightCorner = r < 5 && c >= gridSize - 5;
        const isBottomLeftCorner = r >= gridSize - 5 && c < 5;

        if (isTopLeftCorner || isTopRightCorner || isBottomLeftCorner) {
          const isBorder = r === 0 || r === 4 || c === 0 || c === 4 || 
                           r === gridSize - 1 || r === gridSize - 5 || 
                           c === gridSize - 1 || c === gridSize - 5;
          const isCenter = (r === 2 && c === 2) || 
                           (r === 2 && c === gridSize - 3) || 
                           (r === gridSize - 3 && c === 2);
          row.push(isBorder || isCenter);
        } else {
          // Deterministic pseudorandom fill based on hash and cell
          const cellVal = Math.sin((r * gridSize + c) * 31 + hash) * 10000;
          row.push((cellVal - Math.floor(cellVal)) > 0.46);
        }
      }
      matrix.push(row);
    }
    return matrix;
  };

  const matrix = useMemo(() => generateMatrix(seed + lotId), [seed, lotId]);
  const cellSize = size / matrix.length;

  return (
    <div id={`qr-${lotId}`} className="flex flex-col items-center bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="relative p-1 bg-white rounded-xl">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg">
          <rect width={size} height={size} fill="#ffffff" />
          {matrix.map((row, rIdx) =>
            row.map((isDark, cIdx) =>
              isDark ? (
                <rect
                  key={`${rIdx}-${cIdx}`}
                  x={cIdx * cellSize}
                  y={rIdx * cellSize}
                  width={cellSize + 0.3}
                  height={cellSize + 0.3}
                  fill="#1e1b4b"
                  rx={0.8}
                />
              ) : null
            )
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 backdrop-blur-sm p-1 rounded-md shadow-sm border border-indigo-100 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          </div>
        </div>
      </div>
      
      <div className="mt-2 text-center">
        <div className="text-[11px] font-mono-code font-bold text-slate-800 tracking-wider">
          {lotId}
        </div>
        <div className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
          {species}
        </div>
      </div>
    </div>
  );
};
