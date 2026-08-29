import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { relationLabel, selectNextSeed } from './domain/model'
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


const DEFAULT_REPOSITORY = new GardenRepository(globalThis?.localStorage, {
  storageKey: 'lumen-garden:local-repository',
})

type AppProps = {
  repository?: GardenRepository
}

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

function App({ repository = DEFAULT_REPOSITORY }: AppProps) {
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
  const [focusSeedId, setFocusSeedId] = useState('')
  const [newBedName, setNewBedName] = useState('')
  const [newBedIntent, setNewBedIntent] = useState('')
  const [newBedColor, setNewBedColor] = useState('#2f8f94')
  const [newBedHealth, setNewBedHealth] = useState<BedHealth>('seedling')
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [actionError, setActionError] = useState('')
  const [dataNotice, setDataNotice] = useState('')
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const captureInputRef = useRef<HTMLInputElement>(null)
  const commandCloseRef = useRef<HTMLButtonElement>(null)
  const commandTriggerRef = useRef<HTMLButtonElement>(null)
  const commandReturnFocusRef = useRef<HTMLElement | null>(null)

  const state = useSyncExternalStore(
    (listener) => repository.subscribe(listener),
    () => repository.getSnapshot(),
    () => repository.getSnapshot(),
  )
  const undo = repository.getUndoState()
  const storageIssue = repository.getStorageIssue()
  const activeSession = repository.getActiveFocusSession()
  const activeSessionId = activeSession?.id
  const selectedSeed = useMemo(
    () => state.seeds.find((seed) => seed.id === selectedSeedId) ?? state.seeds[0] ?? null,
    [state.seeds, selectedSeedId],
  )
  const workspaceMode = view === 'explore' ? 'Explore' : 'Operate'
  const workspaceName = view === 'inbox' ? 'Inbox' : view === 'explore' ? 'Constellation' : view === 'focus' ? 'Focus' : 'Review'

  useEffect(() => {
    if (view === 'focus' && activeSessionId) {
      const interval = window.setInterval(() => {
        setNowTick(Date.now())
      }, 1000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [view, activeSessionId])

  useEffect(() => {
    if (isCommandPaletteOpen) {
      commandCloseRef.current?.focus()
    }
  }, [isCommandPaletteOpen])

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent): void => {
      if (event.defaultPrevented) return
      if (event.key === 'Escape' && isCommandPaletteOpen) {
        event.preventDefault()
        closeCommandPalette()
        return
      }
      const target = event.target as HTMLElement
      const activeTag = target?.tagName?.toLowerCase()
      const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || target?.isContentEditable
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        openCommandPalette()
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
  }, [isCommandPaletteOpen])

  const inboxSeeds = useMemo(() => state.seeds.filter((seed) => seed.status === 'inbox'), [state.seeds])

  const bedOptions = useMemo(() => state.beds.slice().sort(byRecent), [state.beds])

  const reviewedSeeds = useMemo(() => {
    const cutoffMs = filterRecency === 'all' ? 0 : nowTick - Number(filterRecency) * 24 * 60 * 60 * 1000
    return state.seeds
      .filter((seed) => (filterStatus === 'all' ? true : seed.status === filterStatus))
      .filter((seed) => (filterBed === 'all' ? true : seed.bedId === filterBed))
      .filter((seed) => (filterTag.length === 0 ? true : seed.tags.includes(filterTag.trim().toLowerCase())))
      .filter((seed) => (filterRecency === 'all' ? true : seed.updatedAt >= cutoffMs))
      .sort(byRecent)
  }, [filterBed, filterRecency, filterStatus, filterTag, nowTick, state.seeds])

  const nextSeed = useMemo(() => selectNextSeed(state.seeds), [state.seeds])

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
    runRepositoryAction(() => repository.clearDemoData())
  }

  function runRepositoryAction(action: () => void): boolean {
    try {
      action()
      setActionError('')
      return true
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      const isStorageFailure = /quota|storage|security/i.test(detail)
      setActionError(
        isStorageFailure
          ? `Could not save this change locally. ${detail}. Your accepted garden is unchanged.`
          : `Could not complete this change. ${detail}`,
      )
      return false
    }
  }

  function handleCapture(event: FormEvent) {
    event.preventDefault()
    if (captureText.trim().length < 1) return

    const tags = captureTags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)

    const captured = runRepositoryAction(() => {
      repository.captureSeed({
        text: captureText,
        note: captureNote || undefined,
        energy: captureEnergy,
        tags,
      })
    })

    if (!captured) {
      return
    }

    setCaptureText('')
    setCaptureNote('')
    setCaptureTags('')
    setCaptureEnergy(3)
    captureInputRef.current?.focus()
  }

  function focusCapture() {
    closeCommandPalette(false)
    captureInputRef.current?.focus()
  }

  function openCommandPalette() {
    commandReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : commandTriggerRef.current
    setIsCommandPaletteOpen(true)
  }

  function closeCommandPalette(restoreFocus = true) {
    setIsCommandPaletteOpen(false)
    if (restoreFocus) {
      const focusTarget = commandReturnFocusRef.current ?? commandTriggerRef.current
      focusTarget?.focus()
    }
  }

  function handleCommandPaletteKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return

    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
    if (buttons.length === 0) return

    const firstButton = buttons[0]
    const lastButton = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault()
      lastButton.focus()
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault()
      firstButton.focus()
    }
  }

  function handleArchive(seedId: string) {
    runRepositoryAction(() => repository.archiveSeed(seedId))
  }

  function handleRestore(seedId: string) {
    runRepositoryAction(() => repository.restoreSeed(seedId))
  }

  function handleMoveToBed(seedId: string, bedId: string) {
    runRepositoryAction(() => repository.moveSeedToBed(seedId, bedId))
  }

  function handleStartFocus(seedId: string) {
    if (runRepositoryAction(() => repository.startFocusSession(seedId, focusDuration))) {
      setView('focus')
    }
  }

  function handleClearImportPreview() {
    setImportText('')
    setImportError('')
    setImportPreview(null)
    setDataNotice('Import preview cleared.')
  }

  function handleImportTextChange(nextText: string) {
    setImportText(nextText)
    if (importPreview) {
      setImportPreview(null)
      setImportError('')
      setDataNotice('Preview cleared because the import JSON changed.')
    }
  }

  function handlePreviewImport() {
    try {
      const next = repository.previewImport(importText)
      setImportError('')
      setImportPreview(next)
      setDataNotice('Import preview ready. Review the exact counts before replacing your garden.')
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
      repository.importData(importText)
      handleClearImportPreview()
    } catch (error) {
      setImportError(`Import was not applied. ${(error as Error).message} Your current garden is unchanged.`)
    }
  }

  function downloadFile(payload: string, fileName: string, mimeType = 'application/json') {
    const blob = new Blob([payload], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleExport() {
    runRepositoryAction(() => downloadFile(repository.exportData(), 'lumen-garden-export.json'))
  }

  function handleExportRecovery() {
    const recovery = repository.getRecoveryData()
    if (!recovery) {
      setActionError('A recovery copy is not available in this browser.')
      return
    }
    runRepositoryAction(() => downloadFile(recovery, 'lumen-garden-recovery.json', 'text/plain'))
  }

  function handleCreateBed(event: FormEvent) {
    event.preventDefault()
    if (newBedName.trim().length === 0) return
    const created = runRepositoryAction(() => {
      repository.createBed({
        name: newBedName,
        intent: newBedIntent || 'No intent yet',
        color: newBedColor,
        health: newBedHealth,
      })
    })
    if (!created) {
      return
    }
    setNewBedName('')
    setNewBedIntent('')
  }

  function renderViewButton(nextView: MainView, label: string, shortcut: string) {
    return (
      <button
        type="button"
        className={view === nextView ? 'active' : ''}
        onClick={() => setView(nextView)}
        aria-current={view === nextView ? 'page' : undefined}
        aria-label={label}
      >
        <span>{label}</span>
        <kbd aria-hidden="true">{shortcut}</kbd>
      </button>
    )
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
            <button type="button" className="empty-action" onClick={focusCapture}>
              Capture a seed
            </button>
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
            {state.seeds.length === 0 ? (
              <div className="empty">
                <p>Nothing is in this constellation yet.</p>
                <p>Capture a seed, then return here to make a connection.</p>
                <button type="button" className="empty-action" onClick={focusCapture}>
                  Capture a seed
                </button>
              </div>
            ) : (
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
                        aria-pressed={selectedSeed?.id === seed.id}
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
            )}
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
                              onClick={() => runRepositoryAction(() => repository.removeThread(thread.id))}
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
                    if (runRepositoryAction(() => repository.addThread(selectedSeed.id, threadTargetId, threadRelation))) {
                      setThreadTargetId('')
                    }
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
                  <button type="submit" disabled={threadTargetId.length === 0}>Add thread</button>
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
              value={activeSession.outcome ?? ''}
              onChange={(event) => runRepositoryAction(() => repository.setFocusOutcome(activeSession.id, event.target.value))}
            />
            <div className="seed-actions">
              {activeSession.status === 'running' ? (
                <button type="button" onClick={() => runRepositoryAction(() => repository.pauseFocusSession(activeSession.id))}>
                  Pause
                </button>
              ) : (
                <button type="button" onClick={() => runRepositoryAction(() => repository.resumeFocusSession(activeSession.id))}>
                  Resume
                </button>
              )}
              <button type="button" onClick={() => runRepositoryAction(() => repository.completeFocusSession(activeSession.id))}>
                Complete
              </button>
              <button type="button" onClick={() => runRepositoryAction(() => repository.abandonFocusSession(activeSession.id))}>
                Abandon
              </button>
            </div>
          </article>
        ) : (
          <article className="focus-card">
            <h3>Start focus</h3>
            <p className="helper">Pick one seed and choose a duration.</p>
            {candidates.length === 0 ? (
              <div className="empty">
                <p>Capture a seed to begin a focus session.</p>
                <button type="button" className="empty-action" onClick={focusCapture}>
                  Capture a seed
                </button>
              </div>
            ) : (
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
                <select
                  id="focus-seed"
                  value={focusSeedId}
                  onChange={(event) => setFocusSeedId(event.target.value)}
                >
                  <option value="">Choose seed</option>
                  {candidates.map((seed) => (
                    <option key={seed.id} value={seed.id}>
                      {seed.text}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="seed-actions">
              <button
                type="button"
                disabled={focusSeedId.length === 0}
                onClick={() => {
                  if (focusSeedId.length > 0) {
                    if (runRepositoryAction(() => repository.startFocusSession(focusSeedId, focusDuration))) {
                      setFocusSeedId('')
                    }
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
        {nextSeed ? (
          <section className="next-action" aria-labelledby="next-action-heading">
            <div>
              <p className="eyebrow">One concrete next action</p>
              <h3 id="next-action-heading">Next to tend</h3>
              <p className="next-action-seed">{nextSeed.text}</p>
              <p className="helper">
                {nextSeed.status === 'active' ? 'Active work is ready to move.' : 'Your inbox is ready for its first pass.'}{' '}
                Energy {nextSeed.energy}/5.
              </p>
            </div>
            <button type="button" className="next-action-button" onClick={() => handleStartFocus(nextSeed.id)}>
              Start a focus block
            </button>
          </section>
        ) : (
          <div className="empty">
            <p>No available seed needs attention right now.</p>
            <p>Finish the current focus block or capture a fresh idea when it arrives.</p>
          </div>
        )}
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

  return (
    <div className="app-shell">
      <aside className="rail">
        <h1>Lumen Garden</h1>
        <p className="helper">Operate your ideas, then explore constellations.</p>
        <div className="navigation-cluster">
          <nav aria-label="Operate">
            <p className="navigation-label">Operate</p>
            {renderViewButton('inbox', 'Inbox', '1')}
            {renderViewButton('focus', 'Focus', '3')}
            {renderViewButton('review', 'Review', '4')}
          </nav>
          <nav aria-label="Explore">
            <p className="navigation-label">Explore</p>
            {renderViewButton('explore', 'Constellation', '2')}
          </nav>
        </div>

        <section className="rail-card">
          <h2>Beds</h2>
          {state.beds.length === 0 ? (
            <p className="helper">No beds yet. Add one to organize work.</p>
          ) : (
            <ul className="bed-list">
              {bedOptions.map((bed) => (
                <li key={bed.id}>
                  <button
                    type="button"
                    className="bed-item"
                    onClick={() => {
                      setFilterBed(bed.id)
                      setView('review')
                    }}
                  >
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
              onChange={(event) => handleImportTextChange(event.target.value)}
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
          {storageIssue ? (
            <section className="data-warning" role="alert">
              <h3>{storageIssue.kind === 'read' ? 'Local data needs recovery' : 'Local data was not saved'}</h3>
              {storageIssue.kind === 'read' ? (
                <p>Could not read your previous local garden. Its original bytes are preserved until you export a recovery copy.</p>
              ) : (
                <p>Could not save the latest local change. Export the accepted garden before trying again.</p>
              )}
              {storageIssue.recoveryAvailable ? (
                <button type="button" onClick={handleExportRecovery}>Export recovery copy</button>
              ) : null}
            </section>
          ) : null}
          {importError ? <p className="error" role="alert">{importError}</p> : null}
          {actionError ? <p className="error" role="alert">{actionError}</p> : null}
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
                    runRepositoryAction(() => repository.undoLast())
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
                aria-label="Optional note"
                placeholder="Optional context"
              />
              <input
                type="text"
                value={captureTags}
                onChange={(event) => setCaptureTags(event.target.value)}
                aria-label="Tags"
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
          <button
            type="button"
            className="command-trigger"
            ref={commandTriggerRef}
            onClick={openCommandPalette}
            aria-haspopup="dialog"
            aria-expanded={isCommandPaletteOpen}
          >
            Commands <kbd>?</kbd>
          </button>
        </header>
        <nav className="mobile-primary-navigation" aria-label="Primary views">
          <div className="mobile-view-group">
            <p className="navigation-label">Operate</p>
            <div className="mobile-operate-actions">
              {renderViewButton('inbox', 'Inbox', '1')}
              {renderViewButton('focus', 'Focus', '3')}
              {renderViewButton('review', 'Review', '4')}
            </div>
          </div>
          <div className="mobile-view-group">
            <p className="navigation-label">Explore</p>
            {renderViewButton('explore', 'Constellation', '2')}
          </div>
        </nav>

        <div className="workspace">
          <header className="workspace-head">
            <p className="eyebrow">{workspaceMode}</p>
            <p className="helper">
              Keyboard: C capture, 1-4 switch views
            </p>
          </header>
          <p className="sr-only" role="status">{workspaceMode}: {workspaceName}{dataNotice ? `. ${dataNotice}` : ''}</p>
          {view === 'inbox'
            ? renderInbox()
            : view === 'explore'
              ? renderExplore()
              : view === 'focus'
                ? renderFocus()
              : renderReview()}
        </div>
      </main>
      {isCommandPaletteOpen ? (
        <div className="command-backdrop" onMouseDown={() => closeCommandPalette()}>
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-menu-title"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={handleCommandPaletteKeyDown}
          >
            <div className="command-palette-head">
              <div>
                <p className="eyebrow">Keyboard command menu</p>
                <h2 id="command-menu-title">Command menu</h2>
              </div>
              <button ref={commandCloseRef} type="button" onClick={() => closeCommandPalette()} aria-label="Close command menu">
                Close
              </button>
            </div>
            <div className="command-grid">
              <button type="button" onClick={focusCapture}>
                <span>Focus capture</span>
                <kbd>C</kbd>
              </button>
              <button type="button" onClick={() => { setView('inbox'); closeCommandPalette() }}>
                <span>Open inbox</span>
                <kbd>1</kbd>
              </button>
              <button type="button" onClick={() => { setView('explore'); closeCommandPalette() }}>
                <span>Open constellation</span>
                <kbd>2</kbd>
              </button>
              <button type="button" onClick={() => { setView('focus'); closeCommandPalette() }}>
                <span>Open focus</span>
                <kbd>3</kbd>
              </button>
              <button type="button" onClick={() => { setView('review'); closeCommandPalette() }}>
                <span>Open review</span>
                <kbd>4</kbd>
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
