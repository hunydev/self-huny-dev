import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Pencil, Eraser, Undo2, Redo2, Trash2, X, Palette, Minus, Plus } from 'lucide-react';

// Preset colors for the color palette
const PRESET_COLORS = [
    '#000000', // Black
    '#6B7280', // Gray
    '#EF4444', // Red
    '#F97316', // Orange
    '#EAB308', // Yellow
    '#22C55E', // Green
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#FFFFFF', // White
];

interface Point {
    x: number;
    y: number;
}

export interface SketchCanvasHandle {
    getDataURL: () => string | null;
    clear: () => void;
    isEmpty: () => boolean;
}

interface SketchCanvasProps {
    width?: number;
    height?: number;
    onClose?: () => void;
    onContentChange?: (hasContent: boolean) => void;
    initialData?: string;
}

const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(
    ({ width = 600, height = 300, onClose, onContentChange, initialData }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const [isDrawing, setIsDrawing] = useState(false);
        const [currentColor, setCurrentColor] = useState('#000000');
        const [lineWidth, setLineWidth] = useState(3);
        const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
        const [showColorPicker, setShowColorPicker] = useState(false);

        // Undo/Redo stacks
        const [history, setHistory] = useState<ImageData[]>([]);
        const [historyIndex, setHistoryIndex] = useState(-1);
        const [currentPath, setCurrentPath] = useState<Point[]>([]);

        // Canvas actual dimensions
        const [canvasDimensions, setCanvasDimensions] = useState({ width, height });

        // Update canvas dimensions based on container
        useEffect(() => {
            const updateDimensions = () => {
                if (containerRef.current) {
                    const containerWidth = containerRef.current.clientWidth;
                    setCanvasDimensions({
                        width: containerWidth,
                        height: Math.min(Math.max(200, containerWidth * 0.5), 400),
                    });
                }
            };

            updateDimensions();
            window.addEventListener('resize', updateDimensions);
            return () => window.removeEventListener('resize', updateDimensions);
        }, []);

        // Initialize canvas
        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Set white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Load initial data if provided
            if (initialData) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    saveState();
                };
                img.src = initialData;
            } else {
                saveState();
            }
        }, [canvasDimensions, initialData]);

        // Save current state to history
        const saveState = useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Remove any states after current index (for redo handling)
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(imageData);

            // Limit history to 50 states
            if (newHistory.length > 50) {
                newHistory.shift();
            }

            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }, [history, historyIndex]);

        // Get position from event
        const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
            const canvas = canvasRef.current;
            if (!canvas) return { x: 0, y: 0 };

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            if ('touches' in e) {
                const touch = e.touches[0];
                return {
                    x: (touch.clientX - rect.left) * scaleX,
                    y: (touch.clientY - rect.top) * scaleY,
                };
            } else {
                return {
                    x: (e.clientX - rect.left) * scaleX,
                    y: (e.clientY - rect.top) * scaleY,
                };
            }
        }, []);

        // Draw on canvas
        const draw = useCallback((from: Point, to: Point) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : currentColor;
            ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }, [currentColor, lineWidth, tool]);

        // Event handlers
        const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
            e.preventDefault();
            setIsDrawing(true);
            const pos = getPosition(e);
            setCurrentPath([pos]);
        }, [getPosition]);

        const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
            if (!isDrawing) return;
            e.preventDefault();

            const pos = getPosition(e);
            if (currentPath.length > 0) {
                draw(currentPath[currentPath.length - 1], pos);
            }
            setCurrentPath(prev => [...prev, pos]);
        }, [isDrawing, currentPath, draw, getPosition]);

        const handleEnd = useCallback(() => {
            if (isDrawing) {
                setIsDrawing(false);
                setCurrentPath([]);
                saveState();
                // Notify parent that canvas has content (check inline)
                const canvas = canvasRef.current;
                if (canvas && onContentChange) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        let hasContent = false;
                        for (let i = 0; i < data.length; i += 4) {
                            if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
                                hasContent = true;
                                break;
                            }
                        }
                        onContentChange(hasContent);
                    }
                }
            }
        }, [isDrawing, saveState, onContentChange]);

        // Undo
        const handleUndo = useCallback(() => {
            if (historyIndex <= 0) return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const newIndex = historyIndex - 1;
            ctx.putImageData(history[newIndex], 0, 0);
            setHistoryIndex(newIndex);
            // Notify parent about content change after undo
            if (onContentChange) {
                setTimeout(() => {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    let hasContent = false;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
                            hasContent = true;
                            break;
                        }
                    }
                    onContentChange(hasContent);
                }, 0);
            }
        }, [history, historyIndex, onContentChange]);

        // Redo
        const handleRedo = useCallback(() => {
            if (historyIndex >= history.length - 1) return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const newIndex = historyIndex + 1;
            ctx.putImageData(history[newIndex], 0, 0);
            setHistoryIndex(newIndex);
            // Notify parent about content change after redo
            if (onContentChange) {
                setTimeout(() => {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    let hasContent = false;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
                            hasContent = true;
                            break;
                        }
                    }
                    onContentChange(hasContent);
                }, 0);
            }
        }, [history, historyIndex, onContentChange]);

        // Clear canvas
        const handleClear = useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            saveState();
            // Notify parent that canvas is now empty
            onContentChange?.(false);
        }, [saveState, onContentChange]);

        // Check if canvas is empty (all white)
        const isEmpty = useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return true;

            const ctx = canvas.getContext('2d');
            if (!ctx) return true;

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Check if all pixels are white
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
                    return false;
                }
            }
            return true;
        }, []);

        // Expose methods to parent
        useImperativeHandle(ref, () => ({
            getDataURL: () => {
                const canvas = canvasRef.current;
                if (!canvas || isEmpty()) return null;
                return canvas.toDataURL('image/png');
            },
            clear: handleClear,
            isEmpty,
        }), [handleClear, isEmpty]);

        return (
            <div className="space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Pencil size={16} className="text-violet-500" />
                        <span className="text-sm font-medium text-violet-600">스케치 모드</span>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Canvas Container */}
                <div
                    ref={containerRef}
                    className="relative border-2 border-dashed border-violet-200 rounded-lg overflow-hidden bg-white"
                >
                    <canvas
                        ref={canvasRef}
                        width={canvasDimensions.width}
                        height={canvasDimensions.height}
                        className="touch-none cursor-crosshair block w-full"
                        style={{ height: canvasDimensions.height }}
                        onMouseDown={handleStart}
                        onMouseMove={handleMove}
                        onMouseUp={handleEnd}
                        onMouseLeave={handleEnd}
                        onTouchStart={handleStart}
                        onTouchMove={handleMove}
                        onTouchEnd={handleEnd}
                    />
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    {/* Tool Selection */}
                    <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
                        <button
                            onClick={() => setTool('pen')}
                            className={`p-2 rounded-lg transition-colors ${tool === 'pen'
                                ? 'bg-violet-100 text-violet-700'
                                : 'text-slate-500 hover:bg-slate-100'
                                }`}
                            title="펜"
                        >
                            <Pencil size={18} />
                        </button>
                        <button
                            onClick={() => setTool('eraser')}
                            className={`p-2 rounded-lg transition-colors ${tool === 'eraser'
                                ? 'bg-violet-100 text-violet-700'
                                : 'text-slate-500 hover:bg-slate-100'
                                }`}
                            title="지우개"
                        >
                            <Eraser size={18} />
                        </button>
                    </div>

                    {/* Color Picker */}
                    <div className="relative border-r border-slate-200 pr-2">
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="flex items-center gap-1.5 p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                            title="색상 선택"
                        >
                            <div
                                className="w-5 h-5 rounded-full border-2 border-slate-300"
                                style={{ backgroundColor: currentColor }}
                            />
                            <Palette size={16} />
                        </button>

                        {showColorPicker && (
                            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[180px]">
                                <div className="grid grid-cols-5 gap-1.5">
                                    {PRESET_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => {
                                                setCurrentColor(color);
                                                setShowColorPicker(false);
                                            }}
                                            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${currentColor === color
                                                ? 'border-violet-500 ring-2 ring-violet-200'
                                                : 'border-slate-200'
                                                }`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                    <input
                                        type="color"
                                        value={currentColor}
                                        onChange={(e) => setCurrentColor(e.target.value)}
                                        className="w-full h-8 rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Line Width */}
                    <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
                        <button
                            onClick={() => setLineWidth(Math.max(1, lineWidth - 1))}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                            title="선 두께 감소"
                        >
                            <Minus size={14} />
                        </button>
                        <span className="text-xs text-slate-600 min-w-[24px] text-center">{lineWidth}px</span>
                        <button
                            onClick={() => setLineWidth(Math.min(20, lineWidth + 1))}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                            title="선 두께 증가"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {/* Undo/Redo */}
                    <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="실행 취소"
                        >
                            <Undo2 size={18} />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="다시 실행"
                        >
                            <Redo2 size={18} />
                        </button>
                    </div>

                    {/* Clear */}
                    <button
                        onClick={handleClear}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="전체 지우기"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        );
    }
);

SketchCanvas.displayName = 'SketchCanvas';

export default SketchCanvas;
