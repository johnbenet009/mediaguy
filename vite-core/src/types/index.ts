export interface Program {
  id: string;
  name: string;
  duration: number;
  categoryId: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface RemoteCommand {
  scope?: string;
  action?: string;
  id?: string;
  bookId?: number;
  chapter?: number;
  verse?: number;
  verseData?: { book: number; book_name: string; chapter: number; verse: number; text: string };
  bible?: Record<string, unknown>;
  minutes?: number;
  seconds?: number;
  clearBackground?: boolean;
  value?: number;
  categoryId?: string;
  programId?: string;
  mode?: string;
  message?: string;
  show?: boolean;
}

export interface TimerState {
  minutes: number;
  seconds: number;
  isRunning: boolean;
  isPaused: boolean;
  isAttention: boolean;
  isComplete?: boolean;
  programName?: string;
}

export interface ExtraTimeState {
  minutes: number;
  seconds: number;
  isRunning: boolean;
  isPaused: boolean;
}

export interface DisplaySizeSettings {
  timer: number;
  alert: number;
  nextProgram: number;
  alertSpeed: number;
  clock: number;
  programName: number;
  showProgramName: boolean;
}