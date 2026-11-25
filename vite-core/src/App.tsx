import React, { useState, useEffect, useRef } from 'react';
import { Timer } from './components/Timer';
import { TimerControls } from './components/TimerControls';
import { AlertBanner } from './components/AlertBanner';
import { ProgramList } from './components/ProgramList';
import { ExtraTimeTimer } from './components/ExtraTimeTimer';
import { Program, TimerState, ExtraTimeState, Category, RemoteCommand } from './types';
import { Play, Pause, RefreshCw, AlertTriangle, Clock, Settings, FolderPlus, FileText, HelpCircle, Plus, RotateCcw, Layout, Trash2, X, Minus, Square, Mic, SkipForward, Radio, GripVertical, Camera } from 'lucide-react';
import { DisplaySettings } from './components/DisplaySettings';
import { BibleSongsTab, Verse } from './components/BibleSongsTab';
import { NextProgramNotification } from './components/NextProgramNotification';
import { AutoRunDisplay } from './components/AutoRunDisplay';
import { DeleteConfirmation } from './components/DeleteConfirmation';
import { CategoryManager } from './components/CategoryManager';
import { ExportImportManager } from './components/ExportImportManager';
import { HowToGuide } from './components/HowToGuide';
import { AddProgramModal } from './components/AddProgramModal';
import { TranscribeTab } from './components/TranscribeTab';
import { AutoRunBanner } from './components/AutoRunBanner';
import { RemoteAccessModal } from './components/RemoteAccessModal';
import { RemoteCameraMixer } from './components/RemoteCameraMixer';

type TimerHistoryEntry = { id: string; programName: string; duration: number; timestamp: number };
type TranscribeBibleSuggestion = { book: string; chapter: number; verse: number; label: string; countdown: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isProgram = (value: unknown): value is Program =>
  isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
  typeof value.duration === 'number' && typeof value.categoryId === 'string' &&
  (value.notes === undefined || typeof value.notes === 'string');

const isCategory = (value: unknown): value is Category =>
  isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string';

const isTimerHistoryEntry = (value: unknown): value is TimerHistoryEntry =>
  isRecord(value) && typeof value.id === 'string' && typeof value.programName === 'string' &&
  typeof value.duration === 'number' && typeof value.timestamp === 'number';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeBibleSuggestion, setTranscribeBibleSuggestion] = useState<TranscribeBibleSuggestion | null>(null);
  const [setupTimer, setSetupTimer] = useState<TimerState>({
    minutes: 0,
    seconds: 0,
    isRunning: false,
    isPaused: false,
    isAttention: false,
  });

  const [liveTimer, setLiveTimer] = useState<TimerState>(() => {
    const saved = localStorage.getItem('timerState');
    if (saved) {
      const restored: TimerState = JSON.parse(saved);
      if (restored.isRunning && !restored.isPaused) {
        const deadline = Number(localStorage.getItem('timerDeadline'));
        if (!deadline) return { ...restored, isRunning: false };
        const secondsRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        return {
          ...restored,
          minutes: Math.floor(secondsRemaining / 60),
          seconds: secondsRemaining % 60,
          isRunning: secondsRemaining > 0,
        };
      }
      return restored;
    }
    return {
      minutes: 0,
      seconds: 0,
      isRunning: false,
      isPaused: false,
      isAttention: false,
    };
  });

  const [timerDeadline, setTimerDeadline] = useState<number | null>(() => {
    const stored = localStorage.getItem('timerDeadline');
    const deadline = stored ? Number(stored) : null;
    return deadline && deadline > Date.now() ? deadline : null;
  });
  const timerDeadlineRef = useRef<number | null>(null);
  useEffect(() => {
    timerDeadlineRef.current = timerDeadline;
    if (timerDeadline === null) {
      localStorage.removeItem('timerDeadline');
    } else {
      localStorage.setItem('timerDeadline', String(timerDeadline));
    }
    window.dispatchEvent(new Event('storage'));
  }, [timerDeadline]);

  const [lastRunDurationSec, setLastRunDurationSec] = useState<number>(() => {
    const s = localStorage.getItem('lastRunDurationSec');
    return s ? Number(s) : 0;
  });
  useEffect(() => {
    localStorage.setItem('lastRunDurationSec', String(lastRunDurationSec || 0));
  }, [lastRunDurationSec]);

  const [extraTime, setExtraTime] = useState<ExtraTimeState>({
    minutes: 0,
    seconds: 0,
    isRunning: false,
    isPaused: false,
  });

  const [programs, setPrograms] = useState<Program[]>(() => {
    const savedPrograms = localStorage.getItem('programs');
    return savedPrograms ? JSON.parse(savedPrograms) : [];
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const savedCategories = localStorage.getItem('categories');
    return savedCategories ? JSON.parse(savedCategories) : [];
  });
  
  const [alertMessage, setAlertMessage] = useState('');
  const [isAlertFlashing, setIsAlertFlashing] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [textCase, setTextCase] = useState<'normal' | 'uppercase' | 'lowercase' | 'capitalize'>(() => {
    return (localStorage.getItem('textCase') as 'normal' | 'uppercase' | 'lowercase' | 'capitalize') || 'normal';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [use12HourFormat, setUse12HourFormat] = useState(() => {
    const saved = localStorage.getItem('use12HourFormat');
    return saved ? JSON.parse(saved) : false;
  });

  // callback passed to DisplaySettings to keep parent state in sync
  const handleTimeFormatChange = (use12: boolean) => {
    setUse12HourFormat(use12);
  };

  // Always keep clock updated with user-selected time format
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Use user-selected time format (12 or 24 hour)
      const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: use12HourFormat });
      setCurrentTime(formattedTime);
      localStorage.setItem('currentTime', JSON.stringify(formattedTime));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [use12HourFormat]);

  useEffect(() => {
    localStorage.setItem('showClock', JSON.stringify(showClock));
    window.dispatchEvent(new Event('storage'));
  }, [showClock]);

  const [clockScale, setClockScale] = useState(100);
  const [programNameScale, setProgramNameScale] = useState(100);
  const [showProgramName, setShowProgramName] = useState(true);
  const [showNextProgram, setShowNextProgram] = useState<Program | null>(null);
  const [availableDisplays, setAvailableDisplays] = useState<Array<{ id: number; label: string; isPrimary: boolean; isUsedByMainTimer: boolean }>>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    const saved = localStorage.getItem('projectionTheme');
    return saved || 'dark';
  });
  const [selectedProjectDisplay, setSelectedProjectDisplay] = useState<number | null>(() => {
    const saved = localStorage.getItem('projectDisplay');
    return saved ? Number(saved) : null;
  });

  const [isBibleProjected, setIsBibleProjected] = useState(false);
  const [showBibleExitDialog, setShowBibleExitDialog] = useState(false);
  const [pendingBibleExitTab, setPendingBibleExitTab] = useState<'main' | 'guide' | 'bible' | 'songs' | 'transcribe' | 'cameras'>('bible');
  const [showClearScreenDialog, setShowClearScreenDialog] = useState(false);
  const [timerBackgroundCleared, setTimerBackgroundCleared] = useState(false);

  useEffect(() => window.electronAPI?.onBibleProjectionClosed?.(() => {
    localStorage.setItem('activeProjection', 'none');
    setIsBibleProjected(false);
  }), []);

  const [navigationOrder, setNavigationOrder] = useState<Array<'main' | 'transcribe' | 'bible' | 'cameras' | 'guide'>>(() => {
    const defaultOrder = ['main', 'transcribe', 'bible', 'cameras', 'guide'] as const;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('appNavigationOrder') || 'null');
      if (Array.isArray(saved)) {
        const migrated = [...new Set(saved.filter((id): id is typeof defaultOrder[number] => defaultOrder.includes(id as typeof defaultOrder[number])))];
        return [...migrated, ...defaultOrder.filter(id => !migrated.includes(id))];
      }
    } catch {
      return [...defaultOrder];
    }
    return [...defaultOrder];
  });
  const [activeTab, setActiveTab] = useState<'main' | 'guide' | 'bible' | 'songs' | 'transcribe' | 'cameras'>(() => navigationOrder[0]);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const draggedNavigationTab = useRef<'main' | 'transcribe' | 'bible' | 'cameras' | 'guide' | null>(null);

  useEffect(() => {
    localStorage.setItem('appNavigationOrder', JSON.stringify(navigationOrder));
  }, [navigationOrder]);

  useEffect(() => {
    const handleTranscriptionState = (event: Event) => {
      setIsTranscribing(Boolean((event as CustomEvent<{ isListening?: boolean }>).detail?.isListening));
    };
    window.addEventListener('stage-timer-transcription-state', handleTranscriptionState);
    return () => window.removeEventListener('stage-timer-transcription-state', handleTranscriptionState);
  }, []);

  useEffect(() => {
    const handleBibleSuggestion = (event: Event) => {
      const detail = (event as CustomEvent<Omit<TranscribeBibleSuggestion, 'countdown'>>).detail;
      if (!detail || typeof detail.book !== 'string' || !Number.isInteger(detail.chapter) || !Number.isInteger(detail.verse)) return;
      setTranscribeBibleSuggestion({ ...detail, countdown: 10 });
    };
    window.addEventListener('stage-timer-bible-suggestion', handleBibleSuggestion);
    return () => window.removeEventListener('stage-timer-bible-suggestion', handleBibleSuggestion);
  }, []);

  useEffect(() => {
    if (!transcribeBibleSuggestion) return;
    const timeout = window.setTimeout(() => setTranscribeBibleSuggestion(current => {
      if (!current || current.countdown <= 1) return null;
      return { ...current, countdown: current.countdown - 1 };
    }), 1000);
    return () => window.clearTimeout(timeout);
  }, [transcribeBibleSuggestion]);

  useEffect(() => {
    let active = true;
    const refreshDisplays = () => window.electronAPI?.getDisplays?.().then(displays => {
      if (!active) return;
      setAvailableDisplays(displays);
      setSelectedProjectDisplay(current => {
        const valid = displays.some(display => display.id === current && !display.isPrimary);
        if (current !== null && !valid) {
          localStorage.removeItem('projectDisplay');
          return null;
        }
        return current;
      });
    }).catch(error => console.error('Failed to load displays:', error));
    void refreshDisplays?.();
    const unsubscribe = window.electronAPI?.onDisplaysChanged?.(() => void refreshDisplays?.());
    return () => { active = false; unsubscribe?.(); };
  }, []);

  useEffect(() => {
    let active = true;
    void window.electronAPI?.requestStartupDisplay?.().then(startup => {
      if (!active || !startup) return;
      setSelectedProjectDisplay(startup.displayId);
      if (activeTabRef.current === 'bible' || activeTabRef.current === 'songs') {
        localStorage.setItem('activeProjection', 'bible');
        const current = localStorage.getItem('bibleProjectionData');
        let projection: Record<string, unknown> = {};
        try { projection = current ? JSON.parse(current) : {}; } catch { /* use a clean projection payload */ }
        localStorage.setItem('bibleProjectionData', JSON.stringify({ ...projection, verses: [], referenceOnly: false, description: '' }));
        window.electronAPI?.openBibleProjection?.(startup.displayId);
        setIsBibleProjected(true);
      } else {
        window.electronAPI?.openTimerDisplay?.(startup.displayId);
      }
    }).catch(error => console.error('Failed to restore startup display:', error));
    return () => { active = false; };
  }, []);

  const [isTimerComplete, setIsTimerComplete] = useState(false);
  const [selectedCategory] = useState<string>('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showExportImportManager, setShowExportImportManager] = useState(false);
  const [showAddProgramModal, setShowAddProgramModal] = useState(false);
  const [background, setBackground] = useState<{ type: string; source: string | null }>(() => {
    const savedBackground = localStorage.getItem('background');
    return savedBackground ? JSON.parse(savedBackground) : { type: 'default', source: null };
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    programId: string;
    programName: string;
  }>({
    isOpen: false,
    programId: '',
    programName: '',
  });

  const [setupTab, setSetupTab] = useState<'timer' | 'extra'>('timer');
  const [timerHistory, setTimerHistory] = useState<TimerHistoryEntry[]>(() => {
    const saved = localStorage.getItem('timerHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [autoRun, setAutoRun] = useState(() => localStorage.getItem('autoTimerEnabled') === 'true');
  const [autoCooldownSec, setAutoCooldownSec] = useState(() => {
    const saved = Number(localStorage.getItem('autoTimerCooldownSec'));
    return saved >= 3 && saved <= 300 ? saved : 30;
  });
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [remoteClients, setRemoteClients] = useState(0);
  const [remoteRunning, setRemoteRunning] = useState(false);
  const [autoQueueCategoryId, setAutoQueueCategoryId] = useState(() => localStorage.getItem('autoTimerCategoryId') || '');
  const [autoQueueIds, setAutoQueueIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('autoTimerQueue');
    return saved ? JSON.parse(saved) : [];
  });
  const [autoQueueIndex, setAutoQueueIndex] = useState(() => Number(localStorage.getItem('autoTimerQueueIndex') || 0));
  const [autoTransition, setAutoTransition] = useState<{ programId: string; programName: string; deadline: number } | null>(() => {
    const saved = localStorage.getItem('autoTimerTransition');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });
  const startProgramRef = useRef<(program: Program, fromQueue?: boolean) => void>(() => undefined);

  // Clock update refs removed - now using a single consistent effect for time updates

  // Case changer functions
  const handleCaseChange = () => {
    const cases: ('normal' | 'uppercase' | 'lowercase' | 'capitalize')[] = ['normal', 'uppercase', 'lowercase', 'capitalize'];
    const currentIndex = cases.indexOf(textCase);
    const nextIndex = (currentIndex + 1) % cases.length;
    const newCase = cases[nextIndex];
    setTextCase(newCase);
    localStorage.setItem('textCase', newCase);
    window.dispatchEvent(new Event('storage'));
  };

  const getProcessedAlertMessage = () => {
    switch (textCase) {
      case 'uppercase':
        return alertMessage.toUpperCase();
      case 'lowercase':
        return alertMessage.toLowerCase();
      case 'capitalize':
        return alertMessage.replace(/\b\w/g, l => l.toUpperCase());
      default:
        return alertMessage;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (window.electronAPI?.dbGetAll) {
      window.electronAPI.dbGetAll().then(data => {
        if (!isRecord(data)) return;
        if (Array.isArray(data.programs)) setPrograms(data.programs.filter(isProgram));
        if (Array.isArray(data.categories)) setCategories(data.categories.filter(isCategory));
        if (Array.isArray(data.timerHistory)) setTimerHistory(data.timerHistory.filter(isTimerHistoryEntry));
        if (typeof data.projectionTheme === 'string') setSelectedTheme(data.projectionTheme);
        if (typeof data.projectDisplay === 'number') setSelectedProjectDisplay(data.projectDisplay);
        if (typeof data.use12HourFormat === 'boolean') setUse12HourFormat(data.use12HourFormat);
        if (data.textCase === 'normal' || data.textCase === 'uppercase' || data.textCase === 'lowercase' || data.textCase === 'capitalize') setTextCase(data.textCase);
        if (typeof data.autoTimerEnabled === 'boolean') setAutoRun(data.autoTimerEnabled);
        if (typeof data.autoTimerCategoryId === 'string') setAutoQueueCategoryId(data.autoTimerCategoryId);
        if (Array.isArray(data.autoTimerQueue)) setAutoQueueIds(data.autoTimerQueue.filter((id): id is string => typeof id === 'string'));
        if (typeof data.autoTimerQueueIndex === 'number' && Number.isFinite(data.autoTimerQueueIndex)) setAutoQueueIndex(data.autoTimerQueueIndex);
      }).catch(err => console.error('Failed to load from SQLite DB:', err));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('programs', JSON.stringify(programs));
    window.electronAPI?.dbSet?.('programs', programs);
  }, [programs]);

  useEffect(() => {
    localStorage.setItem('categories', JSON.stringify(categories));
    window.electronAPI?.dbSet?.('categories', categories);
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('autoTimerEnabled', String(autoRun));
    localStorage.setItem('autoTimerCategoryId', autoQueueCategoryId);
    localStorage.setItem('autoTimerQueue', JSON.stringify(autoQueueIds));
    localStorage.setItem('autoTimerQueueIndex', String(autoQueueIndex));
    localStorage.setItem('autoTimerTransition', JSON.stringify(autoTransition));
    localStorage.setItem('autoTimerCooldownSec', String(autoCooldownSec));
    localStorage.setItem('autoTimerDisplay', JSON.stringify({
      enabled: autoRun,
      nextProgramName: autoTransition?.programName ?? '',
      deadline: autoTransition?.deadline ?? null,
    }));
    window.dispatchEvent(new Event('storage'));
  }, [autoRun, autoQueueCategoryId, autoQueueIds, autoQueueIndex, autoTransition, autoCooldownSec]);

  useEffect(() => {
    localStorage.setItem('timerState', JSON.stringify({
      minutes: liveTimer.minutes,
      seconds: liveTimer.seconds,
      isRunning: liveTimer.isRunning,
      isPaused: liveTimer.isPaused,
      isAttention: liveTimer.isAttention,
      isComplete: isTimerComplete,
      programName: liveTimer.programName,
    }));
    
    // Dispatch storage event for timer display windows
    localStorage.setItem('liveTimer', JSON.stringify({
      minutes: liveTimer.minutes,
      seconds: liveTimer.seconds,
      isRunning: liveTimer.isRunning,
      isPaused: liveTimer.isPaused,
      isAttention: liveTimer.isAttention,
      isComplete: isTimerComplete,
      programName: liveTimer.programName,
    }));
    window.dispatchEvent(new Event('storage'));
  }, [liveTimer, isTimerComplete]);

  useEffect(() => {
    localStorage.setItem('extraTime', JSON.stringify(extraTime));
    window.dispatchEvent(new Event('storage'));
  }, [extraTime]);

  useEffect(() => {
    localStorage.setItem('alertState', JSON.stringify({
      message: alertMessage,
      isFlashing: isAlertFlashing,
      show: showAlert,
    }));
    
    // Dispatch storage events for timer display windows
    localStorage.setItem('alertMessage', alertMessage);
    localStorage.setItem('showAlert', JSON.stringify(showAlert));
    window.dispatchEvent(new Event('storage'));
  }, [alertMessage, isAlertFlashing, showAlert]);

  useEffect(() => {
    localStorage.setItem('nextProgram', JSON.stringify(showNextProgram));
  }, [showNextProgram]);

  useEffect(() => {
    if (selectedProjectDisplay !== null) {
      localStorage.setItem('projectDisplay', String(selectedProjectDisplay));
      window.electronAPI?.saveSelectedDisplay?.(selectedProjectDisplay);
    }
  }, [selectedProjectDisplay]);

  useEffect(() => {
    localStorage.setItem('use12HourFormat', JSON.stringify(use12HourFormat));
    window.dispatchEvent(new Event('storage'));
  }, [use12HourFormat]);

  useEffect(() => {
    localStorage.setItem('projectionTheme', selectedTheme);
    window.dispatchEvent(new Event('storage'));
  }, [selectedTheme]);

  useEffect(() => {
    if (!window.electronAPI?.getDisplays) {
      setSelectedProjectDisplay(null);
      return;
    }
    window.electronAPI.getDisplays().then(setAvailableDisplays).catch(error => console.error('Failed to load displays:', error));
    return window.electronAPI.onDisplaysChanged?.(setAvailableDisplays);
  }, []);

  useEffect(() => {
    if (availableDisplays.length === 0) return;
    const isStillAvailable = availableDisplays.some(display => display.id === selectedProjectDisplay);
    if (!isStillAvailable) {
      const defaultDisplay = availableDisplays.find(display => display.isPrimary) || availableDisplays[0];
      setSelectedProjectDisplay(defaultDisplay.id);
    }
  }, [availableDisplays, selectedProjectDisplay]);

  useEffect(() => {
    if (selectedProjectDisplay !== null) {
      localStorage.setItem('projectDisplay', String(selectedProjectDisplay));
    } else {
      localStorage.removeItem('projectDisplay');
    }
  }, [selectedProjectDisplay]);
  useEffect(() => {
    // refresh list whenever user goes to a tab that might project output
    if ((activeTab === 'bible' || activeTab === 'songs') && window.electronAPI?.getDisplays) {
      window.electronAPI.getDisplays().then(setAvailableDisplays).catch(error => console.error('Failed to refresh displays:', error));
    }
  }, [activeTab]);

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
  };

  const stopBibleProjection = (retainBackground = false) => {
    if (retainBackground) {
      const current = localStorage.getItem('bibleProjectionData');
      if (current) {
        try {
          const projection = JSON.parse(current);
          localStorage.setItem('bibleProjectionData', JSON.stringify({ ...projection, verses: [], referenceOnly: false, description: '' }));
        } catch { /* ignore invalid projection data */ }
      }
      localStorage.setItem('activeProjection', 'bible');
      setIsBibleProjected(true);
      return;
    }
    window.electronAPI?.closeBibleProjection?.();
    localStorage.setItem('activeProjection', 'none');
    setIsBibleProjected(false);
  };

  const requestBibleExit = (nextTab = activeTab) => {
    setPendingBibleExitTab(nextTab);
    setShowBibleExitDialog(true);
  };

  const changeNavigationTab = (nextTab: typeof activeTab) => {
    const leavingBible = (activeTab === 'bible' || activeTab === 'songs') && nextTab !== 'bible' && nextTab !== 'songs';
    if (leavingBible && isBibleProjected) requestBibleExit(nextTab);
    else setActiveTab(nextTab);
  };

  const finishBibleExit = (retainBackground: boolean) => {
    stopBibleProjection(retainBackground);
    setShowBibleExitDialog(false);
    setActiveTab(pendingBibleExitTab);
  };

  const projectBibleVerses = (verses: Verse[], options?: { referenceOnly?: boolean; description?: string }) => {
    const targetIsExternal = availableDisplays.some(display => display.id === selectedProjectDisplay && !display.isPrimary);
    if (selectedProjectDisplay !== null && targetIsExternal && window.electronAPI?.openBibleProjection && (verses.length > 0 || options?.referenceOnly)) {
      localStorage.setItem('activeProjection', 'bible');
      localStorage.setItem('bibleProjectionData', JSON.stringify({ verses, theme: selectedTheme, referenceOnly: Boolean(options?.referenceOnly), description: options?.description || '' }));
      window.electronAPI?.openBibleProjection(selectedProjectDisplay);
      setIsBibleProjected(true);
    }
  };

  const testBibleDisplay = () => {
    const targetIsExternal = availableDisplays.some(display => display.id === selectedProjectDisplay && !display.isPrimary);
    if (selectedProjectDisplay !== null && targetIsExternal && window.electronAPI?.testDisplay) {
      window.electronAPI.testDisplay(selectedProjectDisplay);
    }
  };

  const refreshProjectDisplays = () => {
    window.electronAPI?.getDisplays?.()
      .then(setAvailableDisplays)
      .catch(error => console.error('Failed to refresh displays:', error));
  };

  useEffect(() => {
    const updateDisplaySettings = () => {
      const savedSizes = localStorage.getItem('displaySizes');
      if (savedSizes) {
        const sizes = JSON.parse(savedSizes);
        setClockScale(sizes.clock || 100);
        setProgramNameScale(sizes.programName || 100);
        setShowProgramName(sizes.showProgramName !== undefined ? sizes.showProgramName : true);
      }

      const savedFormat = localStorage.getItem('use12HourFormat');
      if (savedFormat !== null) {
        setUse12HourFormat(JSON.parse(savedFormat));
      }

      const savedTheme = localStorage.getItem('projectionTheme');
      if (savedTheme) setSelectedTheme(savedTheme);
    };

    updateDisplaySettings();
    window.addEventListener('storage', updateDisplaySettings);
    return () => window.removeEventListener('storage', updateDisplaySettings);
  }, []);

  useEffect(() => {
    localStorage.setItem('timerHistory', JSON.stringify(timerHistory));
  }, [timerHistory]);

  // Clean up expired timer history entries (48 hours)
  useEffect(() => {
    const cleanupHistory = () => {
      const now = Date.now();
      const fortyEightHours = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
      
      setTimerHistory(prev => 
        prev.filter(entry => now - entry.timestamp < fortyEightHours)
      );
    };

    // Clean up immediately and then every hour
    cleanupHistory();
    const interval = setInterval(cleanupHistory, 60 * 60 * 1000); // Every hour
    
    return () => clearInterval(interval);
  }, []);

  // REMOVED: Conflicting clock update effect that was causing blinking
  // The main effect above handles time updates consistently

  // Smart clock display logic - when timer is running
  useEffect(() => {
    if (showClock && liveTimer.isRunning) {
      const totalSeconds = liveTimer.minutes * 60 + liveTimer.seconds;
      
      if (totalSeconds < 60) {
        // Timer is in final minute - hide clock to not interfere with time-up animation
        setShowClock(false);
        return;
      }
      
      // Timer has more than 1 minute - show clock for 3 seconds then hide
      const hideTimeout = setTimeout(() => {
        setShowClock(false);
      }, 3000); // Show clock for 3 seconds
      
      return () => clearTimeout(hideTimeout);
    }
  }, [liveTimer.isRunning, liveTimer.minutes, liveTimer.seconds, showClock]);

  // Clock display automatically shows time when showClock is true
  // with consistent 24-hour format from the main clock update effect

  // Keyboard shortcuts
  useEffect(() => {
    if (liveTimer.isRunning && liveTimer.minutes === 0 && liveTimer.seconds === 0) {
      setIsTimerComplete(true);
      setTimeout(() => setIsTimerComplete(false), 2500);
    }
  }, [liveTimer]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (liveTimer.isRunning && !liveTimer.isPaused && timerDeadlineRef.current) {
      const tick = () => {
        const now = Date.now();
        const deadline = timerDeadlineRef.current!;
        const remainingMs = Math.max(0, deadline - now);
        const remainingSec = Math.ceil(remainingMs / 1000);
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        setLiveTimer(prev => ({
          ...prev,
          minutes: mins,
          seconds: secs,
        }));
        if (remainingSec <= 0) {
          setIsTimerComplete(true);
          setLiveTimer(prev => ({ ...prev, isRunning: false, isPaused: false, minutes: 0, seconds: 0 }));
          setTimerDeadline(null);
        }
      };
      tick();
      interval = setInterval(tick, 250);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [liveTimer.isRunning, liveTimer.isPaused, timerDeadline]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (extraTime.isRunning && !extraTime.isPaused) {
      interval = setInterval(() => {
        setExtraTime(prev => {
          if (prev.seconds === 0 && prev.minutes === 0) {
            return { ...prev, isRunning: false };
          }

          let newSeconds = prev.seconds - 1;
          let newMinutes = prev.minutes;

          if (newSeconds < 0) {
            newSeconds = 59;
            newMinutes--;
          }

          return {
            ...prev,
            minutes: newMinutes,
            seconds: newSeconds,
          };
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [extraTime.isRunning, extraTime.isPaused]);

  const handleBackgroundChange = async (type: string, source: string | null) => {
    try {
      if (type === 'webcam') {
        const constraints = {
          video: source ? { deviceId: { exact: source } } : true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('webcam-video') as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
          video.play();
        }
      }
      
      const backgroundData = { type, source };
      localStorage.setItem('background', JSON.stringify(backgroundData));
      setBackground(backgroundData);
      setTimerBackgroundCleared(false);
    } catch (err) {
      console.error('Error setting background:', err);
      setBackground({ type: 'default', source: null });
    }
  };

  const handleProgramDelete = (id: string) => {
    const program = programs.find(p => p.id === id);
    if (program) {
      setDeleteConfirmation({
        isOpen: true,
        programId: id,
        programName: program.name,
      });
    }
  };

  const confirmDelete = () => {
    setPrograms(prev => prev.filter(p => p.id !== deleteConfirmation.programId));
    setDeleteConfirmation({
      isOpen: false,
      programId: '',
      programName: '',
    });
  };

  const handleSetupTimerAdjust = (minutes: number) => {
    setSetupTimer(prev => ({
      ...prev,
      minutes: Math.max(0, prev.minutes + minutes),
    }));
  };

  const handleSetupSecondsAdjust = (seconds: number) => {
    setSetupTimer(prev => {
      const totalSeconds = prev.minutes * 60 + prev.seconds + seconds;
      if (totalSeconds < 0) return { ...prev, minutes: 0, seconds: 0 };
      return {
        ...prev,
        minutes: Math.floor(totalSeconds / 60),
        seconds: totalSeconds % 60,
      };
    });
  };

  const addProgram = (programData: Omit<Program, 'id'>) => {
    const newProgram: Program = {
        id: Date.now().toString(),
      ...programData
    };
    setPrograms(prev => [...prev, newProgram]);
  };

  const addCategory = (name: string) => {
    setCategories(prev => [...prev, {
      id: Date.now().toString(),
      name
    }]);
  };

  const updateCategory = (category: Category) => {
    setCategories(prev => prev.map(c => 
      c.id === category.id ? category : c
    ));
  };

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setPrograms(prev => prev.filter(p => p.categoryId !== id));
  };

  const startLiveTimer = () => {
    const currentDuration = setupTimer.minutes * 60 + setupTimer.seconds;
    const durationSec = currentDuration > 0 ? currentDuration : lastRunDurationSec;
    if (durationSec <= 0) return;
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    setLiveTimer({ minutes, seconds, isRunning: true, isPaused: false, isAttention: false, programName: liveTimer.programName });
    setLastRunDurationSec(durationSec);
    setTimerDeadline(Date.now() + durationSec * 1000);
    setExtraTime(prev => ({ ...prev, isRunning: false }));
  };

  const startRemoteDuration = (minutesValue: number, secondsValue: number) => {
    const minutes = Math.floor(minutesValue);
    const seconds = Math.floor(secondsValue);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || minutes > 1439 || seconds < 0 || seconds > 59) return;
    const durationSec = minutes * 60 + seconds;
    if (durationSec <= 0) return;
    if (autoRun) stopAutoRun();
    setSetupTimer(prev => ({ ...prev, minutes, seconds, isRunning: false, isPaused: false }));
    setLiveTimer({ minutes, seconds, isRunning: true, isPaused: false, isAttention: false, programName: undefined });
    setLastRunDurationSec(durationSec);
    setTimerDeadline(Date.now() + durationSec * 1000);
    setIsTimerComplete(false);
    setExtraTime(prev => ({ ...prev, isRunning: false }));
  };

  const pauseLiveTimer = () => {
    // Capture remaining, clear deadline
    setLiveTimer(prev => {
      let remainingSec = prev.minutes * 60 + prev.seconds;
      if (timerDeadlineRef.current) {
        remainingSec = Math.max(0, Math.ceil((timerDeadlineRef.current - Date.now()) / 1000));
      }
      return { ...prev, isPaused: true, minutes: Math.floor(remainingSec / 60), seconds: remainingSec % 60 };
    });
    setTimerDeadline(null);
  };

  const resumeLiveTimer = () => {
    setLiveTimer(prev => ({ ...prev, isPaused: false }));
    const remaining = liveTimer.minutes * 60 + liveTimer.seconds;
    if (remaining > 0) {
      setTimerDeadline(Date.now() + remaining * 1000);
    }
  };

  const resetLiveTimer = () => {
    setLiveTimer({
      minutes: 0,
      seconds: 0,
      isRunning: false,
      isPaused: false,
      isAttention: false,
      programName: undefined,
    });
    setTimerDeadline(null);
    setIsTimerComplete(false);
    if (autoRun) stopAutoRun();
  };

  const clearTimerScreen = (clearBackground: boolean) => {
    resetLiveTimer();
    setExtraTime({ minutes: 0, seconds: 0, isRunning: false, isPaused: false });
    setShowNextProgram(null);
    setShowClock(false);
    setTimerBackgroundCleared(clearBackground);
    if (clearBackground) void handleBackgroundChange('default', null);
    setShowClearScreenDialog(false);
  };

  const restartLiveTimer = () => {
    const durationSec = lastRunDurationSec || (setupTimer.minutes * 60 + setupTimer.seconds);
    if (durationSec <= 0) return;
    setLiveTimer({
      minutes: Math.floor(durationSec / 60),
      seconds: durationSec % 60,
      isRunning: true,
      isPaused: false,
      isAttention: false,
      programName: liveTimer.programName,
    });
    setTimerDeadline(Date.now() + durationSec * 1000);
    setIsTimerComplete(false);
    setExtraTime(prev => ({ ...prev, isRunning: false }));
  };

  const toggleAttention = () => {
    setLiveTimer(prev => ({ ...prev, isAttention: !prev.isAttention }));
    if (!liveTimer.isAttention) {
      setTimeout(() => {
        setLiveTimer(prev => ({ ...prev, isAttention: false }));
      }, 2000);
    }
  };

  const skipToNextProgramRef = useRef<() => void>(() => undefined);
  const keyboardActionsRef = useRef({ startLiveTimer, pauseLiveTimer, resumeLiveTimer, resetLiveTimer, toggleAttention });
  keyboardActionsRef.current = { startLiveTimer, pauseLiveTimer, resumeLiveTimer, resetLiveTimer, toggleAttention };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault();
          if (!liveTimer.isRunning) keyboardActionsRef.current.startLiveTimer();
          else if (liveTimer.isPaused) keyboardActionsRef.current.resumeLiveTimer();
          else keyboardActionsRef.current.pauseLiveTimer();
          break;
        case 's':
          if (event.ctrlKey || event.metaKey) return;
          keyboardActionsRef.current.resetLiveTimer();
          break;
        case 'r':
          if (event.ctrlKey || event.metaKey) return;
          keyboardActionsRef.current.resetLiveTimer();
          break;
        case 'a':
          keyboardActionsRef.current.toggleAttention();
          break;
        case 'n':
          if (event.ctrlKey || event.metaKey) return;
          skipToNextProgramRef.current();
          break;
        case 'c':
          setShowClock(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [liveTimer.isRunning, liveTimer.isPaused]);

  const startExtraTime = () => {
    if (!liveTimer.isRunning || (liveTimer.minutes === 0 && liveTimer.seconds === 0)) {
      setExtraTime(prev => ({ ...prev, isRunning: true, isPaused: false }));
      setLiveTimer({
        minutes: 0,
        seconds: 0,
        isRunning: false,
        isPaused: false,
        isAttention: false,
      });
    }
  };

  const stopExtraTime = () => {
    setExtraTime(prev => ({ ...prev, isRunning: false }));
  };

  const startProgram = (program: Program, fromQueue = false) => {
    setLiveTimer({
      minutes: program.duration,
      seconds: 0,
      isRunning: true,
      isPaused: false,
      isAttention: false,
      programName: program.name,
    });
    setExtraTime(prev => ({ ...prev, isRunning: false }));
    setIsTimerComplete(false);
    setAutoTransition(null);
    const queuedIndex = autoQueueIds.indexOf(program.id);
    if (queuedIndex >= 0 && (fromQueue || autoRun)) setAutoQueueIndex(queuedIndex);
    else if (autoRun && !fromQueue) stopAutoRun();
    setLastRunDurationSec(program.duration * 60);
    setTimerDeadline(Date.now() + program.duration * 60 * 1000);
    
    // Add to timer history
    const historyEntry = {
      id: Date.now().toString(),
      programName: program.name,
      duration: program.duration,
      timestamp: Date.now()
    };
    setTimerHistory(prev => [historyEntry, ...prev]);
  };

  startProgramRef.current = startProgram;

  const getOrderedAutoPrograms = (categoryId: string) => programs.filter(program => program.categoryId === categoryId);

  const startAutoRun = (categoryId: string, startProgramId?: string) => {
    const queue = getOrderedAutoPrograms(categoryId);
    if (queue.length === 0) return;
    const startIndex = startProgramId ? queue.findIndex(program => program.id === startProgramId) : 0;
    const effectiveIndex = startIndex >= 0 ? startIndex : 0;
    const activeQueue = queue.slice(effectiveIndex);
    if (activeQueue.length === 0) return;
    const ids = queue.map(program => program.id);
    setAutoQueueCategoryId(categoryId);
    setAutoQueueIds(ids);
    setAutoQueueIndex(effectiveIndex);
    setAutoRun(true);
    setAutoTransition(null);
    startProgram(activeQueue[0], true);
  };

  const stopAutoRun = () => {
    setAutoRun(false);
    setAutoQueueCategoryId('');
    setAutoTransition(null);
    setAutoQueueIds([]);
    setAutoQueueIndex(0);
  };

  const startQueuedNextProgram = () => {
    if (!autoTransition) return;
    const nextProgram = programs.find(program => program.id === autoTransition.programId);
    if (!nextProgram) {
      stopAutoRun();
      return;
    }
    setAutoQueueIndex(autoQueueIds.indexOf(nextProgram.id));
    startProgramRef.current(nextProgram, true);
  };

  const skipToNextProgram = () => {
    if (!autoRun) return;
    if (autoTransition) {
      startQueuedNextProgram();
      return;
    }
    setExtraTime(prev => ({ ...prev, isRunning: false, isPaused: false }));
    setLiveTimer(prev => ({
      ...prev,
      minutes: 0,
      seconds: 0,
      isRunning: false,
      isPaused: false,
      isAttention: false,
    }));
    setTimerDeadline(null);
    setIsTimerComplete(true);
    setTimeout(() => setIsTimerComplete(false), 2500);
  };
  skipToNextProgramRef.current = skipToNextProgram;

  const reorderProgram = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setPrograms(previous => {
      const source = previous.find(program => program.id === sourceId);
      const target = previous.find(program => program.id === targetId);
      if (!source || !target || source.categoryId !== target.categoryId) return previous;

      const categoryPrograms = previous.filter(program => program.categoryId === source.categoryId);
      const remaining = categoryPrograms.filter(program => program.id !== sourceId);
      const targetIndex = remaining.findIndex(program => program.id === targetId);
      remaining.splice(targetIndex, 0, source);

      let categoryIndex = 0;
      return previous.map(program => program.categoryId === source.categoryId
        ? remaining[categoryIndex++]
        : program
      );
    });
  };

  const reorderCategory = (sourceId: string, targetId: string) => {
    setCategories(previous => {
      const sourceIndex = previous.findIndex(category => category.id === sourceId);
      const targetIndex = previous.findIndex(category => category.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return previous;
      const reordered = [...previous];
      const [category] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, category);
      return reordered;
    });
  };

  useEffect(() => {
    if (!isTimerComplete || !autoRun || autoTransition) return;
    const nextProgram = autoQueueCategoryId && programs.find(program => program.id === autoQueueIds[autoQueueIndex + 1]);
    if (nextProgram) {
      setAutoTransition({
        programId: nextProgram.id,
        programName: nextProgram.name,
        deadline: Date.now() + autoCooldownSec * 1000,
      });
    } else {
      setAutoRun(false);
      setAutoQueueCategoryId('');
      setAutoQueueIds([]);
      setAutoQueueIndex(0);
    }
  }, [isTimerComplete, autoRun, autoTransition, programs, autoQueueIds, autoQueueIndex, autoQueueCategoryId, autoCooldownSec]);

  useEffect(() => {
    if (!autoRun || !autoTransition) return;
    const remainingMs = autoTransition.deadline - Date.now();
    if (remainingMs > 0) {
      const timeout = setTimeout(() => {
        const nextProgram = programs.find(program => program.id === autoTransition.programId);
        if (nextProgram) {
          const nextIndex = autoQueueIds.indexOf(nextProgram.id);
          setAutoQueueIndex(nextIndex);
          startProgramRef.current(nextProgram, true);
        } else {
          stopAutoRun();
        }
      }, remainingMs);
      return () => clearTimeout(timeout);
    }

    const nextProgram = programs.find(program => program.id === autoTransition.programId);
    if (nextProgram) {
      const nextIndex = autoQueueIds.indexOf(nextProgram.id);
      setAutoQueueIndex(nextIndex);
      startProgramRef.current(nextProgram, true);
    } else {
      stopAutoRun();
    }
  }, [autoRun, autoTransition, autoQueueIds, programs]);

  const addTimeToLiveTimer = (minutes: number) => {
    if (liveTimer.isRunning) {
      setLiveTimer(prev => ({
        ...prev,
        minutes: Math.max(0, prev.minutes + minutes)
      }));
      if (!liveTimer.isPaused && timerDeadlineRef.current) {
        setTimerDeadline(timerDeadlineRef.current + minutes * 60 * 1000);
      }
    }
  };

  const addSecondsToLiveTimer = (seconds: number) => {
    if (liveTimer.isRunning) {
      setLiveTimer(prev => {
        const totalSeconds = prev.minutes * 60 + prev.seconds + seconds;
        const newMinutes = Math.floor(Math.max(0, totalSeconds) / 60);
        const newSeconds = Math.max(0, totalSeconds) % 60;
        return {
          ...prev,
          minutes: newMinutes,
          seconds: newSeconds
        };
      });
      if (!liveTimer.isPaused && timerDeadlineRef.current) {
        setTimerDeadline(timerDeadlineRef.current + seconds * 1000);
      }
    }
  };

  const clearCacheAndRefresh = () => {
    // Clear all localStorage data
    localStorage.clear();
    // Refresh the page
    window.location.reload();
  };

  const handleProgramEdit = (program: Program) => {
    setPrograms(prev => prev.map(p => 
      p.id === program.id ? program : p
    ));
  };

  const runTimerFromHistory = (historyEntry: { programName: string; duration: number }) => {
    setLiveTimer({
      minutes: historyEntry.duration,
      seconds: 0,
      isRunning: true,
      isPaused: false,
      isAttention: false,
      programName: historyEntry.programName,
    });
    setExtraTime(prev => ({ ...prev, isRunning: false }));
    setLastRunDurationSec(historyEntry.duration * 60);
    setTimerDeadline(Date.now() + historyEntry.duration * 60 * 1000);
    
    // Add new entry to history
    const newHistoryEntry = {
      id: Date.now().toString(),
      programName: historyEntry.programName,
      duration: historyEntry.duration,
      timestamp: Date.now()
    };
    setTimerHistory(prev => [newHistoryEntry, ...prev]);
  };

  const clearTimerHistory = () => {
    setTimerHistory([]);
  };

  const handleImportPrograms = (importedPrograms: Program[]) => {
    setPrograms(prev => [...prev, ...importedPrograms]);
  };

  const handleImportCategories = (importedCategories: Category[]) => {
    setCategories(prev => {
      const existingNames = new Set(prev.map(cat => cat.name.toLowerCase()));
      const newCategories = importedCategories.filter(cat => !existingNames.has(cat.name.toLowerCase()));
      return [...prev, ...newCategories];
    });
  };

  // ---- LAN remote access: publish state and apply remote commands ----
  useEffect(() => {
    window.electronAPI?.remotePublish?.({
      timer: {
        minutes: liveTimer.minutes,
        seconds: liveTimer.seconds,
        isRunning: liveTimer.isRunning,
        isPaused: liveTimer.isPaused,
        isAttention: liveTimer.isAttention,
        isComplete: isTimerComplete,
        programName: liveTimer.programName || '',
        backgroundCleared: timerBackgroundCleared,
      },
      extraTime,
      programs,
      categories,
      auto: {
        enabled: autoRun,
        categoryId: autoQueueCategoryId,
        queueIds: autoQueueIds,
        index: autoQueueIndex,
        transition: autoTransition,
        cooldownSec: autoCooldownSec,
      },
      alert: { message: alertMessage, show: showAlert, flashing: isAlertFlashing },
      clock: { time: currentTime, use12: use12HourFormat, show: showClock },
      nextProgram: showNextProgram ? { name: showNextProgram.name, duration: showNextProgram.duration } : null,
    });
  }, [liveTimer, isTimerComplete, extraTime, programs, categories, autoRun, autoQueueCategoryId, autoQueueIds, autoQueueIndex, autoTransition, autoCooldownSec, alertMessage, showAlert, isAlertFlashing, currentTime, use12HourFormat, showClock, showNextProgram, timerBackgroundCleared]);

  const remoteCommandHandlerRef = useRef<(command: RemoteCommand) => void>(() => undefined);
  remoteCommandHandlerRef.current = (command) => {
    if (!command) return;
    if (command.scope === 'bible') {
      if (command.action === 'select') {
        localStorage.setItem('remoteBibleSelection', JSON.stringify({ bookId: command.bookId, chapter: command.chapter, verse: command.verse }));
        window.electronAPI?.remotePublish?.({ bible: { bookId: Number(command.bookId), chapter: Number(command.chapter), verse: Number(command.verse), presented: '', isShowing: false } });
        window.dispatchEvent(new Event('storage'));
        return;
      }
      const selectedBibleDisplayIsExternal = availableDisplays.some(display => display.id === selectedProjectDisplay && !display.isPrimary);
      if (command.action === 'show' && command.verseData && selectedProjectDisplay !== null && selectedBibleDisplayIsExternal) {
        localStorage.setItem('activeProjection', 'bible');
        localStorage.setItem('bibleProjectionData', JSON.stringify({ verses: [command.verseData], theme: selectedTheme, referenceOnly: false, description: '' }));
        localStorage.setItem('remoteBibleSelection', JSON.stringify({ bookId: command.bookId, chapter: command.chapter, verse: command.verse }));
        window.electronAPI?.remotePublish?.({ bible: { bookId: Number(command.bookId), chapter: Number(command.chapter), verse: Number(command.verse), presented: `${command.verseData.book_name} ${command.verseData.chapter}:${command.verseData.verse}`, isShowing: true } });
        window.electronAPI?.openBibleProjection?.(selectedProjectDisplay);
        setIsBibleProjected(true);
        return;
      }
      if (command.action === 'hide') {
        const current = localStorage.getItem('bibleProjectionData');
        if (current) {
          try {
            const projection = JSON.parse(current);
            localStorage.setItem('bibleProjectionData', JSON.stringify({ ...projection, verses: [], referenceOnly: false, description: '' }));
          } catch { /* ignore invalid projection data */ }
        }
        localStorage.setItem('activeProjection', 'bible');
        window.electronAPI?.remotePublish?.({ bible: { ...(command.bible || {}), isShowing: false, presented: '' } });
        return;
      }
      return;
    }
    if (command.scope !== 'timer') return;
    switch (command.action) {
      case 'start': startLiveTimer(); break;
      case 'startDuration':
        startRemoteDuration(Number(command.minutes), Number(command.seconds));
        break;
      case 'pause': pauseLiveTimer(); break;
      case 'resume': resumeLiveTimer(); break;
      case 'stop': resetLiveTimer(); break;
      case 'clearScreen': clearTimerScreen(Boolean(command.clearBackground)); break;
      case 'restart': restartLiveTimer(); break;
      case 'attention': toggleAttention(); break;
      case 'addMinutes': addTimeToLiveTimer(Number(command.value) || 0); break;
      case 'addSeconds': addSecondsToLiveTimer(Number(command.value) || 0); break;
      case 'nextProgram': skipToNextProgram(); break;
      case 'startProgram': {
        const program = programs.find(p => p.id === command.id);
        if (program) startProgram(program);
        break;
      }
      case 'autoStart':
        if (typeof command.categoryId === 'string') startAutoRun(command.categoryId, command.programId);
        break;
      case 'autoStop': stopAutoRun(); break;
      case 'setCooldown': {
        const value = Math.round(Number(command.value));
        if (value >= 3 && value <= 300) setAutoCooldownSec(value);
        break;
      }
      case 'alert':
        if (command.mode === 'clear') {
          setAlertMessage('');
          setShowAlert(false);
          setIsAlertFlashing(false);
        } else {
          if (typeof command.message === 'string') setAlertMessage(command.message);
          if (command.mode === 'flash') {
            setIsAlertFlashing(true);
            setTimeout(() => setIsAlertFlashing(false), 2500);
          } else {
            setShowAlert(true);
          }
        }
        break;
      case 'clock': setShowClock(Boolean(command.show)); break;
      case 'extraStart': startExtraTime(); break;
      case 'extraStop': stopExtraTime(); break;
    }
  };

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onRemoteCommand?.((command) => {
      remoteCommandHandlerRef.current(command);
    });
    const unsubscribeClients = window.electronAPI?.onRemoteClientsChanged?.((count: number) => setRemoteClients(count));
    window.electronAPI?.remoteStatus?.().then(status => {
      setRemoteRunning(Boolean(status?.running));
      setRemoteClients(status?.clients || 0);
    }).catch(() => undefined);
    return () => {
      unsubscribe?.();
      unsubscribeClients?.();
    };
  }, []);

  if (showSplash) {
    const customSplashImage = localStorage.getItem('splashImage');
    
    if (customSplashImage) {
    return (
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center"
        style={{ 
            backgroundImage: `url(${customSplashImage})`,
          backgroundSize: 'cover'
        }}
      >
        <div className="bg-black bg-opacity-50 p-8 rounded-lg text-center">
            <img src="./icon.png" alt="" className="mx-auto mb-6 h-24 w-24 rounded-2xl object-contain" />
          <h1 className="text-6xl font-bold text-white mb-4">MediaGuy</h1>
          <p className="text-xl text-white opacity-80">
            Live event tools for your team
          </p>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#101722] text-white">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-700 bg-[#17212e] px-5">
          <img src="./icon.png" alt="" className="h-8 w-8 rounded object-contain" />
          <span className="text-sm font-bold tracking-tight">MediaGuy</span>
          <span className="text-xs text-slate-500">1.0.0</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="w-full max-w-3xl">
            <div className="flex items-center gap-5 sm:gap-7">
              <img src="./icon.png" alt="" className="h-20 w-20 shrink-0 rounded-2xl object-contain sm:h-28 sm:w-28" />
              <div>
                <p className="text-xs font-bold uppercase text-cyan-300">Church & live event control</p>
                <h1 className="mt-2 text-4xl font-bold sm:text-6xl">MediaGuy</h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">Keep the programme moving, scripture ready, and your team in sync.</p>
              </div>
            </div>
            <div className="mt-10 grid grid-cols-2 border-y border-slate-700 sm:grid-cols-4">
              {[
                { label: 'Timer', color: 'border-blue-500' },
                { label: 'Bible & Songs', color: 'border-cyan-400' },
                { label: 'Transcribe', color: 'border-red-400' },
                { label: 'Cameras', color: 'border-emerald-400' },
              ].map(item => <div key={item.label} className={`border-l-2 ${item.color} px-3 py-3 text-xs font-semibold text-slate-300 sm:px-4 sm:text-sm`}>{item.label}</div>)}
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs text-slate-400" role="status" aria-live="polite">
              <span className="flex h-5 items-end gap-1" aria-hidden="true"><span className="h-2 w-1 bg-cyan-400 animate-pulse" /><span className="h-4 w-1 bg-cyan-400 animate-pulse [animation-delay:150ms]" /><span className="h-3 w-1 bg-cyan-400 animate-pulse [animation-delay:300ms]" /></span>
              Preparing your workspace
            </div>
          </div>
        </div>
      </div>
    );
  }

  const navigationTabs = [
    { id: 'main', label: 'Timer', Icon: Layout, active: activeTab === 'main', activeClass: 'bg-blue-600 text-white shadow-lg', onClick: () => changeNavigationTab('main') },
    { id: 'transcribe', label: 'Transcribe', Icon: Mic, active: activeTab === 'transcribe', activeClass: 'bg-red-700 text-white shadow-lg', onClick: () => changeNavigationTab('transcribe') },
    { id: 'bible', label: 'Bible/Songs', Icon: FileText, active: activeTab === 'bible' || activeTab === 'songs', activeClass: 'bg-blue-600 text-white shadow-lg', onClick: () => setActiveTab(activeTab === 'songs' ? 'bible' : 'songs') },
    { id: 'cameras', label: 'Cameras', Icon: Camera, active: activeTab === 'cameras', activeClass: 'bg-cyan-700 text-white shadow-lg', onClick: () => changeNavigationTab('cameras') },
    { id: 'guide', label: '?', Icon: HelpCircle, active: activeTab === 'guide', activeClass: 'bg-purple-600 text-white shadow-lg', onClick: () => changeNavigationTab('guide') },
  ] as const;

  const reorderNavigationTab = (targetId: typeof navigationOrder[number]) => {
    const sourceId = draggedNavigationTab.current;
    draggedNavigationTab.current = null;
    if (!sourceId || sourceId === targetId) return;
    setNavigationOrder(order => {
      const next = [...order];
      const sourceIndex = next.indexOf(sourceId);
      const targetIndex = next.indexOf(targetId);
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      return next;
    });
  };

  // Render control panel
  return (
    <div className={`${activeTab === 'bible' || activeTab === 'songs' || activeTab === 'cameras' ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-gray-900 flex flex-col`}>
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 px-2 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 shadow-md select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties & { WebkitAppRegion: 'drag' | 'no-drag' }}>
        <div className="flex items-center space-x-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: 'drag' | 'no-drag' }}>
          <img src="./icon.png" alt="MediaGuy" className="h-8 w-8 rounded object-contain" />
          <h1 className="text-xl font-bold text-white tracking-tight">MediaGuy <span className="text-xs text-blue-400 font-normal">v1.0.0</span></h1>
        </div>
        
        <div className="flex min-w-0 max-w-full flex-[1_1_420px] flex-nowrap justify-center overflow-x-auto bg-gray-900 rounded-lg p-1 border border-gray-700" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: 'drag' | 'no-drag' }}>
          {navigationOrder.map(id => {
            const tab = navigationTabs.find(item => item.id === id);
            if (!tab) return null;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                draggable
                onClick={tab.onClick}
                onDragStart={event => { draggedNavigationTab.current = tab.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', tab.id); }}
                onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                onDrop={event => { event.preventDefault(); reorderNavigationTab(tab.id); }}
                onDragEnd={() => { draggedNavigationTab.current = null; }}
                title={tab.id === 'transcribe' && isTranscribing ? 'Transcription in progress' : 'Drag to reorder'}
                aria-label={`${tab.label}${tab.id === 'transcribe' && isTranscribing ? ', transcription in progress' : ''}, draggable navigation tab`}
                className={`group flex shrink-0 cursor-grab items-center space-x-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-bold transition-all active:cursor-grabbing sm:px-3 ${tab.active ? tab.activeClass : 'text-gray-400 hover:text-white'}`}
              >
                <GripVertical size={12} className="hidden text-gray-500 opacity-60 group-hover:opacity-100 sm:block" />
                <Icon size={16} className={tab.id === 'transcribe' && isTranscribing ? 'recording-tab-icon' : ''} />
                {tab.id === 'guide' ? <span className="sr-only">Guide</span> : <span>{tab.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: 'drag' | 'no-drag' }}>
          <button
            onClick={() => setShowRemoteModal(true)}
            aria-label="Remote access"
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all ${remoteRunning ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:bg-gray-700'}`}
            title="Remote access: control this app from phones and tablets on your network"
          >
            <Radio size={14} />
            {remoteRunning && <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-gray-900 ${remoteClients > 0 ? 'bg-emerald-400' : 'bg-emerald-700'}`} />}
          </button>
          <div className="hidden text-sm font-mono font-bold text-blue-400 md:block" aria-label="System clock" title="System clock">
            {currentTime}
          </div>
          <div className="flex items-center">
            <button
              onClick={() => window.electronAPI?.windowMinimize?.()}
              className="w-10 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-700 rounded"
              title="Minimize"
            >
              <Minus size={16} />
            </button>
            <button
              onClick={() => window.electronAPI?.windowToggleMaximize?.()}
              className="w-10 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-700 rounded"
              title="Maximize"
            >
              <Square size={14} />
            </button>
            <button
              onClick={() => window.electronAPI?.windowClose?.()}
              className="w-10 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-red-600 rounded"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className={`flex-1 min-h-0 w-full p-2 sm:p-4 ${activeTab === 'bible' || activeTab === 'songs' || activeTab === 'cameras' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div className={activeTab === 'transcribe' ? 'block h-full' : 'hidden'}>
          <TranscribeTab />
        </div>

        {activeTab === 'main' ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Setup Section */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-2">Setup</h2>
            
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
              <button
                onClick={() => setSetupTab('timer')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  setupTab === 'timer'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                Timer Setup
              </button>
              <button
                onClick={() => setSetupTab('extra')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  setupTab === 'extra'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                Extra Time Setup
              </button>
            </div>

            {/* Tab Content */}
            {setupTab === 'timer' && (
              <div className="space-y-4">
            <Timer
              minutes={setupTimer.minutes}
              seconds={setupTimer.seconds}
              isAttention={false}
              isComplete={false}
            />
            <TimerControls
              onAdjustTime={handleSetupTimerAdjust}
              onAdjustSeconds={handleSetupSecondsAdjust}
              onReset={() => setSetupTimer(prev => ({ ...prev, minutes: 0, seconds: 0 }))}
              showStartButton={true}
              onStart={startLiveTimer}
            />
              </div>
            )}

            {setupTab === 'extra' && (
              <div className="space-y-4">
                <div className="bg-black rounded-lg overflow-hidden">
                  <ExtraTimeTimer
                    minutes={extraTime.minutes}
                    seconds={extraTime.seconds}
                    isRunning={extraTime.isRunning}
                  />
                </div>
                <TimerControls
                  onAdjustTime={(minutes) => setExtraTime(prev => ({
                    ...prev,
                    minutes: Math.max(0, prev.minutes + minutes),
                  }))}
                  onAdjustSeconds={(seconds) => setExtraTime(prev => {
                    const totalSeconds = prev.minutes * 60 + prev.seconds + seconds;
                    if (totalSeconds < 0) return { ...prev, minutes: 0, seconds: 0 };
                    return {
                      ...prev,
                      minutes: Math.floor(totalSeconds / 60),
                      seconds: totalSeconds % 60,
                    };
                  })}
                  onReset={() => setExtraTime({
                    minutes: 0,
                    seconds: 0,
                    isRunning: false,
                    isPaused: false,
                  })}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={startExtraTime}
                    disabled={liveTimer.isRunning && (liveTimer.minutes > 0 || liveTimer.seconds > 0)}
                    className={`w-full px-4 py-2 rounded ${
                      liveTimer.isRunning && (liveTimer.minutes > 0 || liveTimer.seconds > 0)
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500'
                    } text-white`}
                  >
                    Start Extra Time
                  </button>
                  {extraTime.isRunning && (
                    <button
                      onClick={stopExtraTime}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-500"
                    >
                      Stop Extra Time
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Section */}
          <div className="space-y-4">
            {autoRun && autoTransition && (
              <AutoRunBanner
                programName={autoTransition.programName}
                categoryName={categories.find(category => category.id === autoQueueCategoryId)?.name || 'Program queue'}
                deadline={autoTransition.deadline}
                onStartNow={startQueuedNextProgram}
              />
            )}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Live</h2>
              <div className="flex flex-wrap gap-1 justify-center sm:justify-end">
                <button
                  onClick={() => window.electronAPI?.openAdvancedMultiScreen?.()}
                  className="bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-opacity-80 transition-all duration-300 flex items-center gap-1"
                >
                  <Settings size={14} />
                  Display
                </button>
                <button
                  onClick={() => setShowClock(!showClock)}
                  className={`${showClock ? 'bg-red-600 animate-pulse shadow-lg ring-2 ring-red-400' : 'bg-blue-600'} text-white px-3 py-2 rounded text-sm hover:bg-opacity-80 transition-all duration-300 flex items-center gap-1`}
                >
                  <Clock size={14} />
                  Clock
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-500 text-sm flex items-center gap-1"
                  title="Settings"
                >
                  <Settings size={14} />
                  Settings
                </button>
              </div>
            </div>
            <div className={`relative rounded-lg ${isTimerComplete ? 'animate-[timerComplete_0.5s_ease-in-out_5]' : ''}`}>
              {showClock && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-10 pointer-events-none">
                  <span 
                    className="font-bold text-white"
                    style={{
                      fontSize: `${2.5 * clockScale / 100}rem`, // Scale based on clock size setting
                      fontFamily: 'Arial, sans-serif',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      letterSpacing: '0.02em',
                      maxWidth: '90%',
                      textAlign: 'center'
                    }}
                  >
                    {currentTime}
                  </span>
                </div>
              )}
              {!extraTime.isRunning ? (
                <>
                  <Timer
                    minutes={liveTimer.minutes}
                    seconds={liveTimer.seconds}
                    isAttention={liveTimer.isAttention}
                    isComplete={isTimerComplete}
                    background={background}
                    fullscreen={false}
                    isRunning={liveTimer.isRunning}
                  />
                  {showProgramName && liveTimer.programName && (
                    <div 
                      className="absolute top-4 left-0 right-0 text-center z-10 pointer-events-none"
                      style={{
                        fontSize: `${1.2 * programNameScale / 100}rem`,
                        color: 'rgba(255, 255, 255, 0.8)',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                        fontWeight: 'bold',
                        fontFamily: 'Arial, sans-serif'
                      }}
                    >
                      Now: {liveTimer.programName}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-black animate-extraTimeBg rounded-lg overflow-hidden">
                  <ExtraTimeTimer
                    minutes={extraTime.minutes}
                    seconds={extraTime.seconds}
                    isRunning={extraTime.isRunning}
                  />
                </div>
              )}
              {showNextProgram && (
                <NextProgramNotification 
                  programName={showNextProgram.name}
                  fullscreen={false}
                  compact={true}
                  duration={showNextProgram.duration}
                />
              )}
              {(showAlert || isAlertFlashing) && (
                <div className="absolute bottom-0 left-0 right-0 z-10">
                  <AlertBanner 
                    message={getProcessedAlertMessage()}
                    isFlashing={isAlertFlashing}
                    fullscreen={false}
                  />
                </div>
              )}
              {autoRun && (
                <div className="absolute bottom-3 left-0 right-0 text-center z-20 pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider text-amber-300 bg-amber-950/70 border border-amber-500/30 backdrop-blur-md shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Autopilot active
                  </span>
                </div>
              )}
              {autoRun && autoTransition && (
                <AutoRunDisplay
                  programName={autoTransition.programName}
                  deadline={autoTransition.deadline}
                  compact
                />
              )}
            </div>
            

              
              {/* Autopilot control strip */}
              {autoRun && (
                <div className="rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-950/70 via-gray-900 to-gray-900 p-2 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        Autopilot · Program {Math.min(autoQueueIndex + 1, autoQueueIds.length)} of {autoQueueIds.length}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-bold text-white">
                        {autoTransition
                          ? `Cooldown → ${autoTransition.programName}`
                          : (() => {
                              const upcoming = programs.find(p => p.id === autoQueueIds[autoQueueIndex + 1]);
                              return upcoming ? `Next: ${upcoming.name}` : 'Last program in queue';
                            })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800/80 px-2 py-1" title="Cooldown countdown before the next program starts automatically">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1">Cooldown</span>
                        <button
                          onClick={() => setAutoCooldownSec(prev => Math.max(3, prev - 5))}
                          className="w-6 h-6 rounded bg-gray-700 text-white hover:bg-gray-600 text-xs font-bold"
                        >−</button>
                        <span className="w-9 text-center font-mono text-sm font-bold text-amber-300">{autoCooldownSec}s</span>
                        <button
                          onClick={() => setAutoCooldownSec(prev => Math.min(300, prev + 5))}
                          className="w-6 h-6 rounded bg-gray-700 text-white hover:bg-gray-600 text-xs font-bold"
                        >+</button>
                      </div>
                      <button
                        onClick={skipToNextProgram}
                        disabled={!liveTimer.isRunning && !extraTime.isRunning && !autoTransition}
                        title="End the current program now and start the next-program cooldown (N)"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black tracking-wide text-white shadow-md shadow-blue-900/30 transition-all hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <SkipForward size={14} />
                        NEXT PROG
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Timer Controls - Mobile Friendly Layout */}
            <div className="space-y-4">
              {/* Primary Controls */}
              <div className="flex space-x-2">
                {!liveTimer.isRunning ? (
                  <button
                    onClick={startLiveTimer}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-500"
                  >
                    <Play className="inline-block mr-2" size={18} />
                    Start
                  </button>
                ) : (
                  <>
                    <button
                      onClick={liveTimer.isPaused ? resumeLiveTimer : pauseLiveTimer}
                      className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-500"
                    >
                      {liveTimer.isPaused ? (
                        <>
                          <Play className="inline-block mr-2" size={18} />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="inline-block mr-2" size={18} />
                          Pause
                        </>
                      )}
                    </button>
                    <button
                      onClick={restartLiveTimer}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
                    >
                      <RotateCcw className="inline-block mr-2" size={18} />
                      Restart
                    </button>
                    <button
                      onClick={resetLiveTimer}
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-500"
                    >
                      <RefreshCw className="inline-block mr-2" size={18} />
                      Stop
                    </button>
                  </>
                )}
                <button
                  onClick={toggleAttention}
                  className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-500"
                >
                  <AlertTriangle className="inline-block mr-2" size={18} />
                  Attention!
                </button>
              </div>

              <button type="button" onClick={() => setShowClearScreenDialog(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-700 bg-gray-800 px-3 text-xs font-bold text-gray-200 hover:bg-gray-700"><Trash2 size={14} /> Clear screen</button>
              
              {/* Minute Controls - Grid Layout */}
              {liveTimer.isRunning && (
                <div className="grid grid-cols-6 gap-1">
                  <button
                    onClick={() => addTimeToLiveTimer(-10)}
                    className="bg-red-800 text-white px-2 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    -10m
                  </button>
                  <button
                    onClick={() => addTimeToLiveTimer(-5)}
                    className="bg-red-600 text-white px-2 py-2 rounded hover:bg-red-500 text-sm"
                  >
                    -5m
                  </button>
                  <button
                    onClick={() => addTimeToLiveTimer(-1)}
                    className="bg-orange-500 text-white px-2 py-2 rounded hover:bg-orange-400 text-sm"
                  >
                    -1m
                  </button>
                  <button
                    onClick={() => addTimeToLiveTimer(1)}
                    className="bg-blue-500 text-white px-2 py-2 rounded hover:bg-blue-400 text-sm"
                  >
                    +1m
                  </button>
                  <button
                    onClick={() => addTimeToLiveTimer(5)}
                    className="bg-green-600 text-white px-2 py-2 rounded hover:bg-green-500 text-sm"
                  >
                    +5m
                  </button>
                  <button
                    onClick={() => addTimeToLiveTimer(10)}
                    className="bg-green-800 text-white px-2 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    +10m
                  </button>
                </div>
              )}
              
              {/* Second Controls - Grid Layout */}
              {liveTimer.isRunning && (
                <div className="grid grid-cols-6 gap-1">
                  <button
                    onClick={() => addSecondsToLiveTimer(-10)}
                    className="bg-red-700 text-white px-2 py-2 rounded hover:bg-red-600 text-sm"
                  >
                    -10s
                  </button>
                  <button
                    onClick={() => addSecondsToLiveTimer(-5)}
                    className="bg-red-500 text-white px-2 py-2 rounded hover:bg-red-400 text-sm"
                  >
                    -5s
                  </button>
                  <button
                    onClick={() => addSecondsToLiveTimer(-1)}
                    className="bg-orange-500 text-white px-2 py-2 rounded hover:bg-orange-400 text-sm"
                  >
                    -1s
                  </button>
                  <button
                    onClick={() => addSecondsToLiveTimer(1)}
                    className="bg-blue-500 text-white px-2 py-2 rounded hover:bg-blue-400 text-sm"
                  >
                    +1s
                  </button>
                  <button
                    onClick={() => addSecondsToLiveTimer(5)}
                    className="bg-green-500 text-white px-2 py-2 rounded hover:bg-green-400 text-sm"
                  >
                    +5s
                  </button>
                  <button
                    onClick={() => addSecondsToLiveTimer(10)}
                    className="bg-green-700 text-white px-2 py-2 rounded hover:bg-green-600 text-sm"
                  >
                    +10s
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleCaseChange}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    textCase === 'normal' ? 'bg-gray-600 text-white' :
                    textCase === 'uppercase' ? 'bg-blue-600 text-white' :
                    textCase === 'lowercase' ? 'bg-green-600 text-white' :
                    'bg-purple-600 text-white'
                  }`}
                  title={`Case: ${textCase}`}
                >
                  {textCase === 'normal' ? 'Aa' : textCase === 'uppercase' ? 'AA' : textCase === 'lowercase' ? 'aa' : 'Aa'}
                </button>
              <input
                type="text"
                placeholder="Alert message..."
                  className="flex-1 p-2 rounded bg-gray-800 text-white"
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
              />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAlert(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-500"
                >
                  Show Alert
                </button>
                <button
                  onClick={() => {
                    setIsAlertFlashing(true);
                    setTimeout(() => setIsAlertFlashing(false), 2500);
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-500"
                >
                  Flash Alert
                </button>
                <button
                  onClick={() => {
                    setAlertMessage('');
                    setShowAlert(false);
                    setIsAlertFlashing(false);
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                 Clear Alert
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          <div className="lg:col-span-2 bg-gray-800 p-4 rounded">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl text-white">Order of Program</h2>
              <div className="flex flex-wrap justify-end gap-2">
              <button
                  onClick={() => setShowAddProgramModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-500 flex items-center space-x-2 transition-colors"
              >
                  <Plus size={16} />
                  <span>Add Program</span>
              </button>
                <button
                  onClick={() => setShowCategoryManager(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 flex items-center space-x-2 transition-colors"
                >
                  <FolderPlus size={16} />
                  <span>Categories</span>
                </button>
                <button
                  onClick={() => setShowExportImportManager(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-500 flex items-center space-x-2 transition-colors"
                >
                  <FileText size={16} />
                  <span>Export/Import</span>
                </button>
              </div>
            </div>
            <ProgramList
              programs={programs}
              categories={categories}
              onDelete={handleProgramDelete}
              onStart={startProgram}
              onNotify={(program) => {
                setShowNextProgram(program);
                setTimeout(() => {
                  setShowNextProgram(null);
                }, 5000);
              }}
              onEdit={handleProgramEdit}
              onReorder={reorderProgram}
              onReorderCategory={reorderCategory}
              onStartAutoRun={startAutoRun}
              onStopAutoRun={stopAutoRun}
              autoRunCategoryId={autoQueueCategoryId}
              currentProgramName={liveTimer.programName}
              isRunning={liveTimer.isRunning}
            />
          </div>

          {/* Timer History */}
          <div className="bg-gray-800 p-4 rounded">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl text-white">Timer History</h2>
                <button
                onClick={clearTimerHistory}
                className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-500 text-sm"
                disabled={timerHistory.length === 0}
              >
                Clear All
                </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
              {timerHistory.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
                  No timer history yet
                </div>
              ) : (
                timerHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-gray-700 p-3 rounded-lg flex justify-between items-center"
                  >
                    <div>
                      <div className="text-white font-medium">{entry.programName}</div>
                      <div className="text-gray-400 text-sm">
                        {entry.duration} min • {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  <button
                      onClick={() => runTimerFromHistory(entry)}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-500 text-sm"
                  >
                      Run Again
                  </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    ) : activeTab === 'bible' || activeTab === 'songs' ? (
          <BibleSongsTab
            availableDisplays={availableDisplays}
            selectedDisplay={selectedProjectDisplay}
            onDisplayChange={setSelectedProjectDisplay}
            onRefreshDisplays={refreshProjectDisplays}
            projectBible={projectBibleVerses}
            testDisplay={testBibleDisplay}
            isProjecting={isBibleProjected}
            onCloseProjection={() => requestBibleExit()}
            selectedTheme={selectedTheme}
            onThemeChange={handleThemeChange}
          />
        ) : activeTab === 'guide' ? (
          <div className="mx-auto w-full xl:max-w-[1600px] 2xl:max-w-[1900px]">
            <HowToGuide variant="page" />
          </div>
        ) : null}
        <div className={`h-full min-h-0 ${activeTab === 'cameras' ? 'block' : 'hidden'}`}>
          <RemoteCameraMixer />
        </div>
      </div>

      {showClearScreenDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="clear-screen-title" className="w-full max-w-md border border-gray-700 bg-gray-900 p-5 text-white shadow-2xl">
            <h2 id="clear-screen-title" className="text-lg font-bold">Clear timer screen?</h2>
            <p className="mt-2 text-sm text-gray-300">The timer will reset to 00:00. Choose whether to keep or remove the displayed background.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => clearTimerScreen(false)} className="min-h-11 rounded bg-blue-600 px-3 text-sm font-bold hover:bg-blue-500">Timer only</button>
              <button type="button" onClick={() => clearTimerScreen(true)} className="min-h-11 rounded bg-red-700 px-3 text-sm font-bold hover:bg-red-600">Timer + background</button>
            </div>
            <button type="button" onClick={() => setShowClearScreenDialog(false)} className="mt-3 min-h-10 w-full rounded border border-gray-700 text-sm font-semibold text-gray-300 hover:bg-gray-800">Cancel</button>
          </section>
        </div>
      )}

      {showBibleExitDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="bible-exit-title" className="w-full max-w-md border border-gray-700 bg-gray-900 p-5 text-white shadow-2xl">
            <h2 id="bible-exit-title" className="text-lg font-bold">Exit Bible projection?</h2>
            <p className="mt-2 text-sm text-gray-300">Keep the current background on the projection screen, or clear the screen completely.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => finishBibleExit(true)} className="min-h-11 rounded bg-blue-600 px-3 text-sm font-bold hover:bg-blue-500">Keep background</button>
              <button type="button" onClick={() => finishBibleExit(false)} className="min-h-11 rounded bg-red-700 px-3 text-sm font-bold hover:bg-red-600">Clear projection</button>
            </div>
            <button type="button" onClick={() => setShowBibleExitDialog(false)} className="mt-3 min-h-10 w-full rounded border border-gray-700 text-sm font-semibold text-gray-300 hover:bg-gray-800">Cancel</button>
          </section>
        </div>
      )}

      {showSettings && (
          <DisplaySettings 
            onClose={() => setShowSettings(false)} 
            onBackgroundChange={handleBackgroundChange}
            onClearCache={clearCacheAndRefresh}
            onTimeFormatChange={handleTimeFormatChange}
          />
      )}

      {showCategoryManager && (
        <CategoryManager
          isOpen={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
          categories={categories}
          programs={programs}
          onAdd={addCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
        />
      )}

      {deleteConfirmation.isOpen && (
        <DeleteConfirmation
          isOpen={deleteConfirmation.isOpen}
          onClose={() => setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDelete}
          programName={deleteConfirmation.programName}
        />
      )}

      {showExportImportManager && (
        <ExportImportManager
          isOpen={showExportImportManager}
          onClose={() => setShowExportImportManager(false)}
          programs={programs}
          categories={categories}
          onImportPrograms={handleImportPrograms}
          onImportCategories={handleImportCategories}
        />
      )}


      {showRemoteModal && (
        <RemoteAccessModal
          onClose={() => setShowRemoteModal(false)}
          onStatusChange={(running, clients) => { setRemoteRunning(running); setRemoteClients(clients); }}
        />
      )}

      {showAddProgramModal && (
        <AddProgramModal
          isOpen={showAddProgramModal}
          onClose={() => setShowAddProgramModal(false)}
          onSave={addProgram}
          categories={categories}
          initialCategory={selectedCategory}
        />
      )}
      {transcribeBibleSuggestion && (
        <section role="status" aria-live="polite" className="fixed bottom-5 right-5 z-[140] w-[min(24rem,calc(100vw-2.5rem))] border border-emerald-500/50 bg-gray-950 p-4 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-300">Scripture heard</p>
              <p className="mt-1 text-lg font-bold">I heard {transcribeBibleSuggestion.label}</p>
            </div>
            <button type="button" onClick={() => setTranscribeBibleSuggestion(null)} aria-label="Dismiss Scripture suggestion" className="flex h-8 w-8 items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white"><X size={16} /></button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">Closing in {transcribeBibleSuggestion.countdown}s</span>
            <button type="button" onClick={() => {
              localStorage.setItem('pendingTranscribeBibleReference', JSON.stringify({ book: transcribeBibleSuggestion.book, chapter: transcribeBibleSuggestion.chapter, verse: transcribeBibleSuggestion.verse }));
                window.dispatchEvent(new CustomEvent('stage-timer-bible-reference-request', { detail: { book: transcribeBibleSuggestion.book, chapter: transcribeBibleSuggestion.chapter, verse: transcribeBibleSuggestion.verse } }));
              setTranscribeBibleSuggestion(null);
              changeNavigationTab('bible');
            }} className="bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-600">Jump to Bible</button>
          </div>
        </section>
      )}
</div>
  );
}

export default App;
