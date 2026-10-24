import React, { useRef, useEffect, useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { socket } from './socket';
import './WhiteboardCanvas.css';

// Tool types
const TOOLS = {
  PEN: 'pen',
  ERASER: 'eraser',
  LINE: 'line',
  RECT: 'rect',
  LASER: 'laser'
};

const COLORS = ['#6366f1', '#a78bfa', '#38bdf8', '#4ade80', '#f59e0b', '#f87171', '#ffffff', '#000000'];

// Urdu Phonetic Mapping for standard Latin/English keyboards
const URDU_PHONETIC_MAP = {
  'a': 'ا', 'A': 'آ',
  'b': 'ب', 'B': 'ّ',
  'p': 'پ', 'P': 'ُ',
  't': 'ت', 'T': 'ٹ',
  'c': 'چ', 'C': 'ث',
  'j': 'ج', 'J': 'ض',
  'h': 'ح', 'H': 'ھ',
  'k': 'ک', 'K': 'خ',
  'd': 'د', 'D': 'ڈ',
  'r': 'ر', 'R': 'ڑ',
  'z': 'ز', 'Z': 'ذ',
  's': 'س', 'S': 'ص',
  'x': 'ش', 'X': 'ژ',
  'f': 'ف', 'F': 'ٖ',
  'q': 'ق', 'Q': 'ْ',
  'g': 'گ', 'G': 'غ',
  'l': 'ل', 'L': 'ل',
  'm': 'م', 'M': 'ً',
  'n': 'ن', 'N': 'ں',
  'v': 'ط', 'V': 'ظ',
  'w': 'و', 'W': 'ؤ',
  'e': 'ع', 'E': 'ء',
  'y': 'ے', 'Y': 'ي',
  'i': 'ی', 'I': 'ٰ',
  'o': 'ہ', 'O': 'ۃ',
  'u': 'ء', 'U': 'ئ',
  '?': '؟', ',': '،', ';': '؛', '.': '۔'
};

// Character strip for on-screen touch and click input on mobile and desktop
const URDU_QUICK_CHARS = [
  'ا', 'آ', 'ب', 'پ', 'ت', 'ٹ', 'ث', 'ج', 'چ', 'ح', 'خ',
  'د', 'ڈ', 'ذ', 'ر', 'ڑ', 'ز', 'ژ', 'س', 'ش', 'ص', 'ض',
  'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن',
  'ں', 'و', 'ہ', 'ھ', 'ء', 'ی', 'ے', '۔', '،', '؟'
];

function WhiteboardCanvas({ roomId, user, theme }) {
  const canvasRef     = useRef(null);
  const isDrawingRef  = useRef(false);
  const prevCoord     = useRef({ x: 0, y: 0 });
  const snapshotRef   = useRef(null); // for shape preview

  // Undo / Redo stacks
  const undoStackRef  = useRef([]);
  const redoStackRef  = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const isLightMode = theme === 'light' || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light');
  const [tool, setTool]           = useState(TOOLS.PEN);
  const [color, setColor]         = useState(isLightMode ? '#0f172a' : '#6366f1');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(false);

  // Student Drawing Permission & Stylus Support
  const [allowStudentDraw, setAllowStudentDraw] = useState(false);

  // Dual Mode (Typing Pad + Whiteboard Canvas) & Urdu Mode
  const [isDualMode, setIsDualMode] = useState(true);
  const [isUrduMode, setIsUrduMode] = useState(false);
  const [activeMobileWbTab, setActiveMobileWbTab] = useState('canvas'); // 'canvas' | 'notes'
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [typedNotes, setTypedNotes] = useState("Welcome students to today's live session!");
  const [typingFontSize, setTypingFontSize] = useState(20);
  const [typingTextColor, setTypingTextColor] = useState('#ffffff');
  const [isTypingSyncing, setIsTypingSyncing] = useState(false);

  const handleTeacherNoteChange = (newText) => {
    setTypedNotes(newText);
    socket.emit('whiteboard-typing-sync', {
      roomId,
      notes: newText,
      fontSize: typingFontSize,
      textColor: typingTextColor
    });
  };

  const handleToggleStudentDraw = () => {
    if (!isInstructor) return;
    const nextVal = !allowStudentDraw;
    setAllowStudentDraw(nextVal);
    socket.emit('toggle-whiteboard-student-draw', { roomId, allowed: nextVal });
    showToast(nextVal ? '✏️ Student drawing enabled!' : '🔒 Student drawing locked');
  };

  const insertUrduCharacter = (char) => {
    const el = textareaRef.current;
    if (!el) {
      handleTeacherNoteChange(typedNotes + char);
      return;
    }
    const start = el.selectionStart ?? typedNotes.length;
    const end = el.selectionEnd ?? typedNotes.length;
    const updated = typedNotes.substring(0, start) + char + typedNotes.substring(end);
    handleTeacherNoteChange(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + char.length, start + char.length);
      }
    }, 0);
  };

  const handleKeyDownUrdu = (e) => {
    if (!isUrduMode) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key && e.key.length === 1 && URDU_PHONETIC_MAP[e.key]) {
      e.preventDefault();
      insertUrduCharacter(URDU_PHONETIC_MAP[e.key]);
    }
  };

  // Laser Pointer State
  const [localLaser, setLocalLaser]   = useState({ active: false, x: 0, y: 0 });
  const [remoteLaser, setRemoteLaser] = useState({ active: false, x: 0, y: 0, senderName: '' });
  const remoteLaserTimeoutRef         = useRef(null);

  // Toast inside Whiteboard
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef(null);

  const isInstructor = user?.role === 'instructor';

  const showToast = (msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(''), 2600);
  };

  const getCtx = () => canvasRef.current?.getContext('2d');

  // Push current canvas state to undo stack
  const pushUndoState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL();
      undoStackRef.current.push(dataUrl);
      if (undoStackRef.current.length > 30) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    } catch (err) {
      console.warn('Failed to push undo state:', err);
    }
  }, []);

  // Restore snapshot onto canvas
  const restoreSnapshot = useCallback((snapshotUrl, broadcast = false) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx || !snapshotUrl) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = snapshotUrl;

    if (broadcast) {
      socket.emit('whiteboard-restore-snapshot', { roomId, snapshot: snapshotUrl });
    }
  }, [roomId]);

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Save current state to redo
    const current = canvas.toDataURL();
    redoStackRef.current.push(current);

    const prevSnapshot = undoStackRef.current.pop();
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);

    restoreSnapshot(prevSnapshot, true);
    showToast('↩️ Undo');
  }, [restoreSnapshot]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const current = canvas.toDataURL();
    undoStackRef.current.push(current);

    const nextSnapshot = redoStackRef.current.pop();
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);

    restoreSnapshot(nextSnapshot, true);
    showToast('↪️ Redo');
  }, [restoreSnapshot]);

  const textareaRef = useRef(null);

  // Save typed notes to storage & broadcast live sync to all students (without drawing on canvas)
  const handleSaveNotes = useCallback(() => {
    if (!typedNotes || !typedNotes.trim()) return;

    try {
      if (roomId) {
        localStorage.setItem(`synclearn_typed_notes_${roomId}`, typedNotes);
      }
    } catch (e) {
      console.warn('Failed to save typed notes:', e);
    }

    socket.emit('whiteboard-typing-sync', {
      roomId,
      notes: typedNotes,
      fontSize: typingFontSize,
      textColor: typingTextColor
    });

    showToast('💾 Notes saved & synced in Typing Pad!');
  }, [typedNotes, typingFontSize, typingTextColor, roomId]);

  // Highlight selected word or insert ==word== highlight tags in Typing Pad
  const handleHighlightSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = typedNotes.substring(start, end);
    let newText = '';
    if (selected && selected.trim()) {
      newText = typedNotes.substring(0, start) + `==${selected}==` + typedNotes.substring(end);
    } else {
      newText = typedNotes.substring(0, start) + `==important concept==` + typedNotes.substring(end);
    }
    handleTeacherNoteChange(newText);
    showToast('🖍️ Word highlighted in Typing Pad!');
  }, [typedNotes, handleTeacherNoteChange]);

  // Pin current line in Typing Pad with 📌
  const handlePinPoint = useCallback(() => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : 0;
    const before = typedNotes.substring(0, start);
    const lastNewline = before.lastIndexOf('\n');
    const insertPos = lastNewline === -1 ? 0 : lastNewline + 1;
    const newText = typedNotes.substring(0, insertPos) + '📌 ' + typedNotes.substring(insertPos);
    handleTeacherNoteChange(newText);
    showToast('📌 Line pinned in Typing Pad!');
  }, [typedNotes, handleTeacherNoteChange]);

  // Formatted renderer for notes with highlight badges, pinned points & Urdu support
  const renderFormattedNotes = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      const parts = line.split(/(==[^=]+==)/g);
      const isPinned = line.startsWith('📌');
      const isHeading = line.startsWith('#');
      const isUrduLine = /[\u0600-\u06FF]/.test(line);

      return (
        <div
          key={idx}
          dir={isUrduLine ? 'rtl' : 'ltr'}
          style={{
            minHeight: '1.4em',
            marginBottom: isHeading ? '0.4rem' : '0.15rem',
            padding: isPinned ? '3px 8px' : '0',
            background: isPinned ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            borderLeft: !isUrduLine && isPinned ? '3px solid #38bdf8' : 'none',
            borderRight: isUrduLine && isPinned ? '3px solid #38bdf8' : 'none',
            borderRadius: isPinned ? '4px' : '0',
            fontWeight: isHeading ? 700 : 'normal',
            color: isHeading ? '#38bdf8' : 'inherit',
            fontFamily: isUrduLine ? "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, sans-serif" : 'inherit',
            lineHeight: isUrduLine ? 1.85 : 1.5,
            textAlign: isUrduLine ? 'right' : 'left'
          }}
        >
          {parts.map((part, pIdx) => {
            if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
              const word = part.slice(2, -2);
              return (
                <mark
                  key={pIdx}
                  style={{
                    background: '#fef08a',
                    color: '#854d0e',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}
                >
                  {word}
                </mark>
              );
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </div>
      );
    });
  };

  // Resize handler using ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const handleResize = () => {
      if (!canvas.parentElement) return;
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dataURL = canvas.toDataURL();
      canvas.width  = rect.width;
      canvas.height = rect.height;

      const img = new Image();
      img.onload = () => getCtx()?.drawImage(img, 0, 0);
      img.src = dataURL;
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(canvas.parentElement);

    window.addEventListener('resize', handleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Keyboard shortcuts for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Socket listeners
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;

    const handleDrawStroke = (data) => {
      const c = canvasRef.current;
      if (!c || !ctx) return;

      const prevX = data.normPrevX != null ? data.normPrevX * c.width : data.prevX;
      const prevY = data.normPrevY != null ? data.normPrevY * c.height : data.prevY;
      const x = data.normX != null ? data.normX * c.width : data.x;
      const y = data.normY != null ? data.normY * c.height : data.y;

      ctx.strokeStyle = data.color || '#6366f1';
      ctx.lineWidth   = data.lineWidth || 3;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalCompositeOperation = data.tool === TOOLS.ERASER ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    };

    const handleDrawShape = (data) => {
      if (!data.snapshot) return;
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current;
        const cx = c?.getContext('2d');
        if (!cx || !c) return;
        cx.clearRect(0, 0, c.width, c.height);
        cx.drawImage(img, 0, 0);
        cx.strokeStyle = data.color;
        cx.lineWidth   = data.lineWidth;
        cx.lineCap     = 'round';
        if (data.tool === TOOLS.LINE) {
          cx.beginPath(); cx.moveTo(data.startX, data.startY); cx.lineTo(data.endX, data.endY); cx.stroke();
        } else if (data.tool === TOOLS.RECT) {
          cx.strokeRect(data.startX, data.startY, data.endX - data.startX, data.endY - data.startY);
        }
      };
      img.src = data.snapshot;
    };

    const handleClear = () => {
      const c = canvasRef.current;
      getCtx()?.clearRect(0, 0, c.width, c.height);
    };

    const handleRestoreRemote = (data) => {
      if (data?.snapshot) {
        restoreSnapshot(data.snapshot, false);
      }
      if (data?.notes !== undefined) {
        setTypedNotes(data.notes);
        if (data.fontSize) setTypingFontSize(data.fontSize);
        if (data.textColor) setTypingTextColor(data.textColor);
      }
    };

    const handleTypingSync = (data) => {
      if (data?.notes !== undefined) {
        setTypedNotes(data.notes);
        if (data.fontSize) setTypingFontSize(data.fontSize);
        if (data.textColor) setTypingTextColor(data.textColor);
      }
    };

    const handleRemoteLaser = (data) => {
      if (data?.active) {
        setRemoteLaser(data);
        if (remoteLaserTimeoutRef.current) clearTimeout(remoteLaserTimeoutRef.current);
        remoteLaserTimeoutRef.current = setTimeout(() => {
          setRemoteLaser(prev => ({ ...prev, active: false }));
        }, 3000);
      } else {
        setRemoteLaser(prev => ({ ...prev, active: false }));
      }
    };

    const handleSendCanvasState = (data) => {
      if (isInstructor && canvasRef.current) {
        try {
          const snapshot = canvasRef.current.toDataURL();
          socket.emit('canvas-state-response', {
            targetSocketId: data?.targetSocketId,
            snapshot,
            notes: typedNotes,
            fontSize: typingFontSize,
            textColor: typingTextColor
          });
        } catch (e) {
          console.warn('Failed to send canvas state snapshot:', e);
        }
      }
    };

    socket.on('draw-stroke',  handleDrawStroke);
    socket.on('draw-shape',   handleDrawShape);
    socket.on('clear-canvas', handleClear);
    socket.on('whiteboard-restore-snapshot', handleRestoreRemote);
    socket.on('whiteboard-laser', handleRemoteLaser);
    socket.on('whiteboard-typing-sync', handleTypingSync);
    socket.on('send-canvas-state', handleSendCanvasState);
    const handleStudentDrawStatus = ({ allowed }) => {
      setAllowStudentDraw(Boolean(allowed));
    };
    socket.on('whiteboard-student-draw-status', handleStudentDrawStatus);

    // If student, request current canvas state from instructor with retries
    let t1, t2;
    if (!isInstructor && roomId) {
      socket.emit('request-canvas-state', { roomId });
      t1 = setTimeout(() => socket.emit('request-canvas-state', { roomId }), 600);
      t2 = setTimeout(() => socket.emit('request-canvas-state', { roomId }), 1800);
    }

    const handleReconnect = () => {
      if (!isInstructor && roomId) {
        socket.emit('request-canvas-state', { roomId });
      }
    };
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('draw-stroke',  handleDrawStroke);
      socket.off('draw-shape',   handleDrawShape);
      socket.off('clear-canvas', handleClear);
      socket.off('whiteboard-restore-snapshot', handleRestoreRemote);
      socket.off('whiteboard-laser', handleRemoteLaser);
      socket.off('whiteboard-typing-sync', handleTypingSync);
      socket.off('send-canvas-state', handleSendCanvasState);
      socket.off('whiteboard-student-draw-status', handleStudentDrawStatus);
      socket.off('connect', handleReconnect);
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      if (remoteLaserTimeoutRef.current) clearTimeout(remoteLaserTimeoutRef.current);
    };
  }, [restoreSnapshot, isInstructor, roomId]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getEffectiveLineWidth = (e, baseWidth, isEraser) => {
    if (isEraser) return baseWidth * 4;
    // Pressure sensitivity for digital stylus / pen (0.0 to 1.0)
    if (e && e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0) {
      return Math.max(1, Math.round(baseWidth * (0.4 + e.pressure * 1.2)));
    }
    return Number(baseWidth);
  };

  const startDrawing = (e) => {
    // Check permission: strictly Teacher or student if teacher explicitly enabled
    const canDraw = isInstructor || allowStudentDraw;

    if (!canDraw) {
      showToast('🔒 Drawing locked by teacher.');
      return;
    }

    if (isInstructor && !isDrawingEnabled && tool !== TOOLS.LASER) {
      showToast('🔒 Drawing locked. Click "✏️ Drawing Locked" above to enable pen!');
      return;
    }

    const { x, y } = getPos(e);

    if (tool === TOOLS.LASER) {
      setLocalLaser({ active: true, x, y });
      socket.emit('whiteboard-laser', {
        roomId,
        active: true,
        x, y,
        senderName: user?.name || (isInstructor ? 'Instructor' : 'Presenter')
      });
      return;
    }

    // Save snapshot to undo stack before new stroke begins
    pushUndoState();

    prevCoord.current = { x, y };
    isDrawingRef.current = true;

    // Snapshot for shape preview
    if (tool === TOOLS.LINE || tool === TOOLS.RECT) {
      snapshotRef.current = canvasRef.current.toDataURL();
    }
    const ctx = getCtx();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    const isPen = e.pointerType === 'pen';
    const canDraw = isInstructor || allowStudentDraw || isPen;
    if (!canDraw) return;
    if (isInstructor && !isDrawingEnabled && tool !== TOOLS.LASER && !isPen) return;

    const { x, y } = getPos(e);

    // Laser pointer movement (doesn't require mouse down)
    if (tool === TOOLS.LASER) {
      setLocalLaser({ active: true, x, y });
      socket.emit('whiteboard-laser', {
        roomId,
        active: true,
        x, y,
        senderName: user?.name || (isInstructor ? 'Instructor' : 'Presenter')
      });
      return;
    }

    if (!isDrawingRef.current) return;
    const ctx = getCtx();
    const canvas = canvasRef.current;

    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      const strokeW = getEffectiveLineWidth(e, lineWidth, tool === TOOLS.ERASER);
      ctx.globalCompositeOperation = tool === TOOLS.ERASER ? 'destination-out' : 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth   = strokeW;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo(prevCoord.current.x, prevCoord.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      socket.emit('draw-stroke', {
        roomId,
        prevX: prevCoord.current.x, prevY: prevCoord.current.y,
        x, y,
        normPrevX: canvas && canvas.width ? prevCoord.current.x / canvas.width : undefined,
        normPrevY: canvas && canvas.height ? prevCoord.current.y / canvas.height : undefined,
        normX: canvas && canvas.width ? x / canvas.width : undefined,
        normY: canvas && canvas.height ? y / canvas.height : undefined,
        color,
        lineWidth: strokeW,
        tool,
      });
      prevCoord.current = { x, y };

    } else if (tool === TOOLS.LINE || tool === TOOLS.RECT) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.strokeStyle = color;
        ctx.lineWidth   = Number(lineWidth);
        ctx.lineCap     = 'round';
        if (tool === TOOLS.LINE) {
          ctx.beginPath(); ctx.moveTo(prevCoord.current.x, prevCoord.current.y); ctx.lineTo(x, y); ctx.stroke();
        } else {
          ctx.strokeRect(prevCoord.current.x, prevCoord.current.y, x - prevCoord.current.x, y - prevCoord.current.y);
        }
      };
      img.src = snapshotRef.current;
    }
  };

  const stopDrawing = (e) => {
    if (tool === TOOLS.LASER) {
      return; // Laser stays tracked on hover
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (tool === TOOLS.LINE || tool === TOOLS.RECT) {
      const { x, y } = getPos(e);
      socket.emit('draw-shape', {
        roomId, tool, color,
        lineWidth: Number(lineWidth),
        startX: prevCoord.current.x, startY: prevCoord.current.y,
        endX: x, endY: y,
        snapshot: snapshotRef.current,
      });
      snapshotRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (tool === TOOLS.LASER) {
      setLocalLaser(prev => ({ ...prev, active: false }));
      socket.emit('whiteboard-laser', { roomId, active: false });
    } else {
      isDrawingRef.current = false;
    }
  };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pushUndoState();
    getCtx()?.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear-canvas', { roomId });
    showToast('🗑️ Canvas cleared');
  };

  // ─── Export Handlers ───
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create offscreen canvas with solid theme-appropriate background
    const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const oCtx = offscreen.getContext('2d');

    // Draw background
    oCtx.fillStyle = isLight ? '#ffffff' : '#0a0f1e';
    oCtx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Draw whiteboard drawing
    oCtx.drawImage(canvas, 0, 0);

    // SyncLearn watermark & timestamp
    oCtx.font = 'bold 13px system-ui, sans-serif';
    oCtx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)';
    oCtx.fillText(`SyncLearn Whiteboard • Room: ${roomId || 'Live'} • ${new Date().toLocaleDateString()}`, 16, offscreen.height - 16);

    const link = document.createElement('a');
    link.download = `synclearn-whiteboard-${roomId || 'session'}.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
    showToast('📸 Downloaded as PNG!');
  };

  const handleExportPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const oCtx = offscreen.getContext('2d');

      oCtx.fillStyle = isLight ? '#ffffff' : '#0a0f1e';
      oCtx.fillRect(0, 0, offscreen.width, offscreen.height);
      oCtx.drawImage(canvas, 0, 0);

      oCtx.font = 'bold 13px system-ui, sans-serif';
      oCtx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)';
      oCtx.fillText(`SyncLearn Whiteboard • Room: ${roomId || 'Live'} • ${new Date().toLocaleString()}`, 16, offscreen.height - 16);

      const imgData = offscreen.toDataURL('image/png');
      const isLandscape = canvas.width >= canvas.height;

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`synclearn-whiteboard-${roomId || 'session'}.pdf`);
      showToast('📄 Downloaded as PDF!');
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast('⚠️ PDF export error');
    }
  };

  // Save & Export typed lecture notes directly as PDF (Full Unicode, Urdu Nastaliq & Highlight Support)
  const handleExportNotesPDF = () => {
    if (!typedNotes || !typedNotes.trim()) {
      showToast('⚠️ No notes to export');
      return;
    }
    try {
      showToast('⏳ Generating PDF notes...');
      const lines = typedNotes.split('\n');

      const canvasWidth = 1240;
      const pageHeightPx = 1754;
      const margin = 70;
      const contentWidth = canvasWidth - (margin * 2);

      const pages = [];
      let currentPageCanvas = document.createElement('canvas');
      currentPageCanvas.width = canvasWidth;
      currentPageCanvas.height = pageHeightPx;
      let ctx = currentPageCanvas.getContext('2d');

      const renderHeader = (cCtx, pageNum) => {
        cCtx.fillStyle = '#ffffff';
        cCtx.fillRect(0, 0, canvasWidth, pageHeightPx);

        // Header slate banner
        cCtx.fillStyle = '#0f172a';
        cCtx.fillRect(0, 0, canvasWidth, 140);

        // Title
        cCtx.fillStyle = '#ffffff';
        cCtx.font = 'bold 36px "Segoe UI", Roboto, sans-serif';
        cCtx.textAlign = 'left';
        cCtx.fillText('SyncLearn — Teacher Lecture Notes', margin, 65);

        // Subtitle & Metadata
        cCtx.fillStyle = '#94a3b8';
        cCtx.font = '20px "Segoe UI", Roboto, sans-serif';
        cCtx.fillText(`Classroom ID: ${roomId || 'Live Room'}   |   Date: ${new Date().toLocaleString()}`, margin, 105);

        // Footer
        cCtx.fillStyle = '#94a3b8';
        cCtx.font = '18px "Segoe UI", Roboto, sans-serif';
        cCtx.textAlign = 'center';
        cCtx.fillText(`SyncLearn Live Classroom  •  Page ${pageNum}`, canvasWidth / 2, pageHeightPx - 40);
      };

      let pageNumber = 1;
      renderHeader(ctx, pageNumber);
      let curY = 195;
      const defaultLineHeight = 38;

      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        if (!rawLine.trim()) {
          curY += 20;
          continue;
        }

        const isUrdu = /[\u0600-\u06FF]/.test(rawLine);
        const isHeading = rawLine.startsWith('#') || rawLine.startsWith('Topic:') || rawLine.startsWith('Chapter:');
        const isPinned = rawLine.startsWith('📌');

        const cleanLine = isHeading && rawLine.startsWith('#') ? rawLine.replace(/^#+\s*/, '') : rawLine;
        const fontName = isUrdu 
          ? '"Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", "Segoe UI", Tahoma, sans-serif'
          : '"Segoe UI", Roboto, Helvetica, Arial, sans-serif';

        const fontSize = isHeading ? 30 : 22;
        const lineHeight = isUrdu ? 52 : (isHeading ? 46 : defaultLineHeight);

        // Page break check
        if (curY + lineHeight > pageHeightPx - 90) {
          pages.push(currentPageCanvas);
          currentPageCanvas = document.createElement('canvas');
          currentPageCanvas.width = canvasWidth;
          currentPageCanvas.height = pageHeightPx;
          ctx = currentPageCanvas.getContext('2d');
          pageNumber++;
          renderHeader(ctx, pageNumber);
          curY = 195;
        }

        // Pinned line highlight pill background
        if (isPinned) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(margin - 10, curY - 26, contentWidth + 20, lineHeight + 6, 8);
            ctx.fill();
          } else {
            ctx.fillRect(margin - 10, curY - 26, contentWidth + 20, lineHeight + 6);
          }
        }

        ctx.font = `${isHeading ? 'bold' : 'normal'} ${fontSize}px ${fontName}`;

        if (isUrdu) {
          ctx.textAlign = 'right';
          ctx.fillStyle = isHeading ? '#0284c7' : '#1e293b';
          ctx.fillText(cleanLine, canvasWidth - margin, curY);
        } else {
          ctx.textAlign = 'left';
          const parts = cleanLine.split(/(==[^=]+==)/g);
          let curX = margin;

          parts.forEach(part => {
            if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
              const text = part.slice(2, -2);
              ctx.font = `bold ${fontSize}px ${fontName}`;
              const textWidth = ctx.measureText(text).width;

              ctx.fillStyle = '#fef08a';
              if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(curX - 4, curY - fontSize + 4, textWidth + 8, fontSize + 8, 4);
                ctx.fill();
              } else {
                ctx.fillRect(curX - 4, curY - fontSize + 4, textWidth + 8, fontSize + 8);
              }

              ctx.fillStyle = '#854d0e';
              ctx.fillText(text, curX, curY);
              curX += textWidth + 8;
            } else if (part) {
              ctx.font = `${isHeading ? 'bold' : 'normal'} ${fontSize}px ${fontName}`;
              ctx.fillStyle = isHeading ? '#0284c7' : '#1e293b';
              ctx.fillText(part, curX, curY);
              curX += ctx.measureText(part).width;
            }
          });
        }

        curY += lineHeight;
      }

      pages.push(currentPageCanvas);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      pages.forEach((pageCanvas, idx) => {
        if (idx > 0) pdf.addPage();
        const imgData = pageCanvas.toDataURL('image/png', 0.95);
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      });

      pdf.save(`Lecture_Notes_${roomId || 'SyncLearn'}_${Date.now()}.pdf`);
      showToast('📄 Notes saved as PDF with full formatting & Urdu support!');
    } catch (err) {
      console.error('Notes PDF export failed:', err);
      showToast('⚠️ Notes PDF error');
    }
  };

  return (
    <div className="whiteboard-wrapper">
      {/* Mobile Tab Switcher: Instantly switch between Canvas & Notes on phone */}
      <div className="wb-mobile-tab-bar">
        <button
          type="button"
          className={`wb-mobile-tab-btn ${activeMobileWbTab === 'canvas' ? 'active' : ''}`}
          onClick={() => setActiveMobileWbTab('canvas')}
        >
          🎨 Whiteboard Canvas
        </button>
        <button
          type="button"
          className={`wb-mobile-tab-btn ${activeMobileWbTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveMobileWbTab('notes')}
        >
          📝 Notes Pad
        </button>
      </div>

      {/* ─── Main Workspace: Dual Split (Typing Pad on Left, Canvas on Right) ─── */}
      <div className={`wb-split-workspace ${isDualMode ? 'dual-active' : ''} mobile-${activeMobileWbTab}`}>
        {/* Left Pane: Keyboard Typing Studio */}
        {isDualMode && (
          <aside className="wb-typing-panel">
            {isInstructor ? (
              <>
                <div className="wb-typing-header">
                  <div className="wb-typing-header-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '1.15rem' }}>⌨️</span>
                      <h4 className="wb-typing-title">Typing Pad</h4>
                    </div>

                    <div className="wb-typing-header-actions">
                      {/* Urdu / English Language Mode Toggle */}
                      <button
                        type="button"
                        className={`wb-lang-toggle-btn ${isUrduMode ? 'urdu-active' : ''}`}
                        onClick={() => {
                          setIsUrduMode(!isUrduMode);
                          showToast(!isUrduMode ? '🇵🇰 Urdu typing mode enabled (Phonetic keyboard & on-screen keys ready)' : '🇬🇧 English typing mode active');
                        }}
                        title={isUrduMode ? "Switch to English Typing" : "Switch to Urdu Typing (اردو ٹائپنگ)"}
                      >
                        <span>{isUrduMode ? '🇵🇰 اردو ON' : '🇬🇧 ENG'}</span>
                      </button>

                      {/* Save / Export Notes as PDF Button */}
                      <button
                        type="button"
                        className="wb-export-notes-btn"
                        onClick={handleExportNotesPDF}
                        title="Save typed lecture notes directly as PDF document"
                      >
                        <span>📥 Export PDF</span>
                      </button>
                    </div>
                  </div>

                  <span className="wb-typing-subtitle">
                    Type, highlight words & live sync notes
                  </span>
                </div>

                {/* Word Highlight & Pin Formatting Bar */}
                <div className="wb-typing-toolbar">
                  <button
                    type="button"
                    onClick={handleHighlightSelection}
                    className="wb-typing-format-btn highlight-btn"
                    title="Highlight selected word or insert ==word=="
                  >
                    <span>🖍️ Highlight Word</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePinPoint}
                    className="wb-typing-format-btn pin-btn"
                    title="Pin this line with 📌"
                  >
                    <span>📌 Pin Line</span>
                  </button>
                </div>

                {/* Multi-line Keyboard Typing Input */}
                <textarea
                  ref={textareaRef}
                  className={`wb-typing-textarea ${isUrduMode ? 'urdu-mode' : ''}`}
                  value={typedNotes}
                  onChange={e => handleTeacherNoteChange(e.target.value)}
                  onKeyDown={handleKeyDownUrdu}
                  dir={isUrduMode ? 'rtl' : 'ltr'}
                  lang={isUrduMode ? 'ur' : 'en'}
                  placeholder={
                    isUrduMode
                      ? "یہاں اردو میں اپنے نوٹس ٹائپ کریں... (انگریزی کی بورڈ سے آواز کے مطابق یا نیچے بٹن دبا کر لکھیں)"
                      : "Teacher can write lecture notes, code, or formulas here using keyboard..."
                  }
                  rows={8}
                />

                {/* On-Screen Quick Urdu Character Strip for Mobile & PC */}
                {isUrduMode && (
                  <div className="wb-urdu-strip-container">
                    <div className="wb-urdu-strip-header">
                      <span>🇵🇰 اردو کی بورڈ (Click or Tap):</span>
                      <span className="wb-urdu-hint">Phonetic English typing also active (a = ا, b = ب, etc.)</span>
                    </div>
                    <div className="wb-urdu-chars-row">
                      {URDU_QUICK_CHARS.map(char => (
                        <button
                          key={char}
                          type="button"
                          className="wb-urdu-char-btn"
                          onClick={() => insertUrduCharacter(char)}
                          title={`Insert ${char}`}
                        >
                          {char}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="wb-urdu-char-btn action-key"
                        onClick={() => insertUrduCharacter(' ')}
                        title="Space (فاصلہ)"
                      >
                        فاصلہ
                      </button>
                      <button
                        type="button"
                        className="wb-urdu-char-btn action-key"
                        onClick={() => insertUrduCharacter('\n')}
                        title="New Line (نئی سطر)"
                      >
                        ↵ سطر
                      </button>
                      <button
                        type="button"
                        className="wb-urdu-char-btn action-key backspace-key"
                        onClick={() => {
                          const el = textareaRef.current;
                          if (!el) return;
                          const start = el.selectionStart;
                          const end = el.selectionEnd;
                          if (start === end && start > 0) {
                            const updated = typedNotes.substring(0, start - 1) + typedNotes.substring(end);
                            handleTeacherNoteChange(updated);
                            setTimeout(() => {
                              if (textareaRef.current) {
                                textareaRef.current.focus();
                                textareaRef.current.setSelectionRange(start - 1, start - 1);
                              }
                            }, 0);
                          } else if (start !== end) {
                            const updated = typedNotes.substring(0, start) + typedNotes.substring(end);
                            handleTeacherNoteChange(updated);
                            setTimeout(() => {
                              if (textareaRef.current) {
                                textareaRef.current.focus();
                                textareaRef.current.setSelectionRange(start, start);
                              }
                            }, 0);
                          }
                        }}
                        title="Backspace (مٹائیں)"
                      >
                        ⌫
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div className="wb-typing-footer">
                  <button
                    type="button"
                    className="btn-stamp-board"
                    onClick={handleSaveNotes}
                    disabled={!typedNotes.trim()}
                    title="Save notes and live sync in Typing Pad"
                  >
                    <span>💾 Save & Sync Notes</span>
                  </button>
                </div>
              </>
            ) : (
              /* Student View: Strictly View-Only Teacher's Notes + Direct Export PDF (No personal notes/editing) */
              <div className="wb-student-notes-wrap">
                <div className="wb-typing-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>👨‍🏫</span>
                    <div style={{ minWidth: 0 }}>
                      <h4 className="wb-typing-title" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Teacher's Lecture Notes
                      </h4>
                      <span className="wb-typing-subtitle" style={{ display: 'block', marginTop: 2 }}>
                        Live Synchronized
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="wb-export-notes-btn"
                    onClick={handleExportNotesPDF}
                    title="Save lecture notes directly as PDF document"
                  >
                    <span>📥 Export PDF</span>
                  </button>
                </div>

                <div className="wb-student-notes-card" dir={/[\u0600-\u06FF]/.test(typedNotes) ? 'rtl' : 'ltr'}>
                  <div className="wb-student-notes-body" style={{
                    fontSize: `${typingFontSize}px`,
                    color: isLightMode ? (typingTextColor === '#ffffff' ? '#0f172a' : typingTextColor) : typingTextColor,
                    margin: 0,
                    lineHeight: /[\u0600-\u06FF]/.test(typedNotes) ? 1.85 : 1.6,
                    fontFamily: /[\u0600-\u06FF]/.test(typedNotes) ? "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, sans-serif" : 'inherit',
                    textAlign: /[\u0600-\u06FF]/.test(typedNotes) ? 'right' : 'left'
                  }}>
                    {renderFormattedNotes(typedNotes || "Teacher has not typed notes yet. As the teacher types, notes will appear here live.")}
                  </div>
                </div>

                <div className="wb-student-notes-footer">
                  <span>👀 Read-only lecture notes viewer synced live</span>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Right Pane: Interactive Whiteboard Canvas with Scoped Floating Toolbar */}
        <div className="wb-canvas-viewport">
          {/* ─── Top Floating Bars (Scoped ONLY inside Canvas Viewport) ─── */}
          <div className="wb-top-container">
            <div className="wb-top-left-group">
              {/* Whiteboard Title Badge */}
              <div className="wb-brand-title">
                <span className="wb-brand-icon">🎨</span>
                <span className="wb-brand-text">Whiteboard</span>
              </div>

              {/* Drawing Permission Status Tool (Instructor toggle / Student view-only badge) */}
              {isInstructor ? (
                <button
                  type="button"
                  className={`wb-quick-lock-btn ${isDrawingEnabled ? 'active' : 'locked'}`}
                  onClick={() => {
                    setIsDrawingEnabled(prev => !prev);
                    showToast(!isDrawingEnabled ? '✏️ Whiteboard drawing enabled! You can now draw.' : '🔒 Whiteboard drawing locked (view-only mode).');
                  }}
                  title={isDrawingEnabled ? "Drawing is active (Click to lock)" : "Drawing is locked (Click to unlock & draw)"}
                >
                  <span>{isDrawingEnabled ? '✏️ Drawing ON' : '🔒 Drawing Locked'}</span>
                </button>
              ) : (
                <div className={`wb-student-view-badge ${allowStudentDraw ? 'allowed' : ''}`} title={allowStudentDraw ? "Instructor has enabled student drawing" : "Drawing is controlled by the instructor"}>
                  <span>{allowStudentDraw ? '✏️ Drawing Allowed' : '🔒 View Only (Teacher Canvas)'}</span>
                </div>
              )}

              {/* Whiteboard Tools (Available for ALL participants on desktop & mobile) */}
              <div className="wb-tools-dropdown-container">
                <button
                  type="button"
                  className={`wb-tools-trigger-btn ${isToolsMenuOpen ? 'open' : ''}`}
                  onClick={() => setIsToolsMenuOpen(prev => !prev)}
                  title="Whiteboard Drawing & Format Tools"
                >
                  <span className="wb-tools-icon">🛠️</span>
                  <span className="wb-tools-text">Tools</span>
                  <span className="wb-tools-chevron">∨</span>
                </button>

                {/* Floating Dropdown Card Containing All Whiteboard Controls */}
                {isToolsMenuOpen && (
                  <div className="wb-tools-dropdown-panel">
                    <div className="wb-panel-header">
                      <span>🎨 Whiteboard Tools</span>
                      <button
                        type="button"
                        className="wb-panel-close-btn"
                        onClick={() => setIsToolsMenuOpen(false)}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Master Drawing Tool Lock */}
                    {isInstructor ? (
                      <>
                        <div className="wb-panel-section">
                          <div className="wb-section-title">✏️ Instructor Drawing Lock</div>
                          <button
                            type="button"
                            className={`wb-draw-permission-btn ${isDrawingEnabled ? 'unlocked' : 'locked'}`}
                            onClick={() => {
                              setIsDrawingEnabled(prev => !prev);
                              showToast(!isDrawingEnabled ? '✏️ Whiteboard drawing enabled! You can draw now.' : '🔒 Whiteboard drawing locked.');
                            }}
                          >
                            <span>{isDrawingEnabled ? '✏️ Drawing Enabled' : '🔒 Drawing Locked (Click to Draw)'}</span>
                            <span className={`wb-status-pill ${isDrawingEnabled ? 'on' : 'off'}`}>
                              {isDrawingEnabled ? 'ACTIVE' : 'LOCKED'}
                            </span>
                          </button>
                          {!isDrawingEnabled ? (
                            <p className="wb-lock-hint">🔒 Click the button above to unlock and enable pen/draw tools.</p>
                          ) : (
                            <p className="wb-lock-hint" style={{ color: '#4ade80' }}>✓ Drawing is active. Click to lock when finished.</p>
                          )}
                        </div>

                        {/* Student Drawing Permission Toggle */}
                        <div className="wb-panel-section">
                          <div className="wb-section-title">👥 Student Drawing Permission</div>
                          <button
                            type="button"
                            className={`wb-draw-permission-btn ${allowStudentDraw ? 'unlocked' : 'locked'}`}
                            onClick={handleToggleStudentDraw}
                          >
                            <span>{allowStudentDraw ? '✏️ Student Drawing: ALLOWED' : '🔒 Student Drawing: LOCKED'}</span>
                            <span className={`wb-status-pill ${allowStudentDraw ? 'on' : 'off'}`}>
                              {allowStudentDraw ? 'ALLOWED' : 'LOCKED'}
                            </span>
                          </button>
                          <p className="wb-lock-hint">
                            {allowStudentDraw
                              ? '✓ All students can now draw on the whiteboard.'
                              : '🔒 Students cannot draw until you unlock permission.'}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="wb-panel-section">
                        <div className="wb-section-title">Whiteboard Access</div>
                        {allowStudentDraw ? (
                          <div className="wb-student-allowed-box" style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '8px 10px', borderRadius: 6, fontSize: '0.74rem' }}>
                            <span style={{ color: '#4ade80', fontWeight: 700 }}>✏️ Drawing Allowed by Teacher</span>
                            <p style={{ margin: '4px 0 0 0', opacity: 0.9 }}>You can draw on the canvas using mouse, touch, or pen!</p>
                          </div>
                        ) : (
                          <div className="wb-student-restricted-box">
                            <span>🔒 Canvas View Only</span>
                            <p>Drawing is locked by the teacher. You will be able to draw once the teacher enables student drawing.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 1. Drawing Tools (Available for Instructor or when Student Drawing is enabled) */}
                    {(isInstructor || allowStudentDraw) && (
                      <div className="wb-panel-section">
                        <div className="wb-section-title">Draw Tools</div>
                        <div className="wb-tools-grid">
                          <button
                            type="button"
                            className={`wb-panel-btn ${tool === TOOLS.PEN ? 'active' : ''}`}
                            onClick={() => setTool(TOOLS.PEN)}
                          >
                            ✏️ Pen
                          </button>
                          <button
                            type="button"
                            className={`wb-panel-btn ${tool === TOOLS.ERASER ? 'active' : ''}`}
                            onClick={() => setTool(TOOLS.ERASER)}
                          >
                            🧹 Erase
                          </button>
                          <button
                            type="button"
                            className={`wb-panel-btn ${tool === TOOLS.LINE ? 'active' : ''}`}
                            onClick={() => setTool(TOOLS.LINE)}
                          >
                            📏 Line
                          </button>
                          {isInstructor && (
                            <button
                              type="button"
                              className="wb-panel-btn wb-btn-danger"
                              onClick={clearBoard}
                              style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
                              title="Clear entire whiteboard canvas"
                            >
                              🗑️ Clear Board
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. Color Palette & Thickness (Available for Instructor or when Student Drawing is enabled) */}
                    {(isInstructor || allowStudentDraw) && (
                      <div className="wb-panel-section">
                        <div className="wb-section-title">Colors & Stroke</div>
                        <div className="wb-colors-row">
                          {COLORS.map(c => (
                            <button
                              key={c}
                              type="button"
                              className={`wb-color-circle ${color === c ? 'selected' : ''}`}
                              style={{ backgroundColor: c }}
                              onClick={() => {
                                if (tool === TOOLS.ERASER || tool === TOOLS.LASER) setTool(TOOLS.PEN);
                                setColor(c);
                              }}
                              title={c}
                            />
                          ))}
                          <input
                            type="color"
                            value={color}
                            onChange={e => {
                              if (tool === TOOLS.ERASER || tool === TOOLS.LASER) setTool(TOOLS.PEN);
                              setColor(e.target.value);
                            }}
                            className="wb-color-picker-input"
                            title="Custom Color"
                          />
                        </div>

                        {/* Stroke Width Slider */}
                        <div className="wb-slider-row">
                          <span className="wb-slider-label">Width: <strong>{lineWidth}px</strong></span>
                          <input
                            type="range"
                            min="1"
                            max="16"
                            value={lineWidth}
                            onChange={e => setLineWidth(Number(e.target.value))}
                            className="wb-width-slider"
                          />
                        </div>
                      </div>
                    )}

                    {/* 3. History & Canvas Actions */}
                    <div className="wb-panel-section">
                      <div className="wb-section-title">Actions & View</div>
                      <div className="wb-actions-grid">
                        {isInstructor && (
                          <>
                            <button
                              type="button"
                              className="wb-panel-btn"
                              onClick={handleUndo}
                              disabled={!canUndo}
                              title="Undo (Ctrl+Z)"
                            >
                              ↩️ Undo
                            </button>
                            <button
                              type="button"
                              className="wb-panel-btn"
                              onClick={handleRedo}
                              disabled={!canRedo}
                              title="Redo (Ctrl+Y)"
                            >
                              ↪️ Redo
                            </button>
                            <button
                              type="button"
                              className="wb-panel-btn wb-btn-danger"
                              onClick={clearBoard}
                              title="Clear Canvas"
                            >
                              🗑️ Clear
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className={`wb-panel-btn ${isDualMode ? 'active' : ''}`}
                          onClick={() => setIsDualMode(prev => !prev)}
                          title="Toggle Dual View (Typing Pad + Canvas)"
                          style={!isInstructor ? { gridColumn: 'span 2' } : {}}
                        >
                          ⌨️ {isDualMode ? 'Dual View' : 'Full Canvas'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Action Bar (Download) */}
            <div className="wb-actions-bar">
              <button
                type="button"
                className="wb-btn btn-export"
                onClick={handleExportPNG}
                title="Download Whiteboard as PNG Image"
              >
                📸 PNG
              </button>
              <button
                type="button"
                className="wb-btn btn-export"
                onClick={handleExportPDF}
                title="Download Whiteboard as PDF Document"
              >
                📄 PDF
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            className="wb-drawing-canvas"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onPointerLeave={handleMouseLeave}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              cursor: (!isInstructor && !allowStudentDraw) ? 'default' : tool === TOOLS.ERASER ? 'cell' : tool === TOOLS.LASER ? 'none' : 'crosshair',
              touchAction: 'none',
            }}
          />

      {/* ─── Local Laser Pointer Indicator ─── */}
      {tool === TOOLS.LASER && localLaser.active && (
        <div
          style={{
            position: 'absolute',
            left: localLaser.x,
            top: localLaser.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div className="laser-pointer-dot" />
          <span className="laser-pointer-label">
            🔴 {user?.name || (isInstructor ? 'Instructor' : 'You')}
          </span>
        </div>
      )}

      {/* ─── Remote Laser Pointer Indicator ─── */}
      {remoteLaser.active && (
        <div
          style={{
            position: 'absolute',
            left: remoteLaser.x,
            top: remoteLaser.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'left 0.05s ease-out, top 0.05s ease-out',
          }}
        >
          <div className="laser-pointer-dot" />
          <span className="laser-pointer-label">
            🔴 {remoteLaser.senderName || 'Instructor'}
          </span>
        </div>
      )}

        {/* ─── Floating Toast Feedback ─── */}
        {toastMessage && (
          <div className="wb-toast">
            {toastMessage}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default WhiteboardCanvas;