import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FocusSession, ImportPreview, Seed } from './domain/model'
import { GardenRepository } from './domain/repository'
import { IdeaActions } from './components/IdeaActions'
import './App.css'

const AdvancedWorkspace = lazy(() => import('./AdvancedWorkspace'))
const defaultRepository = new GardenRepository(globalThis?.localStorage, { storageKey: 'lumen-garden:local-repository' })
type Props = { repository?: GardenRepository }
type Page = 'home' | 'search' | 'settings' | 'advanced'

function download(data: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  URL.revokeObjectURL(url)
}
function remaining(session: FocusSession, now: number) {
  const clock = session.status === 'paused' ? session.pausedAt ?? now : now
  const seconds = Math.max(0, Math.ceil((session.durationMinutes * 60000 - (clock - session.startedAt - session.accumulatedPauseMs)) / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export default function App({ repository = defaultRepository }: Props) {
  const state = useSyncExternalStore(listener => repository.subscribe(listener), () => repository.getSnapshot())
  const [page, setPage] = useState<Page>('home')
  const [selectedId, setSelectedId] = useState('')
  const [capture, setCapture] = useState('')
  const [context, setContext] = useState('')
  const [withContext, setWithContext] = useState(false)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const captureRef = useRef<HTMLInputElement>(null)
  const selected = state.seeds.find(seed => seed.id === selectedId)
  const active = repository.getActiveFocusSession()
  const undo = repository.getUndoState()
  const issue = repository.getStorageIssue()
  const demoCount = state.seeds.filter(seed => seed.source === 'demo').length

  useEffect(() => { titleRef.current?.focus() }, [selectedId, page])
  function run(action: () => void) {
    try { action(); setError(''); return true }
    catch (failure) { setError(`Could not save this change. ${failure instanceof Error ? failure.message : String(failure)}. Your accepted data is unchanged.`); return false }
  }
  function navigate(next: Page) { setSelectedId(''); setPage(next); setNotice('') }
  function open(seed: Seed) { setSelectedId(seed.id); setNotice(''); setError('') }
  const results = state.seeds.filter(seed => page === 'search'
    ? [seed.text, seed.note, seed.nextAction, ...seed.tags].join(' ').toLowerCase().includes(query.toLowerCase().trim())
    : seed.status !== 'archived').slice().sort((a, b) => {
      if (a.id === active?.seedId) return -1
      if (b.id === active?.seedId) return 1
      return b.updatedAt - a.updatedAt
    })
  const visible = page === 'search' || showAll ? results : results.slice(0, 5)

  return <div className="lumen">
    <a className="skip-link" href="#workspace">Skip to content</a>
    <header className="lumen-header">
      <button className="wordmark" onClick={() => navigate('home')} aria-label="Lumen home"><span className="lumen-mark" aria-hidden="true" />lumen<span className="wordmark-note">A little clarity.</span></button>
      <nav aria-label="Main navigation">
        <button className={page === 'search' ? 'nav-selected' : ''} onClick={() => navigate('search')} aria-current={page === 'search' ? 'page' : undefined}>Search</button>
        <button className={page === 'settings' ? 'nav-selected' : ''} onClick={() => navigate('settings')} aria-current={page === 'settings' ? 'page' : undefined}>Settings</button>
      </nav>
    </header>
    <main id="workspace" className={page === 'advanced' ? 'advanced-container' : 'lumen-main'}>
      {error && <p className="lumen-alert" role="alert">{error}</p>}
      {issue && !error && <aside className="lumen-alert" role="alert">Local storage needs attention. {issue.kind === 'read' ? 'Your original data is preserved for recovery.' : 'Your last change could not be saved.'} <button onClick={() => navigate('settings')}>Open recovery settings</button></aside>}
      {notice && <p className="lumen-notice" role="status">{notice}</p>}
      {selected ? <>
        <button className="back-link" onClick={() => setSelectedId('')}>← {page === 'search' ? 'Search results' : 'All ideas'}</button>
        <div className="detail-heading"><p className="overline">{selected.source === 'demo' ? 'Example idea' : selected.status === 'archived' ? 'Archived idea' : 'Your workspace'}</p><h1 ref={titleRef} tabIndex={-1}>{selected.text}</h1></div>
        <IdeaDetail key={selected.id} seed={selected} repository={repository} run={run} onArchive={() => { setSelectedId(''); setNotice('Idea archived. Find it in Search, or undo below.') }} />
      </> : page === 'home' ? <>
        <section className="welcome">
          <p className="overline">SPACE TO THINK. ROOM TO DO.</p>
          <h1 ref={titleRef} tabIndex={-1}>What do you want<br className="desktop-break" /> to move forward?</h1>
          <p className="welcome-description">Start with a thought. Leave with a next step.</p>
          <form className="capture-form" onSubmit={event => {
            event.preventDefault()
            if (!capture.trim()) return
            if (run(() => { const seed = repository.captureSeed({ text: capture, note: context }); open(seed) })) { setCapture(''); setContext(''); setWithContext(false) }
          }}>
            <div className="capture-field"><label className="sr-only" htmlFor="new-idea">New idea</label><input ref={captureRef} id="new-idea" value={capture} onChange={event => setCapture(event.target.value)} placeholder="An idea, a question, something to finish…" required autoComplete="off" /><button className="primary add-idea" type="submit" aria-label="Add idea"><span aria-hidden="true">↗</span></button></div>
            <button className="context-toggle" type="button" aria-expanded={withContext} onClick={() => setWithContext(!withContext)}>{withContext ? 'Hide context' : '+ Add context'}</button>
            {withContext && <label className="field-label">Optional context<textarea value={context} onChange={event => setContext(event.target.value)} rows={3} placeholder="What would help you pick this up later?" /></label>}
          </form>
        </section>
        <section className="continue-section" aria-label="Continue working">
          <div className="section-heading"><h2>Continue working</h2><span>{results.length} {results.length === 1 ? 'idea' : 'ideas'}</span></div>
          {demoCount > 0 && <div className="example-note"><span>Example ideas to try. Your own work belongs here.</span><button onClick={() => { if (window.confirm('Remove example ideas? Your own ideas will stay.')) run(() => repository.clearDemoData()) }}>Clear examples</button></div>}
          {visible.length ? <IdeaList ideas={visible} activeId={active?.seedId} open={open} /> : <div className="quiet-empty"><p>Nothing competing for your attention.</p><span>Add something above. You can figure out the next step as you go.</span></div>}
          {results.length > 5 && <button className="show-more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : `View all ${results.length} ideas`} <span aria-hidden="true">↓</span></button>}
        </section>
      </> : page === 'search' ? <section className="utility-page"><p className="overline">PICK UP THE THREAD</p><h1 ref={titleRef} tabIndex={-1}>Find your thinking.</h1><label className="field-label">Search ideas<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ideas, next steps, context or tags" autoFocus /></label><p className="muted">All your ideas, including archived work.</p>{visible.length ? <IdeaList ideas={visible} activeId={active?.seedId} open={open} /> : <div className="quiet-empty">No ideas match. Try a different word.</div>}</section>
      : page === 'settings' ? <section className="utility-page settings-page"><p className="overline">YOUR SPACE, YOUR DATA</p><h1 ref={titleRef} tabIndex={-1}>Settings</h1><p className="muted">Saved in this browser. No account, tracking, or automatic AI access. Export a backup before clearing browser data.</p>
        <section><h2>Backup & recovery</h2><button className="primary" onClick={() => run(() => download(repository.exportData(), 'lumen-backup.json'))}>Export backup</button>{issue?.recoveryAvailable && <button onClick={() => run(() => { const bytes = repository.getRecoveryData(); if (bytes) download(bytes, 'lumen-recovery.json') })}>Export recovery copy</button>}
          <details><summary>Restore from a backup</summary><p className="muted">Preview first. Replacing your local data requires confirmation and can be undone.</p><label className="field-label">Import JSON<textarea rows={5} value={importText} onChange={event => { setImportText(event.target.value); setPreview(null) }} /></label><button onClick={() => run(() => setPreview(repository.previewImport(importText)))}>Preview import</button>{preview && <div className="import-summary"><p>{preview.seeds} ideas · {preview.beds} projects · {preview.threads} connections · {preview.focusSessions} focus sessions</p><button onClick={() => {
            if (window.confirm('Replace all local data with this backup?')) {
              if (run(() => repository.importData(importText))) { setPreview(null); setImportText(''); setNotice('Backup restored. Undo is available below.') }
            }
          }}>Replace local data</button></div>}</details>
        </section>
        <section><h2>More tools</h2><p className="muted">Projects, idea connections, filters, and the original workspace are still available when you need them.</p><button onClick={() => navigate('advanced')}>Open advanced workspace</button></section>
      </section> : <><button className="back-link" onClick={() => navigate('home')}>← Back to simple workspace</button><Suspense fallback={<p>Opening workspace…</p>}><AdvancedWorkspace repository={repository} /></Suspense></>}
      {undo && <div className="undo-toast"><span>{undo.label}</span><button onClick={() => run(() => { repository.undoLast(); setNotice('Change undone.') })}>Undo</button></div>}
    </main>
    <footer className="lumen-footer"><span><span className="local-dot" aria-hidden="true" /> Stored on this device</span><span>One thing at a time.</span></footer>
  </div>
}
function IdeaList({ ideas, activeId, open }: { ideas: Seed[]; activeId?: string; open: (seed: Seed) => void }) {
  return <ul className="idea-list">{ideas.map(seed => <li key={seed.id}><button className="idea-row" onClick={() => open(seed)} aria-label={`Open ${seed.text}`}><span className={`idea-indicator ${seed.id === activeId ? 'is-active' : ''}`} aria-hidden="true" /><span className="idea-row-text"><strong>{seed.text}</strong><span>{seed.nextAction || 'Choose a small next step'}</span></span><span className="row-state">{seed.status === 'archived' ? 'Archived' : seed.id === activeId ? 'In focus' : seed.source === 'demo' ? 'Example' : ''}</span><span className="row-arrow" aria-hidden="true">↗</span></button></li>)}</ul>
}
function IdeaDetail({ seed, repository, run, onArchive }: { seed: Seed; repository: GardenRepository; run: (action: () => void) => boolean; onArchive: () => void }) {
  const state = repository.getSnapshot()
  const active = repository.getActiveFocusSession()
  const session = active?.seedId === seed.id ? active : null
  const [duration, setDuration] = useState(25)
  const [outcome, setOutcome] = useState(session?.outcome ?? '')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { if (session?.status !== 'running') return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [session?.id, session?.status])
  const history = state.focusSessions.filter(item => item.seedId === seed.id && item.status === 'completed').slice().sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
  return <div className="idea-detail">
    {seed.note && <section className="detail-context"><h2>Context</h2><p>{seed.note}</p></section>}
    <IdeaActions seed={seed} state={state} repository={repository} />
    {!seed.nextAction && <p className="next-step-hint">What is the smallest useful step? Add it with Edit idea.</p>}
    {seed.status !== 'archived' && <section className="focus-section" aria-label="Focus on this idea">
      <div className="section-heading"><h2>{session ? 'One thing. Right now.' : 'Make a little progress.'}</h2>{session && <span className="timer" aria-label="Time remaining">{remaining(session, now)}</span>}</div>
      {session ? <><div className="focus-controls"><span className="muted">{session.status === 'paused' ? 'Paused. Take your time.' : 'A little space for focused work.'}</span><button onClick={() => run(() => session.status === 'running' ? repository.pauseFocusSession(session.id) : repository.resumeFocusSession(session.id))}>{session.status === 'running' ? 'Pause' : 'Resume'}</button></div><label className="field-label">What changed?<textarea rows={3} value={outcome} onChange={event => { const value = event.target.value; setOutcome(value); run(() => repository.setFocusOutcome(session.id, value)) }} placeholder="A result, a decision, or where to pick up next." /></label><div className="detail-buttons"><button className="primary" onClick={() => { if (run(() => repository.completeFocusSession(session.id, outcome))) setOutcome('') }}>Save progress</button><button onClick={() => { if (window.confirm('End this focus session without completing it? Your saved notes stay in the backup.')) run(() => repository.abandonFocusSession(session.id)) }}>End session</button></div></>
      : <><p className="muted">Give this idea your attention, then keep what changed.</p><div className="detail-buttons"><label className="duration-label">Focus time<select value={duration} onChange={event => setDuration(Number(event.target.value))}>{[5, 15, 25, 45].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label><button className="primary" disabled={Boolean(active)} onClick={() => { if (run(() => repository.startFocusSession(seed.id, duration))) { setOutcome(''); setNow(Date.now()) } }}>Start focus</button></div>{active && <p className="muted">Finish or end the other idea’s focus session first. It is at the top of your home screen.</p>}</>}
    </section>}
    <section className="progress-section"><h2>Progress</h2>{history.length ? <ol className="progress-list">{history.map(item => <li key={item.id}><time dateTime={new Date(item.endedAt ?? item.startedAt).toISOString()}>{new Date(item.endedAt ?? item.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time><p>{item.outcome || 'Completed a focus session.'}</p></li>)}</ol> : <p className="muted">Your results will collect here. Start small.</p>}</section>
    <div className="archive-action">{seed.status === 'archived' ? <button onClick={() => run(() => repository.restoreSeed(seed.id))}>Restore idea</button> : <button disabled={Boolean(session)} onClick={() => { if (run(() => repository.archiveSeed(seed.id))) onArchive() }}>Archive idea</button>}</div>
  </div>
}
