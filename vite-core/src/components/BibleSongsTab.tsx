import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Search, Plus, Save, Trash2, Play, BookOpen, Music, Check, ChevronRight, History, Keyboard, RefreshCw, Settings2, X, Globe, ExternalLink, Loader2, Wifi, WifiOff } from 'lucide-react';
import { ProjectionSettingsPanel } from './ProjectionSettingsPanel';
import { useProjectionSettings } from './projectionSettings';
import { ProjectionSurface } from './ProjectionSurface';

export type Verse = { book: number; book_name: string; chapter: number; verse: number; text: string };
type BibleBook = { id: number; name: string };
type BibleMobilePane = 'books' | 'chapters' | 'verses';
export type SongSlide = { html: string; fontFamily: string; fontSize: number; color: string; bold: boolean; italic: boolean; useGlobalStyle: boolean };
type SavedSong = { id: string; title: string; lyrics: string; slides?: SongSlide[]; sourceUrl?: string; updatedAt: number };
type OnlineResourceType = 'hymns' | 'manuals';
type OnlineResource = { id: string; title: string; path: string; detail: string; number?: number; isLesson?: boolean };
type ResourceNetworkStatus = 'checking' | 'online' | 'offline' | 'unavailable';
type BibleTool = 'browse' | 'search' | 'history';
type BibleReference = { id: string; label: string; verses: Verse[]; addedAt: number };
type RemoteBibleCommand = { scope?: string; action?: string; bookId?: number; chapter?: number; verse?: number };

const readBibleReferences = (key: string): BibleReference[] => {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(saved) ? saved.filter((item): item is BibleReference => Boolean(item && typeof item.id === 'string' && Array.isArray(item.verses))) : [];
  } catch {
    return [];
  }
};

const BIBLE_SECTIONS: Array<{ name: string; color: string; books: string[] }> = [
  { name: 'Law', color: 'bg-sky-700', books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'] },
  { name: 'History', color: 'bg-emerald-700', books: ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'] },
  { name: 'Poetry', color: 'bg-amber-700', books: ['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon'] },
  { name: 'Major Prophets', color: 'bg-rose-700', books: ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel'] },
  { name: 'Minor Prophets', color: 'bg-orange-700', books: ['Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'] },
  { name: 'Gospels', color: 'bg-teal-700', books: ['Matthew', 'Mark', 'Luke', 'John'] },
  { name: 'Church History', color: 'bg-cyan-700', books: ['Acts'] },
  { name: 'Letters', color: 'bg-indigo-700', books: ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude'] },
  { name: 'Revelation', color: 'bg-slate-700', books: ['Revelation'] },
];

const bookSectionColor = new Map(BIBLE_SECTIONS.flatMap(section => section.books.map(book => [book, section.color] as const)));
const numberGridColumns = (count: number) => Math.max(1, Math.ceil(Math.sqrt(count * 1.6)));

const readSongLibrary = (): SavedSong[] => {
  try {
    const saved = localStorage.getItem('bibleSongsLibrary');
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((song): song is SavedSong => Boolean(song && typeof song.id === 'string' && typeof song.title === 'string' && typeof song.lyrics === 'string'));
    }
  } catch {
    return [];
  }
  const title = localStorage.getItem('songEditorTitle') || '';
  const lyrics = localStorage.getItem('songEditorSlides') || '';
  return title.trim() || lyrics.trim() ? [{ id: 'legacy-song', title: title.trim() || 'Untitled song', lyrics, updatedAt: Date.now() }] : [];
};

const DEFAULT_SONG_SLIDE: SongSlide = { html: '', fontFamily: 'Arial', fontSize: 44, color: '#ffffff', bold: true, italic: false, useGlobalStyle: false };
const SONG_FONTS = ['Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Impact', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

const escapeSongHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

const sanitizeSongHtml = (html: string) => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const cleanNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeSongHtml(node.textContent || '').replace(/&amp;amp;/g, '&amp;').replace(/&amp;lt;/g, '&lt;').replace(/&amp;gt;/g, '&gt;');
    if (!(node instanceof HTMLElement)) return '';
    const children = Array.from(node.childNodes).map(cleanNode).join('');
    if (node.tagName === 'BR') return '<br>';
    if (['DIV', 'P'].includes(node.tagName)) return children === '<br>' ? '<br>' : `${children}<br>`;
    if (['B', 'STRONG', 'I', 'EM', 'U'].includes(node.tagName)) return `<${node.tagName.toLowerCase()}>${children}</${node.tagName.toLowerCase()}>`;
    if (node.tagName === 'SPAN') {
      const color = node.style.color;
      const safeColor = /^#[0-9a-f]{3,8}$/i.test(color) || /^rgb\([\d\s,]+\)$/i.test(color) ? color : '';
      const styles = [safeColor ? `color:${safeColor}` : '', node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600 ? 'font-weight:bold' : '', node.style.fontStyle === 'italic' ? 'font-style:italic' : '', node.style.textDecorationLine.includes('underline') || node.style.textDecoration.includes('underline') ? 'text-decoration:underline' : ''].filter(Boolean).join(';');
      return styles ? `<span style="${styles}">${children}</span>` : children;
    }
    return children;
  };
  return Array.from(parsed.body.childNodes).map(cleanNode).join('');
};

const songHtmlToText = (html: string) => {
  const parsed = new DOMParser().parseFromString(sanitizeSongHtml(html).replace(/<br>/g, '<br>'), 'text/html');
  return parsed.body.innerHTML.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(div|p)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
};

const splitSongDocument = (html: string, textFallback: string, previousSlides: SongSlide[]) => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const groups: string[] = [];
  let current: string[] = [];
  let trailingSeparator = false;
  const finishGroup = (separator = false) => {
    const content = current.join('<br>').replace(/(?:<br>)+$/, '');
    if (songHtmlToText(content).trim()) {
      groups.push(content);
      trailingSeparator = false;
    } else if (separator) trailingSeparator = true;
    current = [];
  };
  const appendText = (value: string) => {
    const lines = value.replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((line, index) => {
      if (line.trim()) current.push(escapeSongHtml(line));
      else if (current.length) finishGroup(true);
      if (index < lines.length - 1 && line.trim()) current.push('<br>');
    });
  };

  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent || '');
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === 'BR') {
      if (current.length && current[current.length - 1] !== '<br>') current.push('<br>');
      else if (current.length) finishGroup(true);
      return;
    }
    if (['DIV', 'P'].includes(node.tagName)) {
      if (node.hasAttribute('data-song-stanza')) {
        if (!node.textContent?.trim()) {
          finishGroup(true);
          return;
        }
        Array.from(node.childNodes).forEach(processNode);
        return;
      }
      if (!node.textContent?.trim()) {
        finishGroup(true);
        return;
      }
      if (Array.from(node.children).some(child => ['DIV', 'P'].includes(child.tagName))) {
        Array.from(node.childNodes).forEach(processNode);
        return;
      }
      const blockHtml = sanitizeSongHtml(node.innerHTML);
      if (blockHtml) current.push(blockHtml);
      return;
    }
    const nodeHtml = sanitizeSongHtml(node.outerHTML);
    if (nodeHtml) current.push(nodeHtml);
  };
  Array.from(parsed.body.childNodes).forEach(processNode);
  finishGroup();
  if (trailingSeparator) groups.push('');

  if (!groups.length && textFallback.trim()) {
    return textFallback.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean).map((part, index) => ({
      ...(previousSlides[index] || DEFAULT_SONG_SLIDE),
      html: escapeSongHtml(part),
    }));
  }
  return groups.map((group, index) => ({
    ...(previousSlides[index] || previousSlides[previousSlides.length - 1] || DEFAULT_SONG_SLIDE),
    html: group,
  }));
};

const legacySlides = (lyrics: string): SongSlide[] => lyrics.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean).map(text => ({ ...DEFAULT_SONG_SLIDE, html: escapeSongHtml(text) }));

const savedSongSlides = (song: SavedSong): SongSlide[] => Array.isArray(song.slides) && song.slides.length
  ? song.slides.map(slide => ({ ...DEFAULT_SONG_SLIDE, ...slide, html: sanitizeSongHtml(slide.html || '') }))
  : legacySlides(song.lyrics);

const getRhemaResourceHtml = async (type: OnlineResourceType, query = '', detailPath = '') => {
  if (window.electronAPI?.getRhemaResourcePage) {
    const result = await window.electronAPI.getRhemaResourcePage({ type, query, detailPath });
    if (!result.ok || !result.html) throw new Error(result.error || 'Could not load online resources.');
    return result.html;
  }
  const searchParams = new URLSearchParams({ q: query });
  if (type === 'hymns') {
    searchParams.set('org', 'rccg');
    searchParams.set('artifactId', 'rccg-the-redeemed-hymnal-4');
  }
  const path = detailPath || (query ? `/${type}/search?${searchParams.toString()}` : type === 'hymns' ? '/hymns/rccg-the-redeemed-hymnal-4' : '/manuals');
  const response = await fetch(`/__rhema${path}`);
  if (!response.ok) throw new Error(`getRhema returned HTTP ${response.status}.`);
  return response.text();
};

const parseGetRhemaResources = (html: string, type: OnlineResourceType): OnlineResource[] => {
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (type === 'hymns') {
    const resources = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .map(anchor => {
        const path = new URL(anchor.getAttribute('href') || '', 'https://getrhema.net').pathname;
        const match = path.match(/^\/hymns\/rccg-the-redeemed-hymnal-4\/(\d+)$/);
        if (!match) return null;
        const row = anchor.closest('tr');
        const number = Number(match[1]);
        const detail = row?.innerText.replace(anchor.innerText, '').replace(/^\s*\d+\s*/, '').trim() || `Hymn ${number}`;
        return { id: path, title: anchor.innerText.trim(), path, detail, number };
      })
      .filter((resource): resource is NonNullable<typeof resource> => Boolean(resource?.title));
    return Array.from(new Map(resources.map(resource => [resource.path, resource])).values()).sort((left, right) => (left.number || 0) - (right.number || 0));
  }

  const resources: OnlineResource[] = [];
  for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href^="/manuals/"]'))) {
    const path = new URL(anchor.getAttribute('href') || '', 'https://getrhema.net').pathname;
    const lessonMatch = path.match(/^\/manuals\/([a-z0-9-]+)\/lesson-(\d+)$/);
    if (lessonMatch) {
      const title = anchor.innerText.trim();
      const rowText = anchor.closest('tr')?.innerText || '';
      const detail = rowText.replace(title, '').trim() || `Lesson ${lessonMatch[2]}`;
      if (title) resources.push({ id: path, title, path, detail, number: Number(lessonMatch[2]), isLesson: true });
      continue;
    }
    if (!/^\/manuals\/[a-z0-9-]+$/.test(path)) continue;
    let parent: HTMLElement | null = anchor.parentElement;
    let heading: HTMLHeadingElement | null = null;
    while (parent && parent !== document.body && !heading) {
      heading = parent.querySelector('h2');
      if (parent.innerText.length > 1200) break;
      parent = parent.parentElement;
    }
    const title = heading?.textContent?.trim() || '';
    if (!title) continue;
    const card = heading?.parentElement?.parentElement;
    const detail = card?.innerText.replace(title, '').replace(/VIEW ALL \d+ LESSONS/ig, '').trim() || 'Sunday School manual';
    resources.push({ id: path, title, path, detail });
  }
  return Array.from(new Map(resources.map(resource => [resource.path, resource])).values());
};

const parseGetRhemaHymnLyrics = (html: string) => {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const title = document.querySelector('main h1')?.textContent?.trim() || '';
  const verses = Array.from(document.querySelectorAll('main h2'))
    .filter(heading => /^VERSE\s+\d+/i.test(heading.textContent?.trim() || ''))
    .map(heading => {
      let next = heading.nextElementSibling;
      while (next && next.tagName !== 'P' && next.tagName !== 'DIV') next = next.nextElementSibling;
      const verseText = next instanceof HTMLElement ? next.innerText : next?.textContent || '';
      return verseText.replace(/\s*\n\s*/g, '\n').trim();
    })
    .filter(Boolean);
  return { title, lyrics: verses.join('\n\n') };
};

interface BibleSongsTabProps {
  availableDisplays: Array<{ id: number; label: string; isPrimary: boolean }>;
  selectedDisplay: number | null;
  onDisplayChange: (displayId: number) => void;
  onRefreshDisplays: () => void;
  projectBible: (verses: Verse[], options?: { referenceOnly?: boolean; description?: string }) => void;
  projectSong: (title: string, slide: SongSlide) => void;
  clearProjection: () => void;
  testDisplay?: () => void;
  isProjecting: boolean;
  onCloseProjection: () => void;
}

const bookColors = [
  'bg-rose-600', 'bg-fuchsia-600', 'bg-indigo-600', 'bg-emerald-600',
  'bg-sky-600', 'bg-amber-600', 'bg-lime-600', 'bg-teal-600',
  'bg-violet-600', 'bg-pink-600', 'bg-cyan-600', 'bg-orange-600',
];

const getBookColor = (bookId: number) => bookColors[bookId % bookColors.length];

const bookAbbreviation: Record<string, string> = {
  Genesis: 'Gn', Exodus: 'Ex', Leviticus: 'Lv', Numbers: 'Nm', Deuteronomy: 'Dt',
  Joshua: 'Jos', Judges: 'Jg', Ruth: 'Ru', '1 Samuel': '1Sm', '2 Samuel': '2Sm',
  '1 Kings': '1Ki', '2 Kings': '2Ki', '1 Chronicles': '1Ch', '2 Chronicles': '2Ch',
  Ezra: 'Ezr', Nehemiah: 'Ne', Esther: 'Es', Job: 'Jb', Psalms: 'Ps',
  Proverbs: 'Pr', Ecclesiastes: 'Ec', 'Song of Solomon': 'So', Isaiah: 'Is',
  Jeremiah: 'Jr', Lamentations: 'La', Ezekiel: 'Eze', Daniel: 'Dn',
  Hosea: 'Ho', Joel: 'Jl', Amos: 'Am', Obadiah: 'Ob', Jonah: 'Jon',
  Micah: 'Mic', Nahum: 'Na', Habakkuk: 'Hab', Zephaniah: 'Zp',
  Haggai: 'Hg', Zechariah: 'Zc', Malachi: 'Ml', Matthew: 'Mt',
  Mark: 'Mk', Luke: 'Lk', John: 'Jn', Acts: 'Ac', Romans: 'Rm',
  '1 Corinthians': '1Co', '2 Corinthians': '2Co', Galatians: 'Ga',
  Ephesians: 'Eph', Philippians: 'Php', Colossians: 'Col', '1 Thessalonians': '1Th',
  '2 Thessalonians': '2Th', '1 Timothy': '1Ti', '2 Timothy': '2Ti',
  Titus: 'Tit', Philemon: 'Phm', Hebrews: 'Heb', James: 'Jm',
  '1 Peter': '1Pe', '2 Peter': '2Pe', '1 John': '1Jo', '2 John': '2Jo',
  '3 John': '3Jo', Jude: 'Jud', Revelation: 'Rev'
};

const bookAliases: Record<string, string[]> = {
  Genesis: ['gen', 'ge', 'gn'], Exodus: ['ex', 'exo'], Leviticus: ['lev', 'lv'],
  Numbers: ['num', 'nm'], Deuteronomy: ['deut', 'deu', 'dt'], Psalms: ['psalm', 'ps', 'psa', 'sl'],
  Proverbs: ['prov', 'pr', 'pv'], 'Song of Solomon': ['song', 'song of songs', 'canticles', 'sos'],
  Matthew: ['matt', 'mt'], Mark: ['mk', 'mrk'], Luke: ['lk', 'luk'], John: ['jn', 'jhn'],
  Acts: ['act'], Romans: ['rom', 'rm'], Revelation: ['rev', 're', 'apoc'],
};

const normalizeBookQuery = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase();

const bibleSearchWords = (value: string) => value.toLocaleLowerCase().match(/[a-z0-9]+/g) || [];

export const BibleSongsTab: React.FC<BibleSongsTabProps> = ({
  availableDisplays,
  selectedDisplay,
  onDisplayChange,
  onRefreshDisplays,
  projectBible,
  projectSong,
  clearProjection,
  testDisplay,
  isProjecting,
  onCloseProjection,
}) => {
  const [innerTab, setInnerTab] = useState<'bible' | 'songs'>('bible');
  const [mobileBiblePane, setMobileBiblePane] = useState<BibleMobilePane>('books');
  const [bibleTool, setBibleTool] = useState<BibleTool>('browse');
  const [projectionSettings, updateProjectionSettings] = useProjectionSettings();
  const [showBibleSettings, setShowBibleSettings] = useState(false);
  const [showDisplayPicker, setShowDisplayPicker] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);

  // Bible State
  const [allVerses, setAllVerses] = useState<Verse[]>([]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedBookName, setSelectedBookName] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([]);
  const [quickLookupOpen, setQuickLookupOpen] = useState(false);
  const [quickLookupStage, setQuickLookupStage] = useState<'book' | 'chapter' | 'verse'>('book');
  const [quickLookupQuery, setQuickLookupQuery] = useState('');
  const [quickLookupBook, setQuickLookupBook] = useState<BibleBook | null>(null);
  const [bookFilter, setBookFilter] = useState('');
  const searchTextRef = useRef<HTMLInputElement>(null);
  const verseReaderRef = useRef<HTMLDivElement>(null);
  const [presentedVerses, setPresentedVerses] = useState<Verse[]>([]);
  const [bibleHistory, setBibleHistory] = useState<BibleReference[]>(() => readBibleReferences('bibleHistory'));
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<'exact' | 'all' | 'any'>('all');
  const [searchTestament, setSearchTestament] = useState<'all' | 'old' | 'new'>('all');
  const [searchBookId, setSearchBookId] = useState('all');
  const [searchResults, setSearchResults] = useState<Verse[]>([]);
  const [searchMessage, setSearchMessage] = useState('');
  const pendingReferenceRef = useRef<{ bookId: number; chapter: number; verseNumbers: number[] } | null>(null);

  const externalDisplays = availableDisplays.filter(display => !display.isPrimary);
  const hasValidDisplay = selectedDisplay !== null && externalDisplays.some(display => display.id === selectedDisplay);
  const projectionActive = isProjecting || (practiceMode && presentedVerses.length > 0);

  useEffect(() => {
    if (availableDisplays.length > 0 && !hasValidDisplay) setShowDisplayPicker(true);
  }, [availableDisplays, hasValidDisplay]);

  // Songs State
  const [savedSongs, setSavedSongs] = useState<SavedSong[]>(readSongLibrary);
  const initialSongId = localStorage.getItem('songEditorSelectedId');
  const initialSavedSong = savedSongs.find(song => song.id === initialSongId);
  const [songTitle, setSongTitle] = useState(() => initialSavedSong?.title || localStorage.getItem('songEditorTitle') || '');
  const [songSlides, setSongSlides] = useState<SongSlide[]>(() => {
    if (initialSavedSong) return savedSongSlides(initialSavedSong);
    const slides = legacySlides(localStorage.getItem('songEditorSlides') || '');
    return slides.length ? slides : [{ ...DEFAULT_SONG_SLIDE }];
  });
  const slideEditorRef = useRef<HTMLDivElement>(null);
  const songSelectionRef = useRef<Range | null>(null);
  const [songSearch, setSongSearch] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(() => {
    if (initialSavedSong) return initialSavedSong.id;
    const title = localStorage.getItem('songEditorTitle') || '';
    const lyrics = songSlides.map(slide => songHtmlToText(slide.html).trim()).join('\n\n');
    return savedSongs.find(song => song.title === title && (song.slides ? song.slides.map(slide => songHtmlToText(slide.html)).join('\n\n') : song.lyrics) === lyrics)?.id ?? null;
  });
  const [songSaveMessage, setSongSaveMessage] = useState('');
  const [songSourceUrl, setSongSourceUrl] = useState(() => initialSavedSong?.sourceUrl || localStorage.getItem('songEditorSourceUrl') || '');
  const [activeSlide, setActiveSlide] = useState(0);
  const [showOnlineResources, setShowOnlineResources] = useState(false);
  const [onlineResourceType, setOnlineResourceType] = useState<OnlineResourceType>('hymns');
  const [onlineResourceSearch, setOnlineResourceSearch] = useState('');
  const [onlineResources, setOnlineResources] = useState<OnlineResource[]>([]);
  const [onlineResourcesLoading, setOnlineResourcesLoading] = useState(false);
  const [onlineResourcesError, setOnlineResourcesError] = useState('');
  const [onlineResourceNetworkStatus, setOnlineResourceNetworkStatus] = useState<ResourceNetworkStatus>('checking');
  const [onlineResourceLoadingPath, setOnlineResourceLoadingPath] = useState('');
  const [selectedManualResource, setSelectedManualResource] = useState<OnlineResource | null>(null);
  const onlineResourceRequest = useRef(0);
  const [liveSong, setLiveSong] = useState<{ title: string; slide: number } | null>(null);
  const [editorSyncKey, setEditorSyncKey] = useState(0);
  const currentSongSlide = songSlides[activeSlide] || DEFAULT_SONG_SLIDE;
  const songDocumentHtml = songSlides.map((slide, index) => `<div data-song-stanza="${index}">${slide.html || '<br>'}</div>${index < songSlides.length - 1 ? '<div><br></div>' : ''}`).join('');
  const songDocumentHtmlRef = useRef(songDocumentHtml);
  songDocumentHtmlRef.current = songDocumentHtml;

  useLayoutEffect(() => {
    if (!slideEditorRef.current) return;
    if (slideEditorRef.current.innerHTML !== songDocumentHtmlRef.current) slideEditorRef.current.innerHTML = songDocumentHtmlRef.current;
  }, [innerTab, selectedSongId, editorSyncKey]);

  useEffect(() => {
    if (!showOnlineResources) return;
    const requestId = ++onlineResourceRequest.current;
    setOnlineResourceNetworkStatus('checking');
    setOnlineResourcesLoading(true);
    setOnlineResourcesError('');
    if (!navigator.onLine) {
      setOnlineResources([]);
      setOnlineResourceNetworkStatus('offline');
      setOnlineResourcesLoading(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      void getRhemaResourceHtml(onlineResourceType, onlineResourceSearch.trim()).then(html => {
        if (onlineResourceRequest.current !== requestId) return;
        setOnlineResources(parseGetRhemaResources(html, onlineResourceType));
        setOnlineResourceNetworkStatus('online');
      }).catch(error => {
        if (onlineResourceRequest.current !== requestId) return;
        setOnlineResources([]);
        void window.electronAPI?.checkInternetConnection?.().then(connection => {
          if (onlineResourceRequest.current !== requestId) return;
          const offline = !connection.online;
          setOnlineResourceNetworkStatus(offline ? 'offline' : 'unavailable');
          setOnlineResourcesError(offline ? '' : error instanceof Error ? error.message : 'getRhema is temporarily unavailable.');
        }).catch(() => {
          if (onlineResourceRequest.current !== requestId) return;
          const offline = !navigator.onLine;
          setOnlineResourceNetworkStatus(offline ? 'offline' : 'unavailable');
          setOnlineResourcesError(offline ? '' : error instanceof Error ? error.message : 'getRhema is temporarily unavailable.');
        });
        if (!window.electronAPI?.checkInternetConnection) {
          const offline = !navigator.onLine;
          setOnlineResourceNetworkStatus(offline ? 'offline' : 'unavailable');
          setOnlineResourcesError(offline ? '' : error instanceof Error ? error.message : 'getRhema is temporarily unavailable.');
        }
      }).finally(() => {
        if (onlineResourceRequest.current === requestId) setOnlineResourcesLoading(false);
      });
    }, onlineResourceSearch.trim() ? 260 : 0);
    return () => window.clearTimeout(timeout);
  }, [showOnlineResources, onlineResourceType, onlineResourceSearch]);

  // Load Bible Data
  useEffect(() => {
    const loadBible = async () => {
      const paths = ['kjv.json', 'vite-core/public/kjv.json'];
      for (const p of paths) {
        try {
          const res = await fetch(p);
          if (!res.ok) continue;
          const text = await res.text();
          if (text.trimStart().startsWith('<')) continue;
          const data = JSON.parse(text);
          const list: Verse[] = Array.isArray(data) ? data : data?.verses ?? [];
          if (list.length > 0) {
            setAllVerses(list);
            const bMap = new Map<number, string>();
            list.forEach(v => { if (!bMap.has(v.book)) bMap.set(v.book, v.book_name); });
            const sorted = Array.from(bMap.entries()).sort((a, b) => a[0] - b[0]).map(([id, name]) => ({ id, name }));
            setBooks(sorted);
            if (sorted.length > 0) {
              setSelectedBookId(sorted[0].id);
              setSelectedBookName(sorted[0].name);
            }
            break;
          }
        } catch {
          continue;
        }
      }
    };
    loadBible();
  }, []);

  const chapters = useMemo(() => {
    if (selectedBookId === null) return [];
    return [...new Set(allVerses.filter(verse => verse.book === selectedBookId).map(verse => verse.chapter))].sort((a, b) => a - b);
  }, [allVerses, selectedBookId]);

  const chapterVerses = useMemo(() => {
    if (selectedBookId === null || selectedChapter === null) return [];
    return allVerses.filter(verse => verse.book === selectedBookId && verse.chapter === selectedChapter);
  }, [allVerses, selectedBookId, selectedChapter]);

  const quickBookMatches = useMemo(() => {
    const query = normalizeBookQuery(quickLookupQuery);
    if (!query) return [];
    return books.filter(book => [book.name, bookAbbreviation[book.name] || '', ...(bookAliases[book.name] || [])]
      .some(name => normalizeBookQuery(name).startsWith(query))).slice(0, 8);
  }, [books, quickLookupQuery]);

  const quickLookupChapterCandidates = useMemo(() => {
    const query = quickLookupQuery.trim();
    return chapters.filter(chapter => query === '' || String(chapter).startsWith(query));
  }, [chapters, quickLookupQuery]);

  const quickLookupVerseCandidates = useMemo(() => {
    const query = quickLookupQuery.trim();
    return chapterVerses.filter(verse => query === '' || String(verse.verse).startsWith(query));
  }, [chapterVerses, quickLookupQuery]);

  useEffect(() => {
    if (chapters.length === 0) {
      if (selectedChapter !== null) setSelectedChapter(null);
    } else if (!chapters.includes(selectedChapter ?? -1)) {
      const pending = pendingReferenceRef.current;
      setSelectedChapter(pending?.bookId === selectedBookId && chapters.includes(pending.chapter) ? pending.chapter : chapters[0]);
    }
  }, [chapters, selectedBookId, selectedChapter]);

  useEffect(() => {
    const pending = pendingReferenceRef.current;
    if (pending?.bookId === selectedBookId && pending.chapter === selectedChapter) {
      setSelectedVerseNumbers(pending.verseNumbers);
      pendingReferenceRef.current = null;
      return;
    }
    setSelectedVerseNumbers(chapterVerses.length > 0 ? [chapterVerses[0].verse] : []);
  }, [chapterVerses, selectedBookId, selectedChapter]);

  const chooseQuickBook = (book: BibleBook) => {
    setQuickLookupBook(book);
    setSelectedBookId(book.id);
    setSelectedBookName(book.name);
    setSelectedChapter(null);
    setSelectedVerseNumbers([]);
    setQuickLookupStage('chapter');
    setQuickLookupQuery('');
  };

  const chooseQuickChapter = (chapter: number) => {
    setSelectedChapter(chapter);
    setQuickLookupStage('verse');
    setQuickLookupQuery('');
    setMobileBiblePane('verses');
  };

  const chooseQuickVerse = (verseNumber: number, closeLookup = false, projectVerse = false) => {
    if (!chapterVerses.some(verse => verse.verse === verseNumber)) return;
    setSelectedVerseNumbers([verseNumber]);
    setMobileBiblePane('verses');
    if (closeLookup && projectVerse) {
      const verse = chapterVerses.find(item => item.verse === verseNumber);
      if (verse) presentVerses([verse]);
    }
    if (closeLookup) {
      setQuickLookupOpen(false);
      setQuickLookupStage('book');
      setQuickLookupQuery('');
    }
  };

  const currentSelectedVerses = React.useMemo(() => {
    return chapterVerses.filter(v => selectedVerseNumbers.includes(v.verse));
  }, [chapterVerses, selectedVerseNumbers]);

  useEffect(() => {
    if (!isProjecting || presentedVerses.length === 0) return;
    const reader = verseReaderRef.current;
    const activeVerse = reader?.querySelector<HTMLElement>('[data-projected-verse="true"]');
    if (!reader || !activeVerse) return;
    const readerRect = reader.getBoundingClientRect();
    const activeRect = activeVerse.getBoundingClientRect();
    const top = reader.scrollTop + activeRect.top - readerRect.top - (reader.clientHeight - activeRect.height) / 2;
    reader.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [isProjecting, presentedVerses, selectedBookId, selectedChapter]);

  useEffect(() => {
    sessionStorage.setItem('bibleHistory', JSON.stringify(bibleHistory));
  }, [bibleHistory]);

  useEffect(() => {
    window.electronAPI?.remotePublish?.({
      bible: {
        books,
        bookId: selectedBookId,
        chapter: selectedChapter,
        verse: selectedVerseNumbers[0] ?? null,
        presented: presentedVerses[0] ? `${presentedVerses[0].book_name} ${presentedVerses[0].chapter}:${presentedVerses[0].verse}` : '',
        isShowing: presentedVerses.length > 0,
      },
    });
  }, [books, selectedBookId, selectedChapter, selectedVerseNumbers, presentedVerses]);

  const remoteBibleCommandRef = useRef<(command: RemoteBibleCommand) => void>(() => undefined);
  useEffect(() => window.electronAPI?.onRemoteCommand?.(command => remoteBibleCommandRef.current(command)), []);

  const navigateToVerses = (verses: Verse[]) => {
    if (verses.length === 0) return;
    const first = verses[0];
    pendingReferenceRef.current = { bookId: first.book, chapter: first.chapter, verseNumbers: verses.map(verse => verse.verse) };
    setSelectedBookId(first.book);
    setSelectedBookName(first.book_name);
    setSelectedChapter(first.chapter);
    setSelectedVerseNumbers(verses.map(verse => verse.verse));
    setMobileBiblePane('verses');
    setBibleTool('browse');
  };

  useEffect(() => {
    const selectReference = (value: unknown) => {
      if (allVerses.length === 0 || books.length === 0 || !value || typeof value !== 'object') return;
      const reference = value as { book?: unknown; chapter?: unknown; verse?: unknown };
      if (typeof reference.book !== 'string' || typeof reference.chapter !== 'number' || typeof reference.verse !== 'number') return;
      const bookName = reference.book.toLowerCase();
      const book = books.find(item => item.name.toLowerCase() === bookName);
      const verse = allVerses.find(item => item.book === book?.id && item.chapter === reference.chapter && item.verse === reference.verse);
      if (!book || !verse) return;
      pendingReferenceRef.current = { bookId: book.id, chapter: verse.chapter, verseNumbers: [verse.verse] };
      setSelectedBookId(book.id);
      setSelectedBookName(book.name);
      setSelectedChapter(verse.chapter);
      setSelectedVerseNumbers([verse.verse]);
      setMobileBiblePane('verses');
      setBibleTool('browse');
      setQuickLookupOpen(false);
      setQuickLookupStage('book');
      setQuickLookupQuery('');
    };
    const handleReferenceRequest = (event: Event) => selectReference((event as CustomEvent<unknown>).detail);
    window.addEventListener('stage-timer-bible-reference-request', handleReferenceRequest);
    const savedReference = localStorage.getItem('pendingTranscribeBibleReference');
    if (savedReference) {
      localStorage.removeItem('pendingTranscribeBibleReference');
      try { selectReference(JSON.parse(savedReference)); } catch { /* discard invalid saved reference */ }
    }
    return () => window.removeEventListener('stage-timer-bible-reference-request', handleReferenceRequest);
  }, [allVerses, books]);

  const referenceLabel = (verses: Verse[]) => {
    if (verses.length === 0) return 'No passage selected';
    const first = verses[0];
    const last = verses[verses.length - 1];
    const range = verses.length > 1 ? `:${first.verse}-${last.verse}` : `:${first.verse}`;
    return `${first.book_name} ${first.chapter}${range}`;
  };

  const rememberPresentation = (verses: Verse[]) => {
    if (verses.length === 0) return;
    const entry: BibleReference = { id: `${Date.now()}-${verses[0].book}-${verses[0].chapter}-${verses[0].verse}`, label: referenceLabel(verses), verses, addedAt: Date.now() };
    setBibleHistory(previous => [entry, ...previous.filter(item => item.label !== entry.label)].slice(0, 100));
  };

  const presentVerses = (verses = currentSelectedVerses) => {
    if (verses.length === 0 || (selectedDisplay === null && !practiceMode)) return;
    const first = verses[0];
    const firstIndex = allVerses.findIndex(verse => verse.book === first.book && verse.chapter === first.chapter && verse.verse === first.verse);
    const sequence = firstIndex >= 0 ? [allVerses[firstIndex]] : [first];
    pendingReferenceRef.current = { bookId: first.book, chapter: first.chapter, verseNumbers: [first.verse] };
    setSelectedBookId(first.book);
    setSelectedBookName(first.book_name);
    setSelectedChapter(first.chapter);
    setSelectedVerseNumbers([first.verse]);
    setMobileBiblePane('verses');
    setPresentedVerses(sequence);
    rememberPresentation(sequence);
    projectBible(sequence);
  };

  const stepPresentedVerse = (direction: -1 | 1) => {
    if (presentedVerses.length === 0) return;
    const firstVerse = presentedVerses[0];
    const firstIndex = allVerses.findIndex(verse => verse.book === firstVerse.book && verse.chapter === firstVerse.chapter && verse.verse === firstVerse.verse);
    const nextIndex = firstIndex + direction;
    if (nextIndex < 0 || nextIndex >= allVerses.length) return;
    const nextVerse = allVerses[nextIndex];
    const nextVerses = [nextVerse];
    pendingReferenceRef.current = { bookId: nextVerse.book, chapter: nextVerse.chapter, verseNumbers: [nextVerse.verse] };
    setSelectedBookId(nextVerse.book);
    setSelectedBookName(nextVerse.book_name);
    setSelectedChapter(nextVerse.chapter);
    setSelectedVerseNumbers([nextVerse.verse]);
    setMobileBiblePane('verses');
    setPresentedVerses(nextVerses);
    projectBible(nextVerses);
    rememberPresentation(nextVerses);
  };

  remoteBibleCommandRef.current = command => {
    if (command?.scope !== 'bible') return;
    if (command.action === 'select') {
      const bookId = Number(command.bookId);
      const chapter = Number(command.chapter);
      const verse = Number(command.verse);
      const book = books.find(item => item.id === bookId);
      if (!book || !allVerses.some(item => item.book === bookId && item.chapter === chapter && item.verse === verse)) return;
      pendingReferenceRef.current = { bookId, chapter, verseNumbers: [verse] };
      setSelectedBookId(bookId);
      setSelectedBookName(book.name);
      setSelectedChapter(chapter);
      setSelectedVerseNumbers([verse]);
      setMobileBiblePane('verses');
      return;
    }
    if (command.action === 'show') {
      const bookId = Number(command.bookId);
      const chapter = Number(command.chapter);
      const verse = Number(command.verse);
      const selected = allVerses.find(item => item.book === bookId && item.chapter === chapter && item.verse === verse);
      if (!selected) return;
      const sequence = [selected];
      setPresentedVerses(sequence);
      rememberPresentation(sequence);
      projectBible(sequence);
      return;
    }
    if (command.action === 'hide') {
      setPresentedVerses([]);
      const current = localStorage.getItem('bibleProjectionData');
      if (current) {
        try {
          const projection = JSON.parse(current);
          localStorage.setItem('bibleProjectionData', JSON.stringify({ ...projection, verses: [], referenceOnly: false, description: '' }));
        } catch { /* ignore invalid projection data */ }
      }
      return;
    }
    if (command.action === 'next') bibleKeyboardActionsRef.current.stepPresentedVerse(1);
    if (command.action === 'previous') bibleKeyboardActionsRef.current.stepPresentedVerse(-1);
  };

  const searchBible = (event: React.FormEvent) => {
    event.preventDefault();
    const terms = [...new Set(bibleSearchWords(searchText.trim()))];
    if (terms.length === 0) {
      setSearchResults([]);
      setSearchMessage('Enter a word or phrase to search the Bible.');
      return;
    }
    const phrase = terms.join(' ');
    const result = allVerses.filter(verse => {
      if (searchTestament === 'old' && verse.book > 39) return false;
      if (searchTestament === 'new' && verse.book <= 39) return false;
      if (searchBookId !== 'all' && verse.book !== Number(searchBookId)) return false;
      const words = bibleSearchWords(verse.text);
      if (searchMode === 'exact') return words.join(' ').includes(phrase);
      const wordSet = new Set(words);
      return searchMode === 'all' ? terms.every(term => wordSet.has(term)) : terms.some(term => wordSet.has(term));
    });
    setSearchResults(result.slice(0, 200));
    setSearchMessage(result.length > 200 ? `${result.length} matches found. Showing the first 200; narrow your search to see fewer results.` : `${result.length} ${result.length === 1 ? 'verse' : 'verses'} found.`);
  };

  const bibleKeyboardActionsRef = useRef({ presentVerses, stepPresentedVerse });
  bibleKeyboardActionsRef.current = { presentVerses, stepPresentedVerse };
  const quickLookupActionsRef = useRef({ chooseQuickBook, chooseQuickChapter, chooseQuickVerse });
  quickLookupActionsRef.current = { chooseQuickBook, chooseQuickChapter, chooseQuickVerse };

  useEffect(() => {
    if (innerTab !== 'bible') return;
    return window.electronAPI?.onBibleProjectionNavigate?.(direction => {
      if (projectionActive) bibleKeyboardActionsRef.current.stepPresentedVerse(direction);
    });
  }, [innerTab, projectionActive]);

  // When the projection window is focused, it intercepts all keyboard input.
  // This listener receives forwarded keypresses from the projection window and
  // re-dispatches them on this window so the quick-lookup handler picks them up.
  useEffect(() => {
    if (innerTab !== 'bible') return;
    return window.electronAPI?.onBibleProjectionKey?.(key => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });
  }, [innerTab]);

  useEffect(() => {
    if (innerTab !== 'bible') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setBibleTool('search');
        window.setTimeout(() => searchTextRef.current?.focus(), 0);
        return;
      }
      if (quickLookupOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setQuickLookupOpen(false);
          setQuickLookupStage('book');
          setQuickLookupQuery('');
          return;
        }
        if (event.key === 'Backspace') {
          event.preventDefault();
          if (quickLookupQuery) setQuickLookupQuery(query => query.slice(0, -1));
          else if (quickLookupStage === 'verse') setQuickLookupStage('chapter');
          else if (quickLookupStage === 'chapter') {
            setQuickLookupStage('book');
            setQuickLookupBook(null);
          }
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          if (quickLookupStage === 'chapter') {
            const chapter = Number(quickLookupQuery);
            if (chapters.includes(chapter)) quickLookupActionsRef.current.chooseQuickChapter(chapter);
          } else if (quickLookupStage === 'verse' && event.key === 'Enter') {
            const verse = Number(quickLookupQuery);
            if (chapterVerses.some(item => item.verse === verse)) quickLookupActionsRef.current.chooseQuickVerse(verse, true, true);
          } else if (quickLookupStage === 'book') {
            const query = normalizeBookQuery(quickLookupQuery);
            const exact = books.find(book => [book.name, bookAbbreviation[book.name] || '', ...(bookAliases[book.name] || [])].some(name => normalizeBookQuery(name) === query));
            if (exact) quickLookupActionsRef.current.chooseQuickBook(exact);
          }
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const candidates = quickLookupStage === 'book'
            ? quickBookMatches
            : quickLookupStage === 'chapter'
              ? quickLookupChapterCandidates
              : quickLookupVerseCandidates.map(verse => verse.verse);
          if (candidates.length > 0) {
            const current = quickLookupStage === 'book'
              ? quickBookMatches.findIndex(book => book.id === quickLookupBook?.id)
              : quickLookupStage === 'chapter'
                ? quickLookupChapterCandidates.indexOf(selectedChapter ?? -1)
                : quickLookupVerseCandidates.findIndex(verse => selectedVerseNumbers.includes(verse.verse));
            const next = (Math.max(0, current) + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length;
            if (quickLookupStage === 'book') quickLookupActionsRef.current.chooseQuickBook(quickBookMatches[next]);
            else if (quickLookupStage === 'chapter') {
              setSelectedChapter(quickLookupChapterCandidates[next]);
              setQuickLookupQuery(String(quickLookupChapterCandidates[next]));
            }
            else quickLookupActionsRef.current.chooseQuickVerse(quickLookupVerseCandidates[next].verse);
          }
          return;
        }
        if (event.key.length === 1 && /^[a-z0-9]$/i.test(event.key)) {
          event.preventDefault();
          if (quickLookupStage === 'book') {
            const query = quickLookupQuery + event.key;
            setQuickLookupQuery(query);
            const normalized = normalizeBookQuery(query);
            const exact = books.find(book => [book.name, bookAbbreviation[book.name] || '', ...(bookAliases[book.name] || [])].some(name => normalizeBookQuery(name) === normalized));
            if (exact) quickLookupActionsRef.current.chooseQuickBook(exact);
          } else if (/^\d$/.test(event.key)) {
            const query = quickLookupQuery + event.key;
            setQuickLookupQuery(query);
            if (quickLookupStage === 'chapter') {
              const normalizedQuery = query.replace(/^0+(?=\d)/, '');
              const exactChapter = chapters.find(chapter => chapter === Number(query));
              const hasLongerMatch = !query.startsWith('0') && chapters.some(chapter => {
                const chapterText = String(chapter);
                return chapterText.startsWith(normalizedQuery) && chapterText.length > normalizedQuery.length;
              });
              if (exactChapter !== undefined) {
                setSelectedChapter(exactChapter);
                if (query.startsWith('0') || !hasLongerMatch) quickLookupActionsRef.current.chooseQuickChapter(exactChapter);
              }
            } else {
              const normalizedQuery = query.replace(/^0+(?=\d)/, '');
              const exactVerse = chapterVerses.find(verse => verse.verse === Number(query));
              const hasLongerMatch = !query.startsWith('0') && chapterVerses.some(verse => {
                const verseText = String(verse.verse);
                return verseText.startsWith(normalizedQuery) && verseText.length > normalizedQuery.length;
              });
              if (exactVerse) {
                quickLookupActionsRef.current.chooseQuickVerse(exactVerse.verse, query.startsWith('0') || !hasLongerMatch);
              } else {
                const paddedVerse = query.startsWith('0')
                  ? chapterVerses.find(verse => verse.verse === Number(normalizedQuery))
                  : undefined;
                if (paddedVerse) quickLookupActionsRef.current.chooseQuickVerse(paddedVerse.verse);
                else if (!hasLongerMatch) {
                  const normalizedVerse = chapterVerses.find(verse => String(verse.verse) === normalizedQuery);
                  if (normalizedVerse) quickLookupActionsRef.current.chooseQuickVerse(normalizedVerse.verse);
                }
              }
            }
          }
        }
        return;
      }
      // Alphanumeric keys always open the quick lookup modal, even when focus is on a UI element.
      // This ensures navigation with arrow keys (which may move focus to buttons) doesn't break typing.
      if (editing) return;
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && /^[a-z0-9]$/i.test(event.key)) {
        event.preventDefault();
        setBibleTool('browse');
        setQuickLookupOpen(true);
        setQuickLookupStage('book');
        setQuickLookupBook(null);
        setQuickLookupQuery(event.key);
        const normalized = normalizeBookQuery(event.key);
        const exact = books.find(book => [book.name, bookAbbreviation[book.name] || '', ...(bookAliases[book.name] || [])].some(name => normalizeBookQuery(name) === normalized));
        if (exact) chooseQuickBook(exact);
        return;
      }
      if (event.key === 'Escape' && practiceMode && presentedVerses.length > 0) {
        setPresentedVerses([]);
        return;
      }
      if (event.key === 'Escape' && isProjecting) {
        setPresentedVerses([]);
        onCloseProjection();
        return;
      }
      if (event.key === 'Enter' || event.key === 'F5') {
        if (currentSelectedVerses.length > 0) {
          event.preventDefault();
          bibleKeyboardActionsRef.current.presentVerses();
        }
        return;
      }
      if ((isProjecting || (practiceMode && presentedVerses.length > 0)) && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        bibleKeyboardActionsRef.current.stepPresentedVerse(event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [books, chapterVerses, chapters, currentSelectedVerses, innerTab, isProjecting, onCloseProjection, practiceMode, presentedVerses, quickBookMatches, quickLookupBook?.id, quickLookupChapterCandidates, quickLookupOpen, quickLookupQuery, quickLookupStage, quickLookupVerseCandidates, selectedChapter, selectedVerseNumbers]);

  // Song effects
  useEffect(() => {
    localStorage.setItem('bibleSongsLibrary', JSON.stringify(savedSongs));
  }, [savedSongs]);

  useEffect(() => {
    if (selectedSongId) localStorage.setItem('songEditorSelectedId', selectedSongId);
    else localStorage.removeItem('songEditorSelectedId');
  }, [selectedSongId]);

  useEffect(() => {
    localStorage.setItem('songEditorTitle', songTitle);
    localStorage.setItem('songEditorSlides', songSlides.map(slide => songHtmlToText(slide.html).trim()).join('\n\n'));
  }, [songTitle, songSlides]);

  useEffect(() => {
    if (songSourceUrl) localStorage.setItem('songEditorSourceUrl', songSourceUrl);
    else localStorage.removeItem('songEditorSourceUrl');
  }, [songSourceUrl]);

  useEffect(() => {
    setActiveSlide(idx => Math.min(idx, Math.max(0, songSlides.length - 1)));
  }, [songSlides.length]);

  const toggleVerseSelection = (verseNum: number) => {
    setSelectedVerseNumbers(prev =>
      prev.includes(verseNum)
        ? prev.filter(n => n !== verseNum)
        : [...prev, verseNum].sort((a, b) => a - b)
    );
  };

  const filteredBooks = books.filter(b => b.name.toLowerCase().includes(bookFilter.toLowerCase()));
  const filteredSongs = savedSongs
    .filter(song => `${song.title} ${song.lyrics}`.toLowerCase().includes(songSearch.trim().toLowerCase()))
    .sort((left, right) => right.updatedAt - left.updatedAt);

  const saveSong = () => {
    const title = songTitle.trim();
    if (!title) {
      setSongSaveMessage('Add a song title before saving.');
      return;
    }
    const id = selectedSongId || `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const song = { id, title, lyrics: songSlides.map(slide => songHtmlToText(slide.html).trim()).join('\n\n'), slides: songSlides, sourceUrl: songSourceUrl || undefined, updatedAt: Date.now() };
    setSavedSongs(previous => previous.some(item => item.id === id)
      ? previous.map(item => item.id === id ? song : item)
      : [song, ...previous]);
    setSelectedSongId(id);
    setSongSaveMessage(`Saved "${title}".`);
  };

  const startNewSong = () => {
    setSelectedSongId(null);
    setSongTitle('');
    setSongSourceUrl('');
    setSongSlides([{ ...DEFAULT_SONG_SLIDE }]);
    setActiveSlide(0);
    setEditorSyncKey(key => key + 1);
    setSongSaveMessage('');
  };

  const openSong = (song: SavedSong) => {
    setSelectedSongId(song.id);
    setSongTitle(song.title);
    setSongSourceUrl(song.sourceUrl || '');
    setSongSlides(savedSongSlides(song));
    setActiveSlide(0);
    setEditorSyncKey(key => key + 1);
    setSongSaveMessage('');
  };

  const deleteSong = (song: SavedSong) => {
    if (!window.confirm(`Delete "${song.title}" from the song library?`)) return;
    setSavedSongs(previous => previous.filter(item => item.id !== song.id));
    if (selectedSongId === song.id) startNewSong();
    setSongSaveMessage(`Deleted "${song.title}".`);
  };

  const updateSongSlide = (index: number, patch: Partial<SongSlide>) => {
    setSongSlides(previous => previous.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...patch } : slide));
    setSongSaveMessage('');
  };

  const handleSlideInput = (rawHtml: string, rawText: string, editor: HTMLDivElement) => {
    const parsedSlides = splitSongDocument(rawHtml, rawText, songSlides);
    setSongSlides(parsedSlides.length ? parsedSlides : [{ ...DEFAULT_SONG_SLIDE }]);
    setActiveSlide(index => Math.min(index, Math.max(0, parsedSlides.length - 1)));
    let stanzaIndex = 0;
    for (const block of Array.from(editor.querySelectorAll<HTMLElement>('div, p'))) {
      if (!block.textContent?.trim()) {
        block.removeAttribute('data-song-stanza');
        stanzaIndex += 1;
      } else {
        block.dataset.songStanza = String(stanzaIndex);
      }
    }
    setSongSaveMessage('');
  };

  const applyRichFormat = (command: 'bold' | 'italic' | 'underline' | 'foreColor', value?: string) => {
    const editor = slideEditorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    if (songSelectionRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(songSelectionRef.current);
    }
    editor.focus();
    if (command === 'foreColor') document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    handleSlideInput(editor.innerHTML, editor.innerText, editor);
    songSelectionRef.current = null;
  };

  const rememberSongSelection = () => {
    const editor = slideEditorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode)) return;
    const range = selection.getRangeAt(0);
    songSelectionRef.current = range.cloneRange();
    const prefix = document.createElement('div');
    const prefixRange = document.createRange();
    prefixRange.selectNodeContents(editor);
    prefixRange.setEnd(range.startContainer, range.startOffset);
    prefix.appendChild(prefixRange.cloneContents());
    const stanzaIndex = Array.from(prefix.querySelectorAll('div, p')).filter(block => !block.textContent?.trim()).length;
    setActiveSlide(Math.min(stanzaIndex, Math.max(0, songSlides.length - 1)));
  };

  const jumpToStanza = (index: number) => {
    setActiveSlide(index);
    const editor = slideEditorRef.current;
    const stanza = editor?.querySelector<HTMLElement>(`[data-song-stanza="${index}"]`);
    if (!editor || !stanza) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(stanza);
    range.collapse(true);
    editor.focus();
    selection?.removeAllRanges();
    selection?.addRange(range);
    songSelectionRef.current = range.cloneRange();
    stanza.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const addSongSlide = () => {
    setSongSlides(previous => [...previous, { ...DEFAULT_SONG_SLIDE }]);
    setActiveSlide(songSlides.length);
    setSongSaveMessage('');
  };

  const loadOnlineHymn = async (resource: OnlineResource) => {
    setOnlineResourceLoadingPath(resource.path);
    setOnlineResourcesError('');
    try {
      const html = await getRhemaResourceHtml('hymns', '', resource.path);
      const hymn = parseGetRhemaHymnLyrics(html);
      if (!hymn.lyrics) throw new Error('No verse text was found on the hymn page. Open the source page to review it.');
      setSongTitle(hymn.title || resource.title);
      setSongSourceUrl(`https://getrhema.net${resource.path}`);
      setSongSlides(legacySlides(hymn.lyrics));
      setSelectedSongId(null);
      setActiveSlide(0);
      setEditorSyncKey(key => key + 1);
      setSongSaveMessage('Hymn imported. Cross-check the lyrics and slides, then save.');
      setShowOnlineResources(false);
      setInnerTab('songs');
    } catch (error) {
      setOnlineResourcesError(error instanceof Error ? error.message : 'Could not load this hymn.');
    } finally {
      setOnlineResourceLoadingPath('');
    }
  };

  const openManualResource = (resource: OnlineResource) => {
    const url = `https://getrhema.net${resource.path}`;
    if (window.electronAPI?.openExternalUrl) window.electronAPI.openExternalUrl(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const presentSongSlide = (index: number) => {
    const title = songTitle.trim();
    const slide = songSlides[index];
    if (!title || !slide || !songHtmlToText(slide.html).trim() || !hasValidDisplay) return;
    projectSong(title, slide);
    setActiveSlide(index);
    setLiveSong({ title, slide: index });
  };

  const presentActiveSongSlide = () => presentSongSlide(activeSlide);

  const clearSongOutput = () => {
    clearProjection();
    setLiveSong(null);
  };

  useEffect(() => {
    if (innerTab !== 'songs') return;
    const handleSongKeys = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) return;
      if (event.key === 'ArrowLeft' && songSlides.length > 0) {
        event.preventDefault();
        setActiveSlide(index => Math.max(0, index - 1));
      } else if (event.key === 'ArrowRight' && songSlides.length > 0) {
        event.preventDefault();
        setActiveSlide(index => Math.min(songSlides.length - 1, index + 1));
      } else if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        event.preventDefault();
        const title = songTitle.trim();
        const slide = songSlides[activeSlide];
        if (title && slide && songHtmlToText(slide.html).trim() && hasValidDisplay) {
          projectSong(title, slide);
          setLiveSong({ title, slide: activeSlide });
        }
      } else if (event.key === 'Escape' && isProjecting) {
        event.preventDefault();
        clearProjection();
        setLiveSong(null);
      }
    };
    window.addEventListener('keydown', handleSongKeys);
    return () => window.removeEventListener('keydown', handleSongKeys);
  }, [innerTab, songSlides, activeSlide, songTitle, hasValidDisplay, isProjecting, projectSong, clearProjection]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-900 text-white">
      {innerTab === 'songs' && (
        <div className="flex min-h-10 items-center gap-2 border-b border-gray-700 bg-gray-900 px-2 py-1">
          <button type="button" onClick={() => setInnerTab('bible')} className="inline-flex min-h-8 items-center gap-1.5 rounded px-3 text-xs font-bold text-gray-400 hover:bg-gray-800 hover:text-white"><BookOpen size={14} /> Bible</button>
          <span className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded bg-gray-700 px-3 text-xs font-bold text-white"><Music size={14} /> Songs</span>
          <select value={hasValidDisplay ? selectedDisplay ?? '' : ''} onChange={event => onDisplayChange(Number(event.target.value))} aria-label="Projection display" className="min-h-8 max-w-40 rounded border border-gray-700 bg-gray-900 px-2 text-[10px] font-bold text-gray-200">
            <option value="" disabled>{externalDisplays.length ? 'Choose screen' : window.electronAPI?.getDisplays ? 'No external screen' : 'Desktop app required'}</option>
            {externalDisplays.map(display => <option key={display.id} value={display.id}>{display.label}</option>)}
          </select>
          <button type="button" onClick={onRefreshDisplays} title="Refresh displays" aria-label="Refresh displays" className="inline-flex h-8 w-8 items-center justify-center rounded bg-gray-800 text-gray-300 hover:bg-gray-700"><RefreshCw size={14} /></button>
          {testDisplay && <button type="button" onClick={testDisplay} disabled={!hasValidDisplay} title="Test selected display" aria-label="Test selected display" className="inline-flex h-8 items-center gap-1 rounded bg-gray-800 px-2 text-[10px] font-semibold text-gray-300 hover:bg-gray-700 disabled:opacity-40"><Play size={12} /> Test</button>}
        </div>
      )}

      {/* Bible Tab Content */}
      {innerTab === 'bible' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-gray-700 bg-gray-900 px-2 py-1" aria-label="Bible tools">
            {([
              ['browse', BookOpen, 'Bible'],
              ['search', Search, 'Search'],
              ['history', History, `History${bibleHistory.length ? ` · ${bibleHistory.length}` : ''}`],
            ] as const).map(([tool, Icon, label]) => (
              <button key={tool} type="button" onClick={() => setBibleTool(tool)} aria-pressed={bibleTool === tool} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-bold transition-colors ${bibleTool === tool ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
            <button type="button" onClick={() => setShowBibleSettings(true)} title="Bible projection settings" aria-label="Bible projection settings" className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded bg-gray-800 px-2.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"><Settings2 size={14} /> Settings</button>
            <button type="button" onClick={() => setInnerTab('songs')} className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-bold text-gray-400 hover:bg-gray-800 hover:text-white"><Music size={14} /> Songs</button>
            <span className="ml-auto hidden items-center gap-1 whitespace-nowrap px-2 text-[10px] text-gray-500 xl:inline-flex"><Keyboard size={12} /> Type to jump</span>
            <select value={hasValidDisplay ? selectedDisplay ?? '' : ''} onChange={event => onDisplayChange(Number(event.target.value))} aria-label="Projection display" className="min-h-8 max-w-36 shrink-0 rounded border border-gray-700 bg-gray-900 px-2 text-[10px] font-bold text-gray-200">
              <option value="" disabled>{externalDisplays.length ? 'Choose screen' : window.electronAPI?.getDisplays ? 'No external screen' : 'Desktop app required'}</option>
              {externalDisplays.map(display => <option key={display.id} value={display.id}>{display.label}</option>)}
            </select>
            <button type="button" onClick={onRefreshDisplays} disabled={!window.electronAPI?.getDisplays} title="Refresh display list" aria-label="Refresh display list" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"><RefreshCw size={13} /></button>
            {testDisplay && <button type="button" onClick={testDisplay} disabled={selectedDisplay === null || !window.electronAPI?.testDisplay} title="Test selected display" aria-label="Test selected display" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"><Play size={13} /></button>}
            <span className="shrink-0 px-1 text-[10px] font-bold text-gray-400">KJV</span>
          </nav>

          {quickLookupOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) { setQuickLookupOpen(false); setQuickLookupStage('book'); setQuickLookupQuery(''); } }}>
              <section role="dialog" aria-modal="true" aria-label="Quick Bible passage lookup" className="relative w-full max-w-2xl overflow-hidden border border-slate-600 bg-slate-950 text-center text-slate-100 shadow-2xl shadow-black/60">
                <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-5 py-3">
                  <div className="flex items-center gap-2 text-left">
                    <BookOpen size={16} className="text-cyan-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Quick Bible lookup</span>
                  </div>
                  <button type="button" onClick={() => { setQuickLookupOpen(false); setQuickLookupStage('book'); setQuickLookupQuery(''); }} className="text-xs text-slate-400 hover:text-white">Esc to cancel</button>
                </header>
                <div className="grid grid-cols-3 divide-x divide-slate-800">
                  <section aria-label="Book selection" className={`min-w-0 px-3 py-5 sm:px-5 ${quickLookupStage === 'book' ? 'bg-slate-800/70' : ''}`}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Book</p>
                    <h2 className={`min-h-8 break-words text-xl font-semibold sm:text-2xl ${quickLookupStage === 'book' ? 'text-cyan-200' : 'text-white'}`}>{quickLookupBook?.name || (quickLookupStage === 'book' ? quickLookupQuery : '')}</h2>
                    {quickLookupStage === 'book' && (
                      quickBookMatches.length > 0
                        ? <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                            {quickBookMatches.map(book => <button key={book.id} type="button" onClick={() => chooseQuickBook(book)} className={`rounded border px-2 py-1 text-[11px] transition-colors ${quickLookupBook?.id === book.id ? 'border-cyan-400 bg-cyan-400/15 text-cyan-100' : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800'}`}>{book.name}{bookAbbreviation[book.name] ? ` (${bookAbbreviation[book.name]})` : ''}</button>)}
                          </div>
                        : quickLookupQuery && <p className="mt-3 text-xs text-rose-300">No books found</p>
                    )}
                  </section>
                  <section aria-label="Chapter selection" className={`min-w-0 px-3 py-5 sm:px-5 ${quickLookupStage === 'chapter' ? 'bg-slate-800/70' : ''}`}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Chapter</p>
                    <h2 className={`min-h-8 text-xl font-semibold sm:text-2xl ${quickLookupStage === 'chapter' ? 'text-cyan-200' : 'text-white'}`}>{quickLookupStage === 'chapter' ? quickLookupQuery : selectedChapter || ''}</h2>
                    {quickLookupBook && <p className="mt-1 text-xs text-slate-400">Chapters: {chapters.length}</p>}
                    {quickLookupStage === 'chapter' && quickLookupQuery && quickLookupChapterCandidates.length > 0 && <div className="mt-3 flex flex-wrap justify-center gap-1">{quickLookupChapterCandidates.slice(0, 20).map(chapter => <button key={chapter} type="button" onClick={() => chooseQuickChapter(chapter)} className={`min-w-7 rounded px-1.5 py-1 text-xs ${selectedChapter === chapter ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-700'}`}>{chapter}</button>)}</div>}
                    {quickLookupStage === 'chapter' && quickLookupQuery && quickLookupChapterCandidates.length === 0 && <p className="mt-3 text-xs text-rose-300">No chapters found</p>}
                  </section>
                  <section aria-label="Verse selection" className={`min-w-0 px-3 py-5 sm:px-5 ${quickLookupStage === 'verse' ? 'bg-slate-800/70' : ''}`}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Verse</p>
                    <h2 className={`min-h-8 text-xl font-semibold sm:text-2xl ${quickLookupStage === 'verse' ? 'text-cyan-200' : 'text-white'}`}>{quickLookupStage === 'verse' ? quickLookupQuery : ''}</h2>
                    {selectedChapter && <p className="mt-1 text-xs text-slate-400">Verses: {chapterVerses.length}</p>}
                    {quickLookupStage === 'verse' && quickLookupQuery && quickLookupVerseCandidates.length > 0 && <div className="mt-3 flex flex-wrap justify-center gap-1">{quickLookupVerseCandidates.slice(0, 20).map(verse => <button key={verse.verse} type="button" onClick={() => quickLookupActionsRef.current.chooseQuickVerse(verse.verse)} className={`min-w-7 rounded px-1.5 py-1 text-xs ${selectedVerseNumbers.includes(verse.verse) ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-700'}`}>{verse.verse}</button>)}</div>}
                    {quickLookupStage === 'verse' && quickLookupQuery && quickLookupVerseCandidates.length === 0 && !quickLookupQuery.startsWith('0') && <p className="mt-3 text-xs text-rose-300">No verses found</p>}
                  </section>
                </div>
                <footer className="flex items-center justify-between border-t border-slate-800 bg-slate-900/80 px-5 py-3 text-[10px] text-slate-500">
                  <span>{quickLookupStage === 'book' ? 'Type book name or abbreviation' : quickLookupStage === 'chapter' ? 'Enter or Tab to choose chapter' : 'Enter to show selected verse'}</span>
                  <span className="font-mono text-slate-400">↑ ↓ Select · Enter Continue</span>
                </footer>
              </section>
            </div>
          )}

          {showBibleSettings && (
            <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget) setShowBibleSettings(false); }}>
              <ProjectionSettingsPanel settings={projectionSettings} onChange={updateProjectionSettings} onClose={() => setShowBibleSettings(false)} />
            </div>
          )}

          {showDisplayPicker && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
              <section role="dialog" aria-modal="true" aria-labelledby="bible-display-picker-title" className="w-full max-w-md border border-gray-700 bg-gray-900 p-5 text-white shadow-2xl">
                <h2 id="bible-display-picker-title" className="text-lg font-bold">Choose Bible projection screen</h2>
                <p className="mt-2 text-sm text-gray-300">Send passages to a secondary display, or continue in practice mode and preview them on this screen.</p>
                {externalDisplays.length ? (
                  <div className="mt-4 grid gap-2">{externalDisplays.map(display => <button key={display.id} type="button" onClick={() => { setPracticeMode(false); onDisplayChange(display.id); setShowDisplayPicker(false); }} className="min-h-12 rounded border border-gray-700 bg-gray-800 px-3 text-left text-sm font-semibold hover:border-blue-500 hover:bg-gray-700">{display.label}</button>)}</div>
                ) : <p role="status" className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">No secondary screen detected. You can still explore and practice without connecting one.</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={onRefreshDisplays} className="min-h-10 flex-1 rounded bg-blue-600 px-3 text-sm font-bold hover:bg-blue-500"><RefreshCw className="mr-2 inline" size={14} />Refresh screens</button>
                  <button type="button" onClick={() => { setPracticeMode(true); setShowDisplayPicker(false); }} className="min-h-10 flex-1 rounded bg-emerald-700 px-3 text-sm font-bold hover:bg-emerald-600">Continue</button>
                  {hasValidDisplay && <button type="button" onClick={() => setShowDisplayPicker(false)} className="min-h-10 rounded border border-gray-700 px-4 text-sm font-semibold text-gray-300 hover:bg-gray-800">Close</button>}
                </div>
              </section>
            </div>
          )}

          {bibleTool === 'search' ? (
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Search Bible text">
              <form onSubmit={searchBible} className="grid shrink-0 gap-2 border-b border-gray-700 bg-gray-800/50 p-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto_auto]">
                <input ref={searchTextRef} type="search" value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Search words or an exact phrase" aria-label="Search Bible text" className="min-h-11 rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-blue-500" />
                <select value={searchMode} onChange={event => setSearchMode(event.target.value as 'exact' | 'all' | 'any')} aria-label="Search matching mode" className="min-h-11 rounded-lg border border-gray-700 bg-gray-900 px-3 text-xs font-semibold text-white">
                  <option value="exact">Exact phrase</option><option value="all">All words</option><option value="any">Any word</option>
                </select>
                <select value={searchTestament} onChange={event => setSearchTestament(event.target.value as 'all' | 'old' | 'new')} aria-label="Filter testament" className="min-h-11 rounded-lg border border-gray-700 bg-gray-900 px-3 text-xs font-semibold text-white">
                  <option value="all">Whole Bible</option><option value="old">Old Testament</option><option value="new">New Testament</option>
                </select>
                <select value={searchBookId} onChange={event => setSearchBookId(event.target.value)} aria-label="Filter book" className="min-h-11 rounded-lg border border-gray-700 bg-gray-900 px-3 text-xs font-semibold text-white">
                  <option value="all">All books</option>{books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}
                </select>
                <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-500 sm:col-span-4 sm:justify-self-end"><Search size={15} /> Search verses</button>
              </form>
              {searchMessage && <p role="status" className="shrink-0 border-b border-gray-700 px-3 py-2 text-xs text-gray-400">{searchMessage}</p>}
              <div className="min-h-0 flex-1 divide-y divide-gray-800 overflow-y-auto">
                {searchResults.map(verse => (
                  <button key={`${verse.book}-${verse.chapter}-${verse.verse}`} type="button" onClick={() => navigateToVerses([verse])} onDoubleClick={() => { navigateToVerses([verse]); presentVerses([verse]); }} className="w-full px-4 py-3 text-left hover:bg-gray-800/70">
                    <span className="mr-2 text-xs font-black text-blue-400">{verse.book_name} {verse.chapter}:{verse.verse}</span><span className="font-serif text-sm leading-relaxed text-gray-200">{verse.text}</span>
                  </button>
                ))}
                {searchResults.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Search across the KJV Bible. Double-click a result to show it.</p>}
              </div>
            </section>
          ) : bibleTool === 'history' ? (
            <section className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Bible presentation history">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-white">Presented this session</h2>
                {bibleHistory.length > 0 && <button type="button" onClick={() => setBibleHistory([])} className="rounded px-2 py-1 text-xs font-semibold text-gray-400 hover:bg-gray-800">Clear all</button>}
              </div>
              <div className="space-y-1.5">
                {bibleHistory.map(reference => (
                  <div key={reference.id} className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 p-2">
                    <button type="button" onClick={() => navigateToVerses(reference.verses)} onDoubleClick={() => { navigateToVerses(reference.verses); presentVerses(reference.verses); }} className="min-h-11 min-w-0 flex-1 px-2 text-left">
                      <span className="block text-sm font-bold text-white">{reference.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-gray-400">{reference.verses.map(verse => verse.text).join(' ')}</span>
                    </button>
                    <button type="button" onClick={() => presentVerses(reference.verses)} title={`Show ${reference.label}`} aria-label={`Show ${reference.label}`} className="rounded-lg bg-green-700 p-2.5 text-white hover:bg-green-600"><Play size={15} /></button>
                  </div>
                ))}
              </div>
              {bibleHistory.length === 0 && <p className="rounded-lg border border-dashed border-gray-700 px-4 py-8 text-center text-sm text-gray-500">Presented Bible passages will appear here for this session.</p>}
            </section>
          ) : (
          <>
              <div className={`hidden min-h-0 flex-1 grid-cols-[minmax(190px,0.22fr)_minmax(0,0.78fr)] grid-rows-[minmax(0,1.2fr)_minmax(0,0.8fr)] overflow-hidden ${bibleTool === 'browse' ? 'md:grid' : 'md:hidden'}`}>
                <section className="col-start-1 row-span-2 flex min-h-0 flex-col border-r border-gray-700 bg-gray-900/80" aria-label="Selected chapter verses">
                  <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-2 py-2">
                    <h3 className="truncate text-sm font-bold text-white">{selectedBookName} {selectedChapter}</h3>
                    <span className="shrink-0 text-xs text-gray-400">{chapterVerses.length}</span>
                  </div>
                  <div ref={verseReaderRef} className="min-h-0 flex-1 overflow-y-auto divide-y divide-gray-800 custom-scrollbar">
                    {chapterVerses.map(verse => {
                      const selected = selectedVerseNumbers.includes(verse.verse);
                      const onScreen = projectionActive && presentedVerses.some(item => item.book === verse.book && item.chapter === verse.chapter && item.verse === verse.verse);
                      return <button key={verse.verse} type="button" data-projected-verse={onScreen ? 'true' : undefined} onClick={() => toggleVerseSelection(verse.verse)} onDoubleClick={() => presentVerses([verse])} aria-pressed={selected} className={`w-full px-3 py-2.5 text-left text-sm leading-relaxed ${onScreen ? 'bg-emerald-800/70 text-white ring-1 ring-inset ring-emerald-400' : selected ? 'bg-blue-950/60 text-white' : 'text-gray-300 hover:bg-gray-800'}`}><span className={`mr-1.5 font-black ${onScreen ? 'text-emerald-200' : 'text-blue-400'}`}>{verse.verse}</span>{verse.text}</button>;
                    })}
                  </div>
                </section>

                <section className="col-start-2 row-start-1 flex min-h-0 flex-col overflow-hidden border-b border-gray-700 bg-gray-900/70" aria-label="Bible books">
                  <div className="flex min-h-8 items-center gap-2 border-b border-gray-800 px-2">
                    <h3 className="shrink-0 text-xs font-black uppercase tracking-widest text-gray-300">Books</h3>
                    <input type="search" value={bookFilter} onChange={event => setBookFilter(event.target.value)} aria-label="Filter Bible books" placeholder="Filter books" className="min-h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-white outline-none placeholder:text-gray-400 focus:ring-0" />
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden p-1.5">
                    <div className="grid h-full grid-cols-11 grid-rows-6 gap-px">
                      {books.filter(book => book.name.toLowerCase().includes(bookFilter.trim().toLowerCase())).map(book => {
                        const selected = selectedBookId === book.id;
                        const color = bookSectionColor.get(book.name) || 'bg-gray-700';
                        return (
                          <button key={book.id} type="button" onClick={() => { setSelectedBookId(book.id); setSelectedBookName(book.name); }} aria-pressed={selected} title={book.name} className={`flex h-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden border border-white/10 px-0.5 text-center text-white transition-colors ${color} ${selected ? 'z-10 ring-2 ring-white' : 'opacity-85 hover:opacity-100'}`}>
                            <span className="text-base font-semibold leading-none">{bookAbbreviation[book.name] || book.name.slice(0, 3)}</span>
                            <span className="mt-1 w-full truncate text-[10px] leading-none">{book.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {books.filter(book => book.name.toLowerCase().includes(bookFilter.trim().toLowerCase())).length === 0 && <p className="p-4 text-center text-xs text-gray-500">No books match that filter.</p>}
                  </div>
                </section>

                <div className="col-start-2 row-start-2 grid min-h-0 grid-cols-2 overflow-hidden">
                <section className="flex min-h-0 flex-col overflow-hidden border-r border-gray-700 bg-gray-900/60" aria-label="Bible chapters">
                  <h3 className="border-b border-gray-800 px-2 py-2 text-xs font-black uppercase tracking-widest text-gray-300">Chapters · {chapters.length}</h3>
                  <div className="min-h-0 flex-1 overflow-hidden p-2">
                    <div className="grid h-full gap-1" style={{ gridTemplateColumns: `repeat(${numberGridColumns(chapters.length)}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}>
                      {chapters.map(chapter => <button key={chapter} type="button" onClick={() => setSelectedChapter(chapter)} aria-pressed={selectedChapter === chapter} className={`h-full min-h-0 rounded text-sm font-bold ${selectedChapter === chapter ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}>{chapter}</button>)}
                    </div>
                  </div>
                </section>

                <section className="flex min-h-0 flex-col overflow-hidden bg-gray-900" aria-label="Bible verse numbers">
                  <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-2 py-2">
                    <h3 className="truncate text-xs font-black uppercase tracking-widest text-gray-300">Verses · {chapterVerses.length}</h3>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden p-2">
                    <div className="grid h-full gap-1" style={{ gridTemplateColumns: `repeat(${numberGridColumns(chapterVerses.length)}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}>
                      {chapterVerses.map(verse => {
                        const selected = selectedVerseNumbers.includes(verse.verse);
                        const onScreen = projectionActive && presentedVerses.some(item => item.book === verse.book && item.chapter === verse.chapter && item.verse === verse.verse);
                        return <button key={verse.verse} type="button" data-projected-verse={onScreen ? 'true' : undefined} onClick={() => toggleVerseSelection(verse.verse)} onDoubleClick={() => presentVerses([verse])} aria-pressed={selected} aria-label={`Verse ${verse.verse}`} className={`h-full min-h-0 rounded text-sm font-bold ${onScreen ? 'bg-emerald-700 text-white ring-1 ring-emerald-300' : selected ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}>{verse.verse}</button>;
                      })}
                    </div>
                  </div>
                </section>
                </div>
              </div>

          <nav className={`grid grid-cols-3 gap-1 border-b border-gray-700 bg-gray-900 p-2 md:hidden ${bibleTool === 'browse' ? '' : 'hidden'}`} aria-label="Bible navigation">
            {([
              ['books', 'Books', selectedBookName || 'Browse'],
              ['chapters', 'Chapters', selectedChapter ? `${chapters.length} available` : 'Choose a book'],
              ['verses', 'Verses', `${selectedVerseNumbers.length} selected`],
            ] as const).map(([pane, label, detail]) => (
              <button
                key={pane}
                type="button"
                onClick={() => setMobileBiblePane(pane)}
                disabled={pane !== 'books' && selectedBookId === null || pane === 'verses' && selectedChapter === null}
                aria-current={mobileBiblePane === pane ? 'step' : undefined}
                className={`min-h-14 rounded-lg px-2 py-1 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${mobileBiblePane === pane ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
              >
                <span className="block text-xs font-bold">{label}</span>
                <span className={`mt-0.5 block truncate text-[10px] ${mobileBiblePane === pane ? 'text-blue-100' : 'text-gray-500'}`}>{detail}</span>
              </button>
            ))}
          </nav>

          {/* Mobile Bible browser */}
          <div className="grid grid-cols-1 md:hidden flex-1 min-h-0 overflow-hidden">
            {/* Column 1: Books (3 cols) */}
            <div className={`${mobileBiblePane === 'books' ? 'flex' : 'hidden'} md:col-span-3 md:flex flex-col border-r border-gray-700 bg-gray-900/90 min-h-0`}>
              <div className="p-3 border-b border-gray-800">
                <input
                  type="text"
                  value={bookFilter}
                  onChange={e => setBookFilter(e.target.value)}
                  placeholder="Filter books..."
                  aria-label="Filter Bible books"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-sm font-semibold text-white outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {filteredBooks.map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBookId(b.id);
                      setSelectedBookName(b.name);
                      setMobileBiblePane('chapters');
                    }}
                    className={`w-full min-h-11 flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      selectedBookId === b.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span className="truncate">{b.name}</span>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getBookColor(b.id)}`} />
                      <ChevronRight className="h-4 w-4 text-gray-500 md:hidden" />
                    </span>
                  </button>
                ))}
                {filteredBooks.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-500">No books match that search.</p>}
              </div>
            </div>

            {/* Column 2: Chapters (2 cols) */}
            <div className={`${mobileBiblePane === 'chapters' ? 'flex' : 'hidden'} md:col-span-2 md:flex flex-col border-r border-gray-700 bg-gray-900/60 min-h-0`}>
              <div className="flex items-center justify-between gap-2 border-b border-gray-800 p-3 text-xs font-black uppercase tracking-widest text-gray-400">
                Chapters ({chapters.length})
                <button type="button" onClick={() => setMobileBiblePane('books')} className="rounded px-2 py-1 text-[10px] font-bold text-blue-300 hover:bg-gray-800 md:hidden">Change book</button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 grid grid-cols-4 md:grid-cols-3 content-start gap-1.5 custom-scrollbar">
                {chapters.map(ch => (
                  <button
                    key={ch}
                    onClick={() => { setSelectedChapter(ch); setMobileBiblePane('verses'); }}
                    className={`h-11 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${
                      selectedChapter === ch ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Column 3: Verses & Live Preview (7 cols) */}
            <div className={`${mobileBiblePane === 'verses' ? 'flex' : 'hidden'} md:col-span-7 md:flex flex-col min-h-0 bg-gray-900`}>
              <div className="flex items-center justify-between gap-2 border-b border-gray-800 p-3">
                <div className="text-xs font-bold text-white">
                  {selectedBookName} {selectedChapter} <span className="text-gray-400 font-normal">({chapterVerses.length} verses)</span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => setSelectedVerseNumbers([])}
                    className="min-h-9 rounded bg-gray-800 px-2.5 py-1 text-[11px] font-bold text-gray-400 hover:bg-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {chapterVerses.map(v => {
                  const isSelected = selectedVerseNumbers.includes(v.verse);
                  return (
                    <button
                      key={v.verse}
                      onClick={() => toggleVerseSelection(v.verse)}
                      type="button"
                      aria-pressed={isSelected}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        isSelected ? 'bg-blue-900/40 border-blue-500 shadow-md' : 'bg-gray-800/60 border-gray-700/60 hover:bg-gray-800'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border mt-0.5 shrink-0 ${
                        isSelected ? 'bg-blue-600 border-blue-400 text-white' : 'border-gray-600 bg-gray-900'
                      }`}>
                        {isSelected && <Check size={12} />}
                      </div>
                      <div>
                        <span className="text-xs font-black text-blue-400 mr-2">{v.verse}</span>
                        <span className="text-sm text-gray-200 leading-relaxed font-serif">{v.text}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          </>
          )}

        </div>
      )}

      {/* Songs Tab Content */}
      {innerTab === 'songs' && (
        <div className="flex-1 min-h-0 overflow-hidden bg-gray-950">
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1">
            <aside className="flex min-h-0 flex-col border-b border-gray-700 bg-gray-900 p-3 lg:border-b-0 lg:border-r" aria-label="Song resources">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Song resources</h2>
                  <p className="mt-0.5 text-[11px] text-gray-500">{savedSongs.length} songs</p>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => { setOnlineResourceType('hymns'); setOnlineResourceSearch(''); setOnlineResourcesError(''); setSelectedManualResource(null); setShowOnlineResources(true); }} title="Browse online hymns and manuals" aria-label="Online resources" className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-700 px-2 text-[10px] font-semibold text-gray-200 hover:bg-gray-800"><Globe size={14} /> Online</button>
                  <button type="button" onClick={startNewSong} title="New song" aria-label="New song" className="inline-flex h-9 w-9 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-500"><Plus size={16} /></button>
                </div>
              </div>
              <label className="relative mb-2 block shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <input type="search" value={songSearch} onChange={event => setSongSearch(event.target.value)} placeholder="Search title or lyrics" aria-label="Search songs" className="h-9 w-full rounded border border-gray-700 bg-gray-950 pl-8 pr-2 text-xs text-white outline-none focus:border-cyan-500" />
              </label>
              <div className="flex min-h-0 gap-1 overflow-x-auto lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto">
                {filteredSongs.map(song => {
                  const slideCount = song.lyrics.split(/\n\s*\n/).map(slide => slide.trim()).filter(Boolean).length;
                  return (
                    <div key={song.id} className={`group flex min-w-44 shrink-0 items-center border-l-2 ${selectedSongId === song.id ? 'border-cyan-400 bg-gray-800' : 'border-transparent hover:bg-gray-800/70'}`}>
                      <button type="button" onClick={() => openSong(song)} aria-pressed={selectedSongId === song.id} className="min-h-14 min-w-0 flex-1 px-3 py-2 text-left">
                        <span className="block truncate text-xs font-semibold text-gray-100">{song.title}</span>
                        <span className="mt-1 block truncate text-[10px] text-gray-500">{song.lyrics.split(/\s+/).slice(0, 9).join(' ') || 'No lyrics'} · {slideCount} slides</span>
                      </button>
                      <button type="button" onClick={() => deleteSong(song)} title={`Delete ${song.title}`} aria-label={`Delete ${song.title}`} className="mr-1 rounded p-1.5 text-gray-500 opacity-60 hover:bg-red-950 hover:text-red-300 group-hover:opacity-100"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
                {filteredSongs.length === 0 && <div className="px-2 py-5 text-xs text-gray-500">{savedSongs.length ? 'No songs match this search.' : 'Your library is empty.'}</div>}
              </div>
            </aside>

            <main className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
              <header className="flex min-h-12 flex-wrap items-center gap-2 border-b border-gray-800 bg-gray-900 px-3 py-2">
                <input value={songTitle} onChange={event => { setSongTitle(event.target.value); setSongSaveMessage(''); }} placeholder="Untitled song" aria-label="Song title" className="h-9 min-w-36 flex-1 border-b border-gray-700 bg-transparent px-1 text-sm font-bold text-white outline-none placeholder:text-gray-500 focus:border-cyan-400 sm:max-w-sm" />
                <span className="hidden text-[11px] text-gray-500 sm:inline">{songSlides.length} slides</span>
                {songSourceUrl && <button type="button" onClick={() => { if (window.electronAPI?.openExternalUrl) window.electronAPI.openExternalUrl(songSourceUrl); else window.open(songSourceUrl, '_blank', 'noopener,noreferrer'); }} title="Open song source" aria-label="Open song source" className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-800 hover:text-white"><ExternalLink size={14} /></button>}
                <button type="button" onClick={saveSong} className="inline-flex h-9 items-center gap-1.5 rounded bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-500"><Save size={14} /> Save</button>
                {songSaveMessage && <span role="status" className="basis-full text-[11px] text-emerald-300 sm:basis-auto">{songSaveMessage}</span>}
              </header>

              <div className="grid min-h-0 grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)] overflow-hidden">
                <section className="flex min-h-0 flex-col border-r border-gray-800" aria-label="Full song lyrics editor">
                  <div className="flex shrink-0 items-center justify-between border-b border-gray-800 px-3 py-2"><div><h3 className="text-xs font-bold text-white">Lyrics</h3><p className="mt-0.5 text-[10px] text-gray-500">Blank lines divide slides · {songSlides.length} total</p></div><div className="flex items-center gap-1"><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => applyRichFormat('bold')} title="Bold selected text" aria-label="Bold selected text" className="h-7 w-8 rounded bg-gray-800 text-sm font-black text-white hover:bg-gray-700">B</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => applyRichFormat('italic')} title="Italic selected text" aria-label="Italic selected text" className="h-7 w-8 rounded bg-gray-800 text-sm italic text-white hover:bg-gray-700">I</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => applyRichFormat('underline')} title="Underline selected text" aria-label="Underline selected text" className="h-7 w-8 rounded bg-gray-800 text-sm text-white underline hover:bg-gray-700">U</button><label className="flex h-7 items-center gap-1 rounded bg-gray-800 px-1.5 text-[10px] text-gray-300"><span>A</span><input type="color" defaultValue="#ffffff" onChange={event => applyRichFormat('foreColor', event.target.value)} aria-label="Color selected text" className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" /></label></div></div>
                  <ProjectionSurface settings={projectionSettings} songText={songDocumentHtml} songStyle={currentSongSlide} editableSong songEditorRef={slideEditorRef} songEditorSyncKey={`${selectedSongId || 'draft'}:${editorSyncKey}`} songPlaceholder="Type or paste the whole song here. Leave a blank line between stanzas to create slides." onSongHtmlChange={handleSlideInput} onSongSelectionChange={rememberSongSelection} className="song-document-surface online-resource-scrollbar h-full w-full min-h-0 flex-1" />
                </section>

                <section className="flex min-h-0 flex-col bg-gray-950" aria-label="All song slide previews">
                  <div className="flex shrink-0 items-center justify-between border-b border-gray-800 px-3 py-2"><div><h3 className="text-xs font-bold text-white">Slide previews</h3><p className="mt-0.5 text-[10px] text-gray-500">Select any preview to jump to that stanza</p></div><div className="flex items-center gap-2"><span className="text-[10px] text-gray-500">{songSlides.length} total</span><button type="button" onClick={addSongSlide} title="Add empty slide" aria-label="Add empty slide" className="inline-flex h-7 w-7 items-center justify-center rounded bg-gray-800 text-gray-200 hover:bg-gray-700"><Plus size={14} /></button></div></div>
                  <div className="online-resource-scrollbar grid min-h-0 flex-1 auto-rows-[minmax(8rem,1fr)] grid-cols-2 gap-2 overflow-y-auto p-2 xl:grid-cols-3" role="list" aria-label="Slides">
                    {songSlides.map((slide, index) => <div key={index} className={`group relative flex min-h-0 flex-col overflow-hidden border ${activeSlide === index ? 'border-cyan-400 ring-1 ring-cyan-400/50' : 'border-gray-700 hover:border-gray-500'}`}>
                      <button type="button" onClick={() => jumpToStanza(index)} aria-label={`Select slide ${index + 1}`} aria-pressed={activeSlide === index} className="flex min-h-0 flex-1 flex-col text-left"><div className="min-h-0 flex-1 overflow-hidden"><ProjectionSurface settings={projectionSettings} songText={slide.html || 'Empty slide'} songStyle={slide} className="h-full w-full" /></div><span className="flex h-6 shrink-0 items-center justify-between bg-gray-900 px-2 text-[10px] text-gray-300"><span>Slide {String(index + 1).padStart(2, '0')}</span>{liveSong?.title === songTitle && liveSong.slide === index && isProjecting && <span className="font-bold text-emerald-300">LIVE</span>}</span></button>
                      <button type="button" onClick={() => presentSongSlide(index)} disabled={!hasValidDisplay || !songTitle.trim() || !songHtmlToText(slide.html).trim()} title={`Present slide ${index + 1}`} aria-label={`Present slide ${index + 1}`} className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded bg-emerald-700 text-white opacity-0 shadow transition-opacity hover:bg-emerald-600 focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"><Play size={13} /></button>
                    </div>)}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-900 px-3 py-2"><span className="mr-auto text-[10px] font-bold uppercase text-gray-500">{isProjecting && liveSong ? `LIVE · ${liveSong.title} · ${liveSong.slide + 1}` : hasValidDisplay ? 'Output ready' : 'Connect a display'}</span><span className="text-[10px] text-gray-500">Slide {activeSlide + 1} style</span><button type="button" onClick={() => updateSongSlide(activeSlide,{bold:!currentSongSlide.bold})} aria-label="Toggle slide bold" aria-pressed={currentSongSlide.bold} className={`h-8 w-8 rounded text-sm font-black ${currentSongSlide.bold?'bg-cyan-800 text-white':'bg-gray-800 text-gray-300'}`}>B</button><button type="button" onClick={() => updateSongSlide(activeSlide,{italic:!currentSongSlide.italic})} aria-label="Toggle slide italic" aria-pressed={currentSongSlide.italic} className={`h-8 w-8 rounded text-sm italic ${currentSongSlide.italic?'bg-cyan-800 text-white':'bg-gray-800 text-gray-300'}`}>I</button><label className="flex h-8 items-center gap-1 text-[10px] text-gray-400"><span>Color</span><input type="color" value={currentSongSlide.color} onChange={event=>updateSongSlide(activeSlide,{color:event.target.value})} aria-label="Slide text color" className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" /></label><select value={currentSongSlide.fontFamily} onChange={event => updateSongSlide(activeSlide, { fontFamily: event.target.value })} aria-label="Slide font" className="h-8 max-w-36 rounded border border-gray-700 bg-gray-950 px-2 text-[10px] text-gray-200">{SONG_FONTS.map(font => <option key={font} value={font}>{font}</option>)}</select><select value={currentSongSlide.fontSize} onChange={event => updateSongSlide(activeSlide, { fontSize: Number(event.target.value) })} aria-label="Slide font size" className="h-8 w-16 rounded border border-gray-700 bg-gray-950 px-1 text-[10px] text-gray-200">{[24,28,32,36,40,44,48,52,56,60,64].map(size => <option key={size} value={size}>{size}px</option>)}</select><label className="flex h-8 items-center gap-1 text-[10px] text-gray-400"><input type="checkbox" checked={currentSongSlide.useGlobalStyle} onChange={event => updateSongSlide(activeSlide,{useGlobalStyle:event.target.checked})} className="accent-cyan-500" /> Global output</label><button type="button" onClick={presentActiveSongSlide} disabled={!hasValidDisplay || !songTitle.trim() || !songHtmlToText(currentSongSlide.html).trim()} className="inline-flex h-8 items-center gap-1.5 rounded bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-40"><Play size={13} /> Present selected</button><button type="button" onClick={clearSongOutput} disabled={!isProjecting} className="inline-flex h-8 items-center gap-1 rounded border border-gray-700 px-2 text-xs font-bold text-gray-200 hover:bg-gray-800 disabled:opacity-40"><X size={13} /> Clear</button></div>
                </section>
              </div>
            </main>
          </div>

          {showOnlineResources && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="online-resources-title">
            <section className="grid max-h-[92vh] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-gray-700 bg-gray-950 shadow-2xl">
              <header className="flex items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-3">
                <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded bg-cyan-950 text-cyan-300"><Globe size={18} /></span><div><h2 id="online-resources-title" className="text-sm font-bold text-white">Online resources</h2><p className="mt-0.5 text-[10px] text-gray-500">getRhema catalog · internet required</p></div></div>
                <button type="button" onClick={() => setShowOnlineResources(false)} title="Close online resources" aria-label="Close online resources" className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-400 hover:bg-gray-800 hover:text-white"><X size={17} /></button>
              </header>
              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[13rem_minmax(0,1fr)] md:grid-rows-1">
                <aside className="flex flex-col gap-3 border-b border-gray-800 bg-gray-900 p-3 md:border-b-0 md:border-r" aria-label="Resource types">
                  <div className="flex gap-2 overflow-x-auto md:flex-col">
                    <button type="button" onClick={() => { setOnlineResourceType('hymns'); setOnlineResourceSearch(''); setSelectedManualResource(null); }} aria-pressed={onlineResourceType === 'hymns'} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded px-3 text-left text-xs font-bold ${onlineResourceType === 'hymns' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}><Music size={15} /> RCCG Hymn</button>
                    <button type="button" onClick={() => { setOnlineResourceType('manuals'); setOnlineResourceSearch(''); setSelectedManualResource(null); }} aria-pressed={onlineResourceType === 'manuals'} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded px-3 text-left text-xs font-bold ${onlineResourceType === 'manuals' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}><BookOpen size={15} /> Sunday School Manual</button>
                  </div>
                  <div className="hidden flex-1 md:block" />
                  {onlineResourceType === 'hymns' ? <p className="border-t border-gray-800 pt-3 text-[10px] leading-relaxed text-gray-500">Imported lyrics open in the preview for review before saving.</p> : <p className="border-t border-gray-800 pt-3 text-[10px] leading-relaxed text-gray-500">Manuals and lesson materials open on getRhema for review.</p>}
                </aside>

                <div className="flex min-h-0 flex-col p-3 sm:p-4">
                  <label className="relative block shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                    <input type="search" value={onlineResourceSearch} onChange={event => setOnlineResourceSearch(event.target.value)} placeholder={onlineResourceType === 'hymns' ? 'Search hymn number or title' : 'Search manual or lesson'} aria-label={onlineResourceType === 'hymns' ? 'Search RCCG hymns' : 'Search Sunday School manuals'} className="h-10 w-full rounded border border-gray-700 bg-gray-900 pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-cyan-500" />
                  </label>
                  <div className={`mt-2 flex shrink-0 items-center gap-2 border px-3 py-2 text-[10px] ${onlineResourceNetworkStatus === 'offline' ? 'border-rose-900/70 bg-rose-950/30 text-rose-200' : onlineResourceNetworkStatus === 'unavailable' ? 'border-amber-900/70 bg-amber-950/30 text-amber-200' : 'border-gray-800 bg-gray-900 text-gray-400'}`} role="status" aria-live="polite">
                    {onlineResourceNetworkStatus === 'offline' ? <WifiOff size={13} /> : onlineResourceNetworkStatus === 'checking' ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                    <span>{onlineResourceNetworkStatus === 'checking' ? 'Checking internet access…' : onlineResourceNetworkStatus === 'offline' ? 'No internet connection. Connect to the internet to browse resources.' : onlineResourceNetworkStatus === 'unavailable' ? 'Internet access is available, but getRhema could not be reached.' : 'Connected to getRhema.'}</span>
                  </div>
                  {selectedManualResource && onlineResourceType === 'manuals' && <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border border-gray-700 bg-gray-900 px-3 py-2.5">
                    <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{selectedManualResource.title}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-gray-400">{selectedManualResource.detail}</p></div>
                    <button type="button" onClick={() => openManualResource(selectedManualResource)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-500"><ExternalLink size={14} /> {selectedManualResource.isLesson ? 'Open lesson' : 'Open manual'}</button>
                  </div>}
                  {onlineResourcesError && <p role="alert" className="mt-3 shrink-0 border border-rose-900/70 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">{onlineResourcesError}</p>}
                  <div className="online-resource-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto border-y border-gray-800" aria-live="polite">
                    {onlineResourcesLoading ? <div className="space-y-2 p-2" aria-label="Loading resources">
                      {Array.from({ length: 7 }, (_, index) => <div key={index} className="flex min-h-14 animate-pulse items-center gap-3 border-b border-gray-800 px-3 py-2"><span className="h-7 w-7 rounded-full bg-gray-800" /><span className="flex-1"><span className="block h-3 w-2/5 rounded bg-gray-800" /><span className="mt-2 block h-2.5 w-3/4 rounded bg-gray-800" /></span></div>)}
                    </div> : onlineResources.map(resource => <div key={resource.id} className="flex min-h-14 items-center border-b border-gray-800 px-2 py-1.5 hover:bg-gray-900">
                      {onlineResourceType === 'hymns' ? <button type="button" onClick={() => void loadOnlineHymn(resource)} disabled={Boolean(onlineResourceLoadingPath)} title={`Import ${resource.title}`} className="flex min-w-0 flex-1 items-center gap-3 px-1 py-1 text-left disabled:cursor-not-allowed disabled:opacity-45">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-300">{resource.number}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-gray-100">{resource.title}</span><span className="mt-1 block truncate text-[10px] text-gray-500">{resource.detail}</span></span>
                        {onlineResourceLoadingPath === resource.path ? <Loader2 size={15} className="animate-spin text-cyan-300" /> : <span className="shrink-0 text-[10px] font-semibold text-cyan-300">Import</span>}
                      </button> : <button type="button" onClick={() => setSelectedManualResource(resource)} aria-pressed={selectedManualResource?.id === resource.id} className="flex min-w-0 flex-1 items-center gap-3 px-1 py-1 text-left">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-800 text-gray-400"><BookOpen size={15} /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-gray-100">{resource.title}</span><span className="mt-1 block truncate text-[10px] text-gray-500">{resource.detail}</span></span>
                        <span className="shrink-0 text-[10px] font-semibold text-cyan-300">View</span>
                      </button>}
                    </div>)}
                    {!onlineResourcesLoading && onlineResourceNetworkStatus === 'online' && !onlineResourcesError && onlineResources.length === 0 && <p className="px-4 py-8 text-center text-xs text-gray-500">No matching resources. Try another title.</p>}
                  </div>
                  <footer className="flex shrink-0 items-center justify-between gap-3 pt-3 text-[10px] text-gray-500"><span>{onlineResourceType === 'hymns' ? 'Select an item to load its verses into the editor for review.' : 'Select a manual or lesson to open its source page.'}</span><a href={onlineResourceType === 'hymns' ? 'https://getrhema.net/hymns/rccg-the-redeemed-hymnal-4' : 'https://getrhema.net/manuals'} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-cyan-300 hover:text-cyan-200">getRhema <ExternalLink size={11} /></a></footer>
                </div>
              </div>
            </section>
          </div>}

        </div>
      )}
      {practiceMode && presentedVerses.length > 0 && <div className="fixed inset-0 z-[100] bg-black" role="dialog" aria-modal="true" aria-label="Bible projection practice preview"><ProjectionSurface settings={projectionSettings} verses={presentedVerses} className="h-full w-full" /><div className="absolute right-4 top-4 flex items-center gap-3 bg-black/75 px-3 py-2 text-white"><span className="text-xs font-semibold text-emerald-200">Practice preview · not sent to a display</span><button type="button" onClick={() => setPresentedVerses([])} className="min-h-9 border border-white/30 px-3 text-xs font-bold hover:bg-white/10">Close preview</button></div></div>}
    </div>
  );
};
