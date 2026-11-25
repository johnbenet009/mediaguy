import React, { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Camera, ChevronRight, Headphones, HelpCircle, Home, Mic, Monitor, Search, Settings2, Timer, X } from 'lucide-react';

interface HowToGuideProps {
  isOpen?: boolean;
  onClose?: () => void;
  variant?: 'modal' | 'page';
  initialSection?: 'main';
}

type GuideTopic = {
  title: string;
  summary: string;
  steps: string[];
  note?: string;
};

type GuideSection = {
  id: string;
  title: string;
  shortTitle: string;
  icon: React.ReactNode;
  screenshot: string;
  screenshotAlt: string;
  mobileScreenshot?: boolean;
  topics: GuideTopic[];
};

const guideSections: GuideSection[] = [
  {
    id: 'start',
    title: 'Start here',
    shortTitle: 'Start here',
    icon: <Home size={17} />,
    screenshot: './guide/timer-dashboard.png',
    screenshotAlt: 'MediaGuy timer workspace showing setup, live timer, program order, and history',
    topics: [
      {
        title: 'Run a service timer',
        summary: 'Prepare a duration, then start the live countdown.',
        steps: ['Open Timer in the top bar.', 'Under Timer Setup, use the minute buttons (+1, -1, +5, -5, +10, -10, +30, -30) and second buttons (+5s, -5s, +10s, -10s).', 'Select Start under the setup clock. The live timer starts with that duration.', 'Use the Live controls to pause, resume, restart, stop, or draw attention.'],
      },
      {
        title: 'Find the main areas',
        summary: 'The top navigation switches between the workspaces.',
        steps: ['Timer manages the service clock, program order, and live screen.', 'Transcribe captures and saves spoken notes.', 'Bible/Songs browses scripture and edits song slides.', 'Cameras manages phone video sources. The ? tab opens this guide.', 'Drag a tab to reorder the navigation; the order is remembered.'],
      },
    ],
  },
  {
    id: 'timer',
    title: 'Timer & programme order',
    shortTitle: 'Timer',
    icon: <Timer size={17} />,
    screenshot: './guide/timer-dashboard.png',
    screenshotAlt: 'Timer setup and live controls in MediaGuy',
    topics: [
      {
        title: 'Setup and live controls',
        summary: 'Setup changes the next duration; Live controls the running clock.',
        steps: ['Timer Setup contains minute and second adjustment buttons plus Start and Reset.', 'Extra Time Setup prepares overtime separately. Start Extra Time is available after the main timer completes.', 'Live: Start begins or resumes; Pause holds; Restart returns to the current duration; Stop ends the timer.', 'Attention! flashes the live timer to alert the room.', 'Clear screen offers Timer only or Timer + background.'],
      },
      {
        title: 'Build the order of service',
        summary: 'Save programme items, organize them, and start each item from the list.',
        steps: ['Select Add Program and enter a name, category, and duration.', 'Use Categories to create or rename groups. Confirm carefully before deleting: deletion also removes that category’s programmes.', 'Use Export/Import to back up or load programme data.', 'Select a programme’s Start control to run its duration. Notify displays the Up Next message.', 'Timer History lists completed programme runs; Run Again repeats an item and Clear All empties the history.'],
      },
      {
        title: 'Autopilot and live messages',
        summary: 'Autopilot advances through a selected category; alerts appear on the live display.',
        steps: ['Choose a category and programme order, then start Autopilot from its controls.', 'Use the cooldown controls and Next Program action to manage the handoff.', 'Type into Alert message, then choose Show Alert or Flash Alert. Clear Alert removes it.', 'The Aa control changes alert text case. Clock toggles the current-time overlay.'],
        note: 'For display appearance, open Settings. Display opens or manages the presentation screen.',
      },
    ],
  },
  {
    id: 'transcribe',
    title: 'Transcribe',
    shortTitle: 'Transcribe',
    icon: <Mic size={17} />,
    screenshot: './guide/transcribe.png',
    screenshotAlt: 'Transcribe workspace with microphone controls and editable live transcript',
    topics: [
      {
        title: 'Start a reliable capture',
        summary: 'Finalized speech is saved as it arrives, so reconnects do not erase earlier chunks.',
        steps: ['Confirm Internet verified. Chrome speech recognition requires an internet connection.', 'Choose Microphone input or keep System default microphone. Use Mic test to check the input level.', 'Select Start transcription. You can switch tabs while it is running; the Transcribe icon flashes in the top bar.', 'Use Stop transcription when finished. If Chrome reports a temporary network interruption, the app retries.'],
        note: 'Meter sensitivity changes only the visual meter. Adjust actual microphone gain in Windows Sound settings.',
      },
      {
        title: 'Edit, find, and keep the transcript',
        summary: 'The transcript stays editable and is saved on this device until you clear it.',
        steps: ['Click in the transcript to correct or add text; edits are saved automatically.', 'Search transcript finds each matching phrase. Use the arrows or Enter / Shift+Enter to move between matches.', 'Download saves a text file. Clear transcript removes the text and its saved copy.', 'A recognized Bible reference creates a prompt. Jump to Bible selects it in the reader; it is not projected automatically.'],
      },
      {
        title: 'Create a social plan',
        summary: 'AI analysis is optional and only runs when requested.',
        steps: ['Configure a GitHub Copilot token in AI Settings.', 'Select Analyze & Plan 7 Days to send the current transcript for suggestions.', 'Review and edit the returned plan. Nothing is published automatically.', 'Generate social graphics from the plan and download individual images or the ZIP.'],
        note: 'Transcript text is sent to the AI service only when you choose to analyze it.',
      },
    ],
  },
  {
    id: 'bible',
    title: 'Bible & Songs',
    shortTitle: 'Bible & Songs',
    icon: <BookOpen size={17} />,
    screenshot: './guide/bible.png',
    screenshotAlt: 'Bible and Songs workspace with scripture browsing controls',
    topics: [
      {
        title: 'Select and display a verse',
        summary: 'Choose a screen first, then browse the passage. Selection alone does not put text on screen.',
        steps: ['Open Bible/Songs and choose an external Projection display. Refresh the list if a connected screen is missing.', 'Filter books, then choose a book, chapter, and verse. Click selects; double-click a verse to present it.', 'Press Enter or F5 to present the selected verse. Arrow keys move through verses.', 'Use Search to find Bible wording; choose Exact phrase, All words, or Any word and optionally filter by testament or book.', 'History lets you return to recently presented passages.'],
        note: 'Without an external display, choose Continue in practice mode to preview locally. Leaving an active projection asks whether to keep or clear its background.',
      },
      {
        title: 'Prepare song slides',
        summary: 'Songs are saved locally as editable slides.',
        steps: ['Choose Songs inside Bible/Songs, then create or select a song.', 'Enter a title and lyrics. Separate slides with a blank line.', 'Choose Save song or Save changes.', 'Use Previous and Next to preview slides.'],
        note: 'The current Songs view is an editor and preview; it does not send song slides to the projection screen.',
      },
    ],
  },
  {
    id: 'cameras',
    title: 'Cameras',
    shortTitle: 'Cameras',
    icon: <Camera size={17} />,
    screenshot: './guide/cameras.png',
    screenshotAlt: 'Camera mixer workspace with connection mode and camera source controls',
    topics: [
      {
        title: 'Connect a phone camera',
        summary: 'Create an invitation from the desktop, then open it on the phone that will provide video.',
        steps: ['Open Cameras and choose Local Wi-Fi when both devices share a network, or Online for a temporary internet connection.', 'Select Show connection details and scan the invitation QR code with the phone.', 'Allow camera and microphone access on the phone. The camera-only invite does not grant timer or Bible controls.', 'Use Preview to check a source; choose Take live to put it in the programme.'],
      },
      {
        title: 'Manage the live mix',
        summary: 'Choose which source is live and where it appears.',
        steps: ['Select a connected camera source to preview it or take it live.', 'Use the program audio control to mute or unmute camera audio.', 'Set background overrides to choose whether the camera feed replaces the Timer and/or Bible display background.', 'Stop the online connection when it is no longer needed to release the temporary tunnel.'],
      },
    ],
  },
  {
    id: 'remote',
    title: 'Phone remote & displays',
    shortTitle: 'Remote & displays',
    icon: <Monitor size={17} />,
    screenshot: './guide/remote-bible-cue.png',
    screenshotAlt: 'MediaGuy mobile remote control for timer, Bible, and transcription',
    mobileScreenshot: true,
    topics: [
      {
        title: 'Open the phone remote',
        summary: 'The main computer hosts the remote control; phones connect through the displayed address.',
        steps: ['Select the Remote button in the app’s top bar.', 'Start the local remote server, then open one of the shown addresses on a phone on the same Wi-Fi.', 'Enter the access PIN shown by the desktop app.', 'Choose Timer, Bible, or Transcribe control from the remote home page.'],
        note: 'Online camera sharing is separate from the LAN remote. Use the camera invitation flow for phone video.',
      },
      {
        title: 'Present Bible references from mobile',
        summary: 'A reference detected during transcription appears on the mobile Transcribe and Bible controls.',
        steps: ['Open Transcribe Control or Bible Control on the phone.', 'Review the Scripture cue and verse text.', 'Tap Display verse to send it to the selected external Bible display.', 'The cue never presents a verse by itself.'],
      },
      {
        title: 'Choose and test displays',
        summary: 'Use display controls to route Timer and Bible output to the correct screen.',
        steps: ['Connect the secondary monitor before opening display controls.', 'Use Timer’s Display control for timer output and Bible’s Projection display selector for scripture.', 'Refresh the display list if the screen is not shown; use Test to confirm the selected target.', 'Use the File menu display actions to open, switch, or close display windows.'],
      },
    ],
  },
  {
    id: 'help',
    title: 'Shortcuts & recovery',
    shortTitle: 'Shortcuts & recovery',
    icon: <Settings2 size={17} />,
    screenshot: './guide/transcribe.png',
    screenshotAlt: 'Transcript workspace illustrating saved text and recovery controls',
    topics: [
      {
        title: 'Keyboard shortcuts',
        summary: 'Shortcuts apply from the main app when focus is not inside a text field.',
        steps: ['Space starts, pauses, or resumes the timer depending on its current state.', 'S and R reset the live timer. A triggers Attention. N skips to the next programme.', 'C turns on the current-time clock; use the Clock button to turn it off.', 'Ctrl+T opens the timer display; Ctrl+M opens Display Options.', 'Ctrl+Shift+T switches timer display; Ctrl+W closes all displays.', 'Ctrl+R refreshes displays; Ctrl+Shift+R clears their cache and force-refreshes them.'],
      },
      {
        title: 'If something is not showing',
        summary: 'Check the target display and connection before changing saved content.',
        steps: ['For timer or Bible output, confirm the correct external display is selected and still connected.', 'Use Refresh displays, then Test display where available.', 'If the phone remote disconnects, check that the desktop server is running and reconnect to the current address.', 'Transcribe saves finalized speech chunks locally. Reopen Transcribe to recover the saved text; clear only when you are ready to remove it.'],
      },
    ],
  },
];

export function HowToGuide({ isOpen = true, onClose = () => {}, variant = 'modal' }: HowToGuideProps) {
  const [search, setSearch] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('start');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredSections = useMemo(() => {
    if (!normalizedSearch) return guideSections;
    return guideSections.map(section => ({
      ...section,
      topics: section.topics.filter(topic => [section.title, topic.title, topic.summary, topic.note || '', ...topic.steps].join(' ').toLocaleLowerCase().includes(normalizedSearch)),
    })).filter(section => section.topics.length > 0);
  }, [normalizedSearch]);
  const activeSection = filteredSections.find(section => section.id === activeSectionId) || filteredSections[0];

  if (variant === 'modal' && !isOpen) return null;

  const content = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#101722] text-white">
      <header className="shrink-0 border-b border-slate-700 bg-[#17212e]">
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center bg-cyan-500/15 text-cyan-300"><HelpCircle size={22} /></span>
            <div>
              <p className="text-[10px] font-bold uppercase text-cyan-300">MediaGuy Help</p>
              <h1 className="text-xl font-bold sm:text-2xl">How can we help?</h1>
            </div>
          </div>
          {variant === 'modal' && <button type="button" onClick={onClose} aria-label="Close help" className="grid h-9 w-9 place-items-center text-slate-400 hover:bg-slate-800 hover:text-white"><X size={19} /></button>}
        </div>
        <div className="px-5 pb-4 sm:px-7">
          <label className="flex h-11 items-center gap-3 border border-slate-600 bg-slate-950/70 px-3 focus-within:border-cyan-400">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input value={search} onChange={event => { setSearch(event.target.value); setActiveSectionId('start'); }} placeholder="Search a button, task, or feature" aria-label="Search help guide" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear help search" className="text-xs font-semibold text-slate-400 hover:text-white">Clear</button>}
          </label>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Help sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-700 bg-[#121b27] p-2 md:w-56 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-3">
          {filteredSections.map(section => (
            <button key={section.id} type="button" onClick={() => setActiveSectionId(section.id)} aria-current={activeSection?.id === section.id ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-left text-xs font-semibold transition-colors md:w-full ${activeSection?.id === section.id ? 'bg-cyan-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <span className="shrink-0">{section.icon}</span><span>{section.shortTitle}</span>
            </button>
          ))}
          {filteredSections.length === 0 && <p className="px-3 py-4 text-xs text-slate-500">No matching help topics.</p>}
          <div className="mt-auto hidden border-t border-slate-800 px-3 py-4 text-[11px] leading-relaxed text-slate-500 md:block">Search by what you see on screen, such as “Flash Alert” or “Projection display”.</div>
        </nav>

        {activeSection ? (
          <main key={activeSection.id} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl px-4 py-5 sm:px-7 sm:py-7">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-cyan-300">{activeSection.topics.length} quick guide{activeSection.topics.length === 1 ? '' : 's'}</p>
                  <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{activeSection.title}</h2>
                </div>
                <span className="hidden items-center gap-1 text-xs text-slate-500 sm:flex">Select a section <ChevronRight size={14} /></span>
              </div>

              <figure className="mb-7 overflow-hidden border border-slate-700 bg-slate-950">
                <img src={activeSection.screenshot} alt={activeSection.screenshotAlt} className={activeSection.mobileScreenshot ? 'mx-auto block max-h-[520px] max-w-full object-contain' : 'block h-auto w-full'} />
                <figcaption className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">MediaGuy {activeSection.shortTitle} workspace</figcaption>
              </figure>

              <div className="divide-y divide-slate-700 border-y border-slate-700">
                {activeSection.topics.map((topic, index) => (
                  <section key={topic.title} className="grid gap-3 py-5 sm:grid-cols-[minmax(10rem,0.36fr)_minmax(0,1fr)] sm:gap-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500">{String(index + 1).padStart(2, '0')}</p>
                      <h3 className="mt-1 text-base font-bold text-white">{topic.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{topic.summary}</p>
                    </div>
                    <div>
                      <ol className="space-y-2.5">
                        {topic.steps.map((step, stepIndex) => <li key={step} className="flex gap-3 text-sm leading-relaxed text-slate-200"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center bg-slate-800 text-[10px] font-bold text-cyan-200">{stepIndex + 1}</span><span>{step}</span></li>)}
                      </ol>
                      {topic.note && <p className="mt-3 flex items-start gap-2 border-l-2 border-amber-400/70 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-100"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />{topic.note}</p>}
                    </div>
                  </section>
                ))}
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-slate-500">
                <span>MediaGuy 1.0.0 · Help for the current desktop app</span>
                <a href="https://github.com/johnbenet009/mediaguy" target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 hover:text-cyan-200">Project on GitHub</a>
              </footer>
            </div>
          </main>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div><Headphones className="mx-auto text-slate-500" size={28} /><p className="mt-3 text-sm font-semibold text-slate-300">No matching help topics</p><p className="mt-1 text-xs text-slate-500">Try another word or clear your search.</p></div>
          </div>
        )}
      </div>
    </div>
  );

  if (variant === 'modal') {
    return <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="MediaGuy help guide" className="flex h-[min(92vh,900px)] w-full max-w-6xl overflow-hidden border border-slate-700 shadow-2xl">{content}</section></div>;
  }

  return <section className="flex min-h-[calc(100vh-7rem)] w-full flex-col overflow-hidden border border-slate-700 shadow-2xl">{content}</section>;
}