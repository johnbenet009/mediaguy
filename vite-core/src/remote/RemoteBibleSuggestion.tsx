import { useEffect, useState } from 'react';
import { BookOpen, Check, Loader2, Radio } from 'lucide-react';
import type { RemoteConnection } from './useRemoteState';

type Verse = { book: number; book_name: string; chapter: number; verse: number; text: string };

export function RemoteBibleSuggestion({ conn }: { conn: RemoteConnection }) {
	const reference = conn.state.transcribe?.bibleReference;
	const [allVerses, setAllVerses] = useState<Verse[]>([]);
	const [dismissedLabel, setDismissedLabel] = useState('');
	const [isSending, setIsSending] = useState(false);

	useEffect(() => {
		let active = true;
		void fetch('/kjv.json')
			.then(response => response.ok ? response.json() : [])
			.then((data: Verse[] | { verses?: Verse[] }) => {
				if (active) setAllVerses(Array.isArray(data) ? data : data.verses || []);
			})
			.catch(() => undefined);
		return () => { active = false; };
	}, []);

	useEffect(() => {
		setDismissedLabel('');
		setIsSending(false);
	}, [reference?.label]);

	if (!reference || dismissedLabel === reference.label) return null;
	const verse = allVerses.find(item => item.book_name.toLowerCase() === reference.book.toLowerCase()
		&& item.chapter === reference.chapter && item.verse === reference.verse);
	const alreadyDisplayed = conn.state.bible?.presented === reference.label && conn.state.bible.isShowing;

	const displayVerse = () => {
		if (!verse || isSending) return;
		setIsSending(true);
		conn.sendCommand('bible', 'show', {
			bookId: verse.book,
			chapter: verse.chapter,
			verse: verse.verse,
			verseData: verse,
		});
		window.setTimeout(() => setIsSending(false), 1200);
	};

	return (
		<section role="status" aria-live="polite" className="border border-amber-500/40 bg-amber-400/10 p-4 shadow-lg shadow-black/20">
			<div className="flex items-start gap-3">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center border border-amber-400/30 bg-amber-400/10 text-amber-200"><BookOpen className="h-5 w-5" /></span>
				<div className="min-w-0 flex-1">
					<p className="text-[11px] font-bold uppercase text-amber-200">Scripture heard</p>
					<p className="mt-0.5 truncate text-base font-bold text-white">{reference.label}</p>
					<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-300">{verse?.text || 'Passage text is loading.'}</p>
				</div>
				<button type="button" onClick={() => setDismissedLabel(reference.label)} aria-label="Dismiss Scripture cue" className="shrink-0 p-1 text-slate-400 hover:bg-slate-800 hover:text-white">×</button>
			</div>
			<div className="mt-3 flex items-center justify-between gap-3">
				<span className="text-[11px] text-slate-400">{alreadyDisplayed ? 'On projection' : 'Not displayed'}</span>
				<button type="button" onClick={displayVerse} disabled={!verse || isSending || alreadyDisplayed} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
					{alreadyDisplayed ? <Check className="h-4 w-4" /> : isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
					{alreadyDisplayed ? 'Displayed' : isSending ? 'Sending…' : verse ? 'Display verse' : 'Loading verse…'}
				</button>
			</div>
		</section>
	);
}