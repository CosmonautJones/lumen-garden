import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { relationLabel } from './domain/model'
import type { BedHealth, FocusSession, ImportPreview, RelationType, SeedStatus } from './domain/model'
import { GardenRepository } from './domain/repository'
import './App.css'

type MainView = 'inbox' | 'explore' | 'focus' | 'review'

type FocusTemplate = {
  label: string
  durationMinutes: number
}

const DEFAULT_FOCUS_TEMPLATES: FocusTemplate[] = [
  { label: '5 min', durationMinutes: 5 },
  { label: '15 min', durationMinutes: 15 },
  { label: '25 min', durationMinutes: 25 },
  { label: '45 min', durationMinutes: 45 },
]

const RECENCY_OPTIONS = ['all', '7', '30', '90'] as const

type RecencyFilter = (typeof RECENCY_OPTIONS)[number]


const REPOSITORY = new GardenRepository(globalThis?.localStorage, {
  storageKey: 'lumen-garden:local-repository',
})

function getElapsedMs(session: FocusSession, now: number): number {
  if (session.status === 'completed' || session.status === 'abandoned') {
    return session.endedAt !== undefined ? session.endedAt - session.startedAt - session.accumulatedPauseMs : 0
  }
  if (session.status === 'paused' && typeof session.pausedAt === 'number') {
    return session.pausedAt - session.startedAt - session.accumulatedPauseMs
  }
  return now - session.startedAt - session.accumulatedPauseMs
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function formatRemaining(session: FocusSession, now: number): string {
  const elapsed = getElapsedMs(session, now)
  const targetMs = session.durationMinutes * 60 * 1000
  const remainingMs = Math.max(0, targetMs - elapsed)
  const total = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function byRecent(a: { updatedAt: number }, b: { updatedAt: number }): number {
  return b.updatedAt - a.updatedAt
}

function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item)
    const bucket = acc[k] ?? []
    bucket.push(item)
    acc[k] = bucket
    return acc
  }, {} as Record<K, T[]>)
}

function App() {
  const [view, setView] = useState<MainView>('inbox')
  const [captureText, setCaptureText] = useState('')
  const [captureNote, setCaptureNote] = useState('')
  const [captureEnergy, setCaptureEnergy] = useState(3)
  const [captureTags, setCaptureTags] = useState('')
  const [selectedSeedId, setSelectedSeedId] = useState('')
  const [threadTargetId, setThreadTargetId] = useState('')
  const [threadRelation, setThreadRelation] = useState<RelationType>('supports')
  const [filterTag, setFilterTag] = useState('')
  const [filterStatus, setFilterStatus] = useState<SeedStatus | 'all'>('all')
  const [filterBed, setFilterBed] = useState<string>('all')
  const [filterRecency, setFilterRecency] = useState<RecencyFilter>('all')
  const [focusDuration, setFocusDuration] = useState(25)
  const [focusOutcome, setFocusOutcome] = useState('')
  const [newBedName, setNewBedName] = useState('')
  const [newBedIntent, setNewBedIntent] = useState('')
  const [newBedColor, setNewBedColor] = useState('#2f8f94')
  const [newBedHealth, setNewBedHealth] = useState<BedHealth>('seedling')
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const captureInputRef = useRef<HTMLInputElement>(null)

  const state = useSyncExternalStore(
    (listener) => REPOSITORY.subscribe(listener),
    () => REPOSITORY.getSnapshot(),
    () => REPOSITORY.getSnapshot(),
  )
  const undo = REPOSITORY.getUndoState()
  const activeSession = REPOSITORY.getActiveFocusSession()

  useEffect(() => {
    if (!state.seeds.some((seed) => seed.id === selectedSeedId)) {
      const firstSeed = state.seeds[0] ?? null
      setSelectedSeedId(firstSeed?.id ?? '')
    }
  }, [state.seeds, selectedSeedId])

  useEffect(() => {
    if (activeSession?.outcome) {
      setFocusOutcome(activeSession.outcome)
    } else {
      setFocusOutcome('')
    }
  }, [activeSession?.id])

  useEffect(() => {
    if (view === 'focus' && activeSession) {
      const interval = window.setInterval(() => {
        setNowTick(Date.now())
      }, 1000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [view, activeSession?.id])

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent): void => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement
      const activeTag = target?.tagName?.toLowerCase()
      const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select'
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      if ((event.key === 'c' || event.key === 'C') && captureInputRef.current) {
        event.preventDefault()
        captureInputRef.current.focus()
        return
      }
      if (event.key === '1') {
        setView('inbox')
        return
      }
      if (event.key === '2') {
        setView('explore')
        return
      }
      if (event.key === '3') {
        setView('focus')
        return
      }
      if (event.key === '4') {
        setView('review')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const inboxSeeds = useMemo(() => state.seeds.filter((seed) => seed.status === 'inbox'), [state.seeds])

  const selectedSeed = useMemo(() => state.seeds.find((seed) => seed.id === selectedSeedId) ?? null, [state.seeds, selectedSeedId])
  const bedOptions = useMemo(() => state.beds.slice().sort(byRecent), [state.beds])

  const reviewedSeeds = useMemo(() => {
    const now = Date.now()
    const cutoffMs = filterRecency === 'all' ? 0 : now - Number(filterRecency) * 24 * 60 * 60 * 1000
    return state.seeds
      .filter((seed) => (filterStatus === 'all' ? true : seed.status === filterStatus))
      .filter((seed) => (filterBed === 'all' ? true : seed.bedId === filterBed))
      .filter((seed) => (filterTag.length === 0 ? true : seed.tags.includes(filterTag.trim().toLowerCase())))
      .filter((seed) => (filterRecency === 'all' ? true : seed.updatedAt >= cutoffMs))
      .sort(byRecent)
  }, [filterBed, filterRecency, filterStatus, filterTag, state.seeds])

  const activeThreads = useMemo(() => {
    if (!selectedSeed) return []
    return state.threads.filter(
      (thread) => thread.fromSeedId === selectedSeed.id || thread.toSeedId === selectedSeed.id,
    )
  }, [selectedSeed, state.threads])

  const threadSeedOptions = useMemo(
    () => state.seeds.filter((seed) => seed.id !== selectedSeed?.id).sort((a, b) => a.text.localeCompare(b.text)),
    [selectedSeed?.id, state.seeds],
  )

  function clearDemoAction() {
    if (!window.confirm('Clear seeded demo data from your workspace?')) {
      return
    }
    REPOSITORY.clearDemoData()
  }

  function handleCapture(event: FormEvent) {
    event.preventDefault()
    if (captureText.trim().length < 1) return

    const tags = captureTags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)

    REPOSITORY.captureSeed({
      text: captureText,
      note: captureNote || undefined,
      energy: captureEnergy,
      tags,
    })

    setCaptureText('')
    setCaptureNote('')
    setCaptureTags('')
    setCaptureEnergy(3)
    captureInputRef.current?.focus()
  }

  function handleArchive(seedId: string) {
    REPOSITORY.archiveSeed(seedId)
  }

  function handleRestore(seedId: string) {
    REPOSITORY.restoreSeed(seedId)
  }

  function handleMoveToBed(seedId: string, bedId: string) {
    REPOSITORY.moveSeedToBed(seedId, bedId)
  }

  function handleStartFocus(seedId: string) {
    REPOSITORY.startFocusSession(seedId, focusDuration)
    setView('focus')
  }

  function handleClearImportPreview() {
    setImportText('')
    setImportError('')
    setImportPreview(null)
  }

  function handlePreviewImport() {
    try {
      const next = REPOSITORY.previewImport(importText)
      setImportError('')
      setImportPreview(next)
    } catch (error) {
      setImportError((error as Error).message)
      setImportPreview(null)
    }
  }

  function handleApplyImport() {
    if (!window.confirm('This will replace your current local garden after review. Proceed?')) {
      return
    }
    try {
      REPOSITORY.importData(importText)
      handleClearImportPreview()
    } catch (error) {
      setImportError((error as Error).message)
    }
  }

  function handleExport() {
    const payload = REPOSITORY.exportData()
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'lumen-garden-export.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleCreateBed(event: FormEvent) {
    event.preventDefault()
    if (newBedName.trim().length === 0) return
    REPOSITORY.createBed({
      name: newBedName,
      intent: newBedIntent || 'No intent yet',
      color: newBedColor,
      health: newBedHealth,
    })
    setNewBedName('')
    setNewBedIntent('')
  }

  function renderInbox() {
    return (
      <section className="pane" aria-label="Inbox">
        <h2>Inbox</h2>
        <p className="helper">Capture ideas here, then triage to beds, archive, or focus.</p>
        {inboxSeeds.length === 0 ? (
          <div className="empty">
            <p>The inbox is clear.</p>
            <p>Capture one seed to begin an operating cycle.</p>
          </div>
        ) : (
          <ul className="seed-list">
            {inboxSeeds.map((seed) => (
              <li key={seed.id} className="seed-card">
                <div className="seed-card-head">
                  <h3>{seed.text}</h3>
                  <span className="meta">
                    Energy {seed.energy}/5 · {formatDate(seed.createdAt)}
                  </span>
                </div>
                {seed.note ? <p className="seed-note">{seed.note}</p> : null}
                {seed.tags.length === 0 ? null : (
                  <div className="seed-tags">
                    {seed.tags.map((tag) => (
                      <span key={tag} className="seed-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="seed-actions">
                  <label htmlFor={`seed-bed-${seed.id}`} className="sr-only">
                    Move to bed
                  </label>
                  <select
                    id={`seed-bed-${seed.id}`}
                    value={seed.bedId ?? ''}
                    onChange={(event) => {
                      if (event.target.value.length > 0) {
                        handleMoveToBed(seed.id, event.target.value)
                      }
                    }}
                  >
                    <option value="">Choose bed</option>
                    {bedOptions.map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        {bed.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => handleArchive(seed.id)}>
                    Archive
                  </button>
                  <button type="button" onClick={() => handleStartFocus(seed.id)}>
                    Focus now
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  function renderExplore() {
    return (
      <section className="pane" aria-label="Constellation">
        <div className="two-column">
          <div>
            <h2>Constellation</h2>
            <p className="helper">
              Select seeds to connect ideas and keep relation context visible.
            </p>
            <ul className="seed-list seed-map">
              {state.seeds.map((seed) => {
                const bed = state.beds.find((current) => current.id === seed.bedId)
                return (
                  <li
                    key={seed.id}
                    className={`seed-card${selectedSeed?.id === seed.id ? ' selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="seed-select"
                      onClick={() => setSelectedSeedId(seed.id)}
                    >
                      <div className="seed-card-head">
                        <h3>{seed.text}</h3>
                        <span className="meta">
                          {seed.status} · {seed.tags.join(', ') || 'no tags'}
                        </span>
                      </div>
                      {bed ? (
                        <small className="seed-meta">Bed: {bed.name}</small>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <aside className="inspector">
            {selectedSeed ? (
              <section>
                <h3>Seed details</h3>
                <h4>{selectedSeed.text}</h4>
                {selectedSeed.note ? <p>{selectedSeed.note}</p> : <p className="helper">No note yet.</p>}
                <p className="helper">
                  Status: {selectedSeed.status}, Source: {selectedSeed.source}, Updated {formatDate(selectedSeed.updatedAt)}
                </p>
                <div>
                  <h4>Thread links</h4>
                  {activeThreads.length === 0 ? (
                    <p className="helper">No relationships yet.</p>
                  ) : (
                    <ul>
                      {activeThreads.map((thread) => {
                        const otherId = thread.fromSeedId === selectedSeed.id ? thread.toSeedId : thread.fromSeedId
                        const peer = state.seeds.find((seed) => seed.id === otherId)
                        return (
                          <li key={thread.id} className="thread-row">
                            <span>{peer?.text ?? 'Unknown seed'}</span>
                            <span>{relationLabel(thread.relation)}</span>
                            <button
                              type="button"
                              onClick={() => REPOSITORY.removeThread(thread.id)}
                              aria-label="Delete thread"
                            >
                              Remove
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                <form
                  className="thread-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!threadTargetId || threadTargetId === selectedSeed.id) {
                      return
                    }
                    REPOSITORY.addThread(selectedSeed.id, threadTargetId, threadRelation)
                    setThreadTargetId('')
                  }}
                >
                  <h4>Connect selected</h4>
                  <label htmlFor="thread-target">Target</label>
                  <select
                    id="thread-target"
                    value={threadTargetId}
                    onChange={(event) => setThreadTargetId(event.target.value)}
                  >
                    <option value="">Choose seed</option>
                    {threadSeedOptions.map((seed) => (
                      <option key={seed.id} value={seed.id}>
                        {seed.text}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="thread-relation">Relation</label>
                  <select
                    id="thread-relation"
                    value={threadRelation}
                    onChange={(event) => setThreadRelation(event.target.value as RelationType)}
                  >
                    <option value="supports">supports</option>
                    <option value="extends">extends</option>
                    <option value="blocks">blocks</option>
                  </select>
                  <button type="submit">Add thread</button>
                </form>
              </section>
            ) : (
              <div className="empty">
                <p>Select a seed to inspect relationships.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    )
  }

  function renderFocus() {
    const candidates = state.seeds.filter((seed) => seed.status !== 'archived').sort(byRecent)
    return (
      <section className="pane" aria-label="Focus">
        <h2>Focus</h2>
        <p className="helper">
          Start one focused block, write a concrete outcome, and complete or pause.
        </p>
        {activeSession ? (
          <article className="focus-card">
            <h3>Active session</h3>
            <p className="helper">
              Working on{' '}
              <strong>{state.seeds.find((seed) => seed.id === activeSession.seedId)?.text ?? 'Unknown seed'}</strong>
            </p>
            <p>
              {activeSession.status === 'running' ? 'Running' : activeSession.status === 'paused' ? 'Paused' : 'Finished'}{' '}
              · Remaining {formatRemaining(activeSession, nowTick)}
            </p>
            <label htmlFor="focus-outcome">Outcome text</label>
            <textarea
              id="focus-outcome"
              rows={5}
              value={focusOutcome}
              onChange={(event) => setFocusOutcome(event.target.value)}
            />
            <div className="seed-actions">
              {activeSession.status === 'running' ? (
                <button type="button" onClick={() => REPOSITORY.pauseFocusSession(activeSession.id)}>
                  Pause
                </button>
              ) : (
                <button type="button" onClick={() => REPOSITORY.resumeFocusSession(activeSession.id)}>
                  Resume
                </button>
              )}
              <button type="button" onClick={() => REPOSITORY.completeFocusSession(activeSession.id, focusOutcome)}>
                Complete
              </button>
              <button type="button" onClick={() => REPOSITORY.abandonFocusSession(activeSession.id)}>
                Abandon
              </button>
            </div>
          </article>
        ) : (
          <article className="focus-card">
            <h3>Start focus</h3>
            <p className="helper">Pick one seed and choose a duration.</p>
            <div className="focus-form">
              <label htmlFor="focus-duration">Duration</label>
              <select
                id="focus-duration"
                value={focusDuration}
                onChange={(event) => setFocusDuration(Number(event.target.value))}
              >
                {DEFAULT_FOCUS_TEMPLATES.map((template) => (
                  <option key={template.durationMinutes} value={template.durationMinutes}>
                    {template.label}
                  </option>
                ))}
              </select>
              <label htmlFor="focus-seed">Seed</label>
              <select id="focus-seed">
                <option value="">Choose seed</option>
                {candidates.map((seed) => (
                  <option key={seed.id} value={seed.id}>
                    {seed.text}
                  </option>
                ))}
              </select>
            </div>
            <div className="seed-actions">
              <button
                type="button"
                onClick={(event) => {
                  const select = event.currentTarget.previousElementSibling?.previousElementSibling
                  if (select && select instanceof HTMLSelectElement && select.value.length > 0) {
                    REPOSITORY.startFocusSession(select.value, focusDuration)
                  }
                }}
              >
                Begin
              </button>
            </div>
          </article>
        )}
      </section>
    )
  }

  function renderReview() {
    return (
      <section className="pane" aria-label="Review">
        <h2>Review</h2>
        <div className="filters">
          <label>
            Status
            <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as SeedStatus | 'all')}>
              <option value="all">All</option>
              <option value="inbox">Inbox</option>
              <option value="active">Active</option>
              <option value="focused">Focused</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            Bed
            <select value={filterBed} onChange={(event) => setFilterBed(event.target.value)}>
              <option value="all">All</option>
              {bedOptions.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <input
              type="text"
              value={filterTag}
              placeholder="Tag"
              onChange={(event) => setFilterTag(event.target.value)}
            />
          </label>
          <label>
            Recency
            <select value={filterRecency} onChange={(event) => setFilterRecency(event.target.value as RecencyFilter)}>
              <option value="all">Any</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
        </div>
        {reviewedSeeds.length === 0 ? (
          <div className="empty">
            <p>Nothing matches the current filters.</p>
          </div>
        ) : (
          <ul className="seed-list">
            {reviewedSeeds.map((seed) => (
              <li key={seed.id} className="seed-card">
                <div className="seed-card-head">
                  <h3>{seed.text}</h3>
                  <span className="meta">
                    {seed.status} · {seed.tags.join(', ') || 'no tags'}
                  </span>
                </div>
                {seed.note ? <p className="seed-note">{seed.note}</p> : null}
                <div className="seed-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setView('focus')
                      handleStartFocus(seed.id)
                    }}
                  >
                    Focus
                  </button>
                  {seed.status === 'archived' ? (
                    <button type="button" onClick={() => handleRestore(seed.id)}>
                      Restore
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  const bedsById = useMemo(() => groupBy(state.beds, (bed) => bed.id), [state.beds])
  const selectedColor = selectedSeed ? bedsById[selectedSeed.bedId ?? '']?.[0]?.color ?? '#3a3a3a' : '#3a3a3a'

  return (
    <div className="app-shell">
      <aside className="rail">
        <h1>Lumen Garden</h1>
        <p className="helper">Operate your ideas, then explore constellations.</p>
        <nav aria-label="Primary">
          <button
            type="button"
            className={view === 'inbox' ? 'active' : ''}
            onClick={() => setView('inbox')}
          >
            Inbox
            <span className="nav-key">1</span>
          </button>
          <button
            type="button"
            className={view === 'explore' ? 'active' : ''}
            onClick={() => setView('explore')}
          >
            Constellation
            <span className="nav-key">2</span>
          </button>
          <button
            type="button"
            className={view === 'focus' ? 'active' : ''}
            onClick={() => setView('focus')}
          >
            Focus
            <span className="nav-key">3</span>
          </button>
          <button
            type="button"
            className={view === 'review' ? 'active' : ''}
            onClick={() => setView('review')}
          >
            Review
            <span className="nav-key">4</span>
          </button>
        </nav>

        <section className="rail-card">
          <h2>Beds</h2>
          {state.beds.length === 0 ? (
            <p className="helper">No beds yet. Add one to organize work.</p>
          ) : (
            <ul className="bed-list">
              {bedOptions.map((bed) => (
                <li key={bed.id}>
                  <button type="button" className="bed-item">
                    <span className="bed-swatch" style={{ '--bed-color': bed.color } as CSSProperties} />
                    <span>{bed.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="bed-form" onSubmit={handleCreateBed}>
            <label htmlFor="new-bed-name">New bed</label>
            <input
              id="new-bed-name"
              value={newBedName}
              onChange={(event) => setNewBedName(event.target.value)}
              placeholder="Design"
            />
            <label htmlFor="new-bed-intent">Intent</label>
            <input
              id="new-bed-intent"
              value={newBedIntent}
              onChange={(event) => setNewBedIntent(event.target.value)}
              placeholder="What this bed is for"
            />
            <label htmlFor="new-bed-color">Color</label>
            <select id="new-bed-color" value={newBedColor} onChange={(event) => setNewBedColor(event.target.value)}>
              <option value="#2f8f94">Mineral teal</option>
              <option value="#c08a52">Pollen gold</option>
              <option value="#ce6f67">Coral</option>
              <option value="#8f6e99">Clay purple</option>
            </select>
            <label htmlFor="new-bed-health">Health</label>
            <select
              id="new-bed-health"
              value={newBedHealth}
              onChange={(event) => setNewBedHealth(event.target.value as BedHealth)}
            >
              <option value="seedling">Seedling</option>
              <option value="growing">Growing</option>
              <option value="blooming">Blooming</option>
            </select>
            <button type="submit">Create bed</button>
          </form>
        </section>

        <section className="rail-card">
          <h2>Data</h2>
          <div className="seed-actions">
            <button type="button" onClick={handleExport}>
              Export JSON
            </button>
            <button type="button" onClick={clearDemoAction}>
              Clear demo data
            </button>
          </div>
          <form
            className="import-form"
            onSubmit={(event) => {
              event.preventDefault()
              handlePreviewImport()
            }}
          >
            <label htmlFor="import-input">Import JSON</label>
            <textarea
              id="import-input"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={7}
              placeholder='Paste exported garden JSON and click "Preview"'
            />
            <div className="seed-actions">
              <button type="submit">Preview import</button>
              {importPreview ? (
                <button type="button" onClick={handleClearImportPreview}>
                  Clear
                </button>
              ) : null}
            </div>
          </form>
          {importError ? <p className="error">{importError}</p> : null}
          {importPreview ? (
            <section className="import-preview">
              <h3>Import preview</h3>
              <p>
                schema v{importPreview.schemaVersion}: {importPreview.seeds} seeds, {importPreview.beds} beds,{' '}
                {importPreview.threads} threads, {importPreview.focusSessions} focus sessions
              </p>
              <button type="button" onClick={handleApplyImport}>
                Replace current garden
              </button>
            </section>
          ) : null}
          {undo ? (
            <section className="undo">
              <p>
                {undo.label} · {new Date(undo.createdAt).toLocaleTimeString()}{' '}
                <button
                  type="button"
                  onClick={() => {
                    REPOSITORY.undoLast()
                  }}
                >
                  Undo
                </button>
              </p>
            </section>
          ) : null}
        </section>
      </aside>

      <main className={`main ${selectedSeed?.source === 'demo' ? 'demo-highlight' : ''}`}>
        <header className="capture-bar">
          <form onSubmit={handleCapture}>
            <label htmlFor="capture-text">Idea fragment</label>
            <div className="capture-controls">
              <input
                ref={captureInputRef}
                id="capture-text"
                value={captureText}
                onChange={(event) => setCaptureText(event.target.value)}
                placeholder="Type a seed in under five seconds"
                autoComplete="off"
                required
              />
              <input
                value={captureNote}
                onChange={(event) => setCaptureNote(event.target.value)}
                placeholder="Optional context"
              />
              <input
                type="text"
                value={captureTags}
                onChange={(event) => setCaptureTags(event.target.value)}
                placeholder="Tags, comma separated"
              />
              <label htmlFor="capture-energy">Energy</label>
              <select
                id="capture-energy"
                value={captureEnergy}
                onChange={(event) => setCaptureEnergy(Number(event.target.value))}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
              <button type="submit">Capture</button>
            </div>
          </form>
        </header>

        <div
          className="workspace"
          style={
            selectedSeed
              ? ({
                  '--work-color':
                    bedsById[selectedSeed.bedId ?? '']?.[0]?.color ??
                    selectedColor,
                  '--paper-hue': selectedColor ? '#f8f4ee' : '#f6f2eb',
                } as CSSProperties)
              : undefined
          }
        >
          <header className="workspace-head">
            <h2>
              {view === 'inbox'
                ? 'Inbox'
                : view === 'explore'
                  ? 'Explore'
                  : view === 'focus'
                    ? 'Focus'
                    : 'Review'}
            </h2>
            <p className="helper">
              Keyboard: C capture, 1-4 switch views
            </p>
          </header>
          {view === 'inbox'
            ? renderInbox()
            : view === 'explore'
              ? renderExplore()
              : view === 'focus'
                ? renderFocus()
                : renderReview()}
        </div>
      </main>
    </div>
  )
}

export default App
