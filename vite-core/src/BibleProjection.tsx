import { useEffect, useState } from 'react';
import type { SongSlide, Verse } from './components/BibleSongsTab';
import { ProjectionSurface } from './components/ProjectionSurface';
import { useProjectionSettings } from './components/projectionSettings';
import { useRemoteState } from './remote/useRemoteState';
import { RemoteCameraVideo } from './remote/RemoteCameraVideo';

interface ProjectionData {
  verses: Verse[];
  songTitle?: string;
  songText?: string;
  songStyle?: SongSlide;
  theme: string;
  referenceOnly?: boolean;
  description?: string;
}

export default function BibleProjection() {
  const [data, setData] = useState<ProjectionData | null>(null);
  const [settings] = useProjectionSettings();
  const remote = useRemoteState();
  const cameraOverride = remote.state.cameraMixer?.overrides.bible;
  const cameraOverlay = cameraOverride ? <RemoteCameraVideo conn={remote} enabled className="absolute inset-0 z-[1] h-full w-full object-cover" /> : null;

  useEffect(() => {
    const loadProjection = (stored: string | null) => {
      if (!stored) return;
      try {
        setData(JSON.parse(stored));
      } catch {
        console.error('invalid projection data');
      }
    };
    loadProjection(localStorage.getItem('bibleProjectionData'));
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'bibleProjectionData') loadProjection(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setData(previous => previous ? { ...previous, verses: [], referenceOnly: false, description: '' } : previous);
        const stored = localStorage.getItem('bibleProjectionData');
        if (stored) {
          try {
            const projection = JSON.parse(stored);
            localStorage.setItem('bibleProjectionData', JSON.stringify({ ...projection, verses: [], referenceOnly: false, description: '' }));
          } catch { /* ignore invalid projection data */ }
        }
        return;
      }
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        window.electronAPI?.navigateBibleProjection?.(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      // Forward alphanumeric keys and Backspace to the control window so the
      // quick-lookup modal can be opened/operated while the projection is active.
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if ((e.key.length === 1 && /^[a-z0-9]$/i.test(e.key)) || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          window.electronAPI?.typeBibleProjectionKey?.(e.key);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: settings.bgColor, color: settings.textColor }}>
        <p>Loading Bible...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0">
      {data.description && <div className="absolute left-0 right-0 top-[5%] z-10 text-center text-[3cqh] font-semibold" style={{ color: settings.textColor }}>{data.description}</div>}
      <ProjectionSurface settings={settings} verses={data.verses} songText={data.songText} songStyle={data.songStyle} referenceOnly={data.referenceOnly} backgroundOverlay={cameraOverlay} className="h-full w-full" />
    </div>
  );
}
