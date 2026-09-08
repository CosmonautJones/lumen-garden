import { useId, useState } from 'react'
import type { GardenState, Seed } from '../domain/model'
import type { GardenRepository } from '../domain/repository'
import { createHandoff, formatHandoff } from '../domain/handoff'

type Props = { seed: Seed; state: GardenState; repository: GardenRepository }

export function IdeaActions({ seed, state, repository }: Props) {
  const id = useId()
  const [panel, setPanel] = useState<'edit' | 'handoff' | null>(null)
  const [title, setTitle] = useState(seed.text)
  const [note, setNote] = useState(seed.note ?? '')
  const [nextAction, setNextAction] = useState(seed.nextAction ?? '')
  const [includeConnections, setIncludeConnections] = useState(false)
  const [notice, setNotice] = useState('')
  const packet = panel === 'handoff' ? createHandoff(state, seed.id, includeConnections) : null
  const preview = packet ? formatHandoff(packet) : ''

  function openEdit() {
    setTitle(seed.text)
    setNote(seed.note ?? '')
    setNextAction(seed.nextAction ?? '')
    setNotice('')
    setPanel('edit')
  }

  function download() {
    if (!packet) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'lumen-idea-handoff.json'
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Handoff downloaded. This is a read-only snapshot, not a full backup.')
  }

  return <div className="idea-tools">
    {seed.nextAction ? <p className="idea-next-action"><strong>Next action:</strong> {seed.nextAction}</p> : null}
    <div className="seed-actions">
      <button type="button" aria-expanded={panel === 'edit'} onClick={openEdit}>Edit idea</button>
      <button type="button" aria-expanded={panel === 'handoff'} onClick={() => { setPanel('handoff'); setIncludeConnections(false); setNotice('') }}>AI handoff</button>
    </div>
    {panel === 'edit' ? <form className="idea-editor" aria-label={`Edit ${seed.text}`} onSubmit={(event) => {
      event.preventDefault()
      try {
        repository.editSeed(seed.id, { text: title, note, nextAction })
        setPanel(null)
        setNotice('Idea saved on this device. You can undo this change below.')
      } catch (error) {
        setNotice(`Not saved: ${error instanceof Error ? error.message : String(error)}. Your draft is still here.`)
      }
    }}>
      <label htmlFor={`${id}-title`}>Idea title</label>
      <input id={`${id}-title`} value={title} onChange={event => setTitle(event.target.value)} required autoFocus />
      <label htmlFor={`${id}-note`}>Context / notes</label>
      <textarea id={`${id}-note`} rows={3} value={note} onChange={event => setNote(event.target.value)} />
      <label htmlFor={`${id}-action`}>Next action</label>
      <input id={`${id}-action`} value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder="One small step, e.g. draft three interview questions" />
      <div className="seed-actions">
        <button type="submit">Save idea</button>
        <button type="button" onClick={() => { setPanel(null); setNotice('Draft discarded; saved idea unchanged.') }}>Cancel</button>
      </div>
    </form> : null}
    {panel === 'handoff' ? <section className="handoff-panel" aria-label={`AI handoff for ${seed.text}`}>
      <h4>Take this idea to your assistant</h4>
      <p>Preview, then copy into ChatGPT, Claude or your agent. Nothing is sent automatically. Review the response, then start a focus session on this idea and save the useful result as progress.</p>
      <label className="connection-choice"><input type="checkbox" checked={includeConnections} onChange={event => setIncludeConnections(event.target.checked)} /> Include connected idea titles</label>
      <p className="helper">Includes this idea, its project goal and completed outcomes. Other ideas stay private unless you include their connected titles.</p>
      <label htmlFor={`${id}-preview`}>Handoff preview</label>
      <textarea id={`${id}-preview`} value={preview} readOnly rows={10} />
      <div className="seed-actions">
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(preview); setNotice('Handoff copied. Paste it into your assistant.') }
          catch { setNotice('Clipboard unavailable. Select the preview text and copy it manually, or download JSON.') }
        }}>Copy handoff</button>
        <button type="button" onClick={download}>Download JSON handoff</button>
        <button type="button" onClick={() => setPanel(null)}>Close handoff</button>
      </div>
    </section> : null}
    {notice ? <p role="status" className="helper">{notice}</p> : null}
  </div>
}
