import { useRef } from 'react'
import type { Ref } from 'react'
import type { GardenState, Seed } from './domain/model'
import { describeGrowth } from './domain/growth'
import './GardenWorkspace.css'

type Props = {
  state: GardenState
  onOpen: (seed: Seed) => void
  onCapture: (text: string) => boolean
  onClearExamples: () => void
  draft: string
  onDraftChange: (value: string) => void
  headingRef: Ref<HTMLHeadingElement>
  selectedId: string
  onSelect: (id: string) => void
}

export default function GardenWorkspace({ state, onOpen, onCapture, onClearExamples, draft, onDraftChange, headingRef, selectedId, onSelect }: Props) {
  const captureRef = useRef<HTMLInputElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const active = state.focusSessions.find(item => item.status === 'running' || item.status === 'paused')
  const plants = state.seeds.filter(seed => seed.status !== 'archived').slice().sort((a, b) => {
    if (a.id === active?.seedId) return -1
    if (b.id === active?.seedId) return 1
    return b.updatedAt - a.updatedAt
  })
  const selected = plants.find(seed => seed.id === selectedId) ?? plants[0]
  const growth = selected ? describeGrowth(selected, state) : null
  const exampleCount = plants.filter(seed => seed.source === 'demo').length
  return <div className="garden-workspace">
    <section className="garden-scene" aria-label="Your idea garden">
      <div className="garden-arch" aria-hidden="true"><span /><span /><span /></div>
      <div className="garden-intro">
        <p className="garden-eyebrow"><span aria-hidden="true">*</span> A LITTLE CARE. A LITTLE POSSIBILITY.</p>
        <h1 ref={headingRef} tabIndex={-1}>Your ideas, growing.</h1>
        <p>A place to plant a thought, find a next step,<br className="desktop-break" /> and keep the evidence of what changed.</p>
      </div>
      <form className="garden-capture" onSubmit={event => {
        event.preventDefault()
        if (draft.trim() && onCapture(draft)) onDraftChange('')
      }}>
        <label className="sr-only" htmlFor="garden-new-idea">New idea</label>
        <input id="garden-new-idea" ref={captureRef} value={draft} onChange={event => onDraftChange(event.target.value)} placeholder="What would you like to grow?" autoComplete="off" required />
        <button type="submit" className="primary" aria-label="Add idea">Plant it <span aria-hidden="true">&#8599;</span></button>
      </form>
      <div className="garden-bed-heading">
        <div><h2>Your garden</h2><span>{plants.length - exampleCount} saved {plants.length - exampleCount === 1 ? 'idea' : 'ideas'}{exampleCount > 0 ? ` / ${exampleCount} examples` : ''}</span></div>
        <button type="button" className="garden-seed-button" onClick={() => captureRef.current?.focus()}>Seed a goal <span aria-hidden="true">+</span></button>
      </div>
      {exampleCount > 0 && <div className="garden-example-note"><span>Example ideas are illustrative. Your own ideas stay separate.</span><button type="button" onClick={onClearExamples}>Clear examples</button></div>}
      {plants.length ? <ul className="garden-plants" aria-label="Ideas as plants">{plants.map((seed, index) => {
        const plant = describeGrowth(seed, state)
        return <li key={seed.id}>
          <button type="button" className={`garden-plant ${seed.id === selected?.id ? 'is-selected' : ''}`} aria-label={`Inspect ${seed.text}`} aria-pressed={seed.id === selected?.id} onClick={() => { onSelect(seed.id); if (window.matchMedia?.('(max-width: 760px)').matches) inspectorRef.current?.focus() }}>
            <span className="plant-picture"><Plant stage={plant.stage} variant={index % 3} /><span className="plant-ground" /></span>
            <span className="plant-label"><strong>{seed.text}</strong><span className="plant-metadata"><span className={`growth-badge growth-${plant.stage}`}><span aria-hidden="true">{plant.stage === 'bloom' ? '*' : plant.stage === 'leaf' ? '+' : '.'}</span>{plant.label}</span>{seed.source === 'demo' && <span className="example-badge">Example</span>}</span></span>
          </button>
        </li>
      })}</ul> : <div className="garden-empty"><Plant stage="sprout" variant={0} /><h2>Every garden starts with one idea.</h2><p>Plant a thought above. It can be small, unfinished, or a little wild.</p></div>}
      <div className="garden-legend" aria-label="Growth guide"><span><i className="legend-seed" /> Seed</span><span><i className="legend-leaf" /> Growing</span><span><i className="legend-bloom" /> Progress recorded</span></div>
      <p className="garden-footnote">Growth follows recorded progress, not time spent.</p>
    </section>
    <section ref={inspectorRef} tabIndex={-1} className="garden-inspector" aria-label="Selected idea">
      {selected && growth ? <>
        <p className="garden-eyebrow">{selected.source === 'demo' ? 'Example idea' : 'SELECTED IDEA'}</p>
        <h2>{selected.text}</h2>
        <span className={`growth-badge growth-${growth.stage}`}>{growth.label}</span>
        <div className="inspector-section"><h3>Goal & context</h3><p>{selected.note || 'A new possibility. Add a little context when you are ready.'}</p></div>
        <div className="inspector-next"><span className="garden-eyebrow">ONE SMALL NEXT STEP</span><p>{selected.nextAction || 'Choose the smallest useful step for this idea.'}</p></div>
        <div className="inspector-section evidence-section"><div className="section-heading"><h3>Evidence</h3><span>{growth.outcomes.length} recorded {growth.outcomes.length === 1 ? 'outcome' : 'outcomes'}</span></div>
          {growth.outcomes.length ? <ol className="garden-evidence">{growth.outcomes.map(item => <li key={item.id}><span className="evidence-mark" aria-hidden="true">&para;</span><div><p>{item.outcome}</p><time dateTime={new Date(item.endedAt ?? item.startedAt).toISOString()}>{new Date(item.endedAt ?? item.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></div></li>)}</ol> : <div className="evidence-empty"><span aria-hidden="true">&para;</span><p>No progress recorded yet.</p><small>Save a result or decision after a focus session. It will take root here.</small></div>}
          <p className="evidence-disclaimer">{selected.source === 'demo' ? 'This is example notebook data. ' : ''}These are notes you recorded, not independent verification.</p>
        </div>
        <button type="button" className="primary garden-open" onClick={() => onOpen(selected)}>Open idea &amp; focus <span aria-hidden="true">&rarr;</span></button>
        <p className="inspector-local">You guide the work. No agent runs automatically.</p>
      </> : <div className="inspector-placeholder"><p className="garden-eyebrow">ROOM FOR SOMETHING NEW</p><h2>Small beginnings.<br />Real possibility.</h2><p>Select a plant to see its next step and recorded progress.</p><button type="button" onClick={() => captureRef.current?.focus()}>Plant your first idea</button></div>}
    </section>
  </div>
}

function Plant({ stage, variant }: { stage: string; variant: number }) {
  const full = stage !== 'sprout'
  return <svg className={`plant-art plant-variant-${variant}`} viewBox="0 0 240 230" aria-hidden="true" focusable="false">
    <ellipse cx="120" cy="211" rx="67" ry="12" fill="#4b5834" opacity=".12" />
    <g className="plant-foliage">
      <path d={full ? 'M120 165 Q110 110 123 49 M116 137 Q92 98 65 91 M120 119 Q145 80 170 64 M121 91 Q98 64 91 42' : 'M120 165 Q113 141 123 115'} fill="none" stroke="#56763a" strokeWidth="5" strokeLinecap="round" />
      <path d={full ? 'M117 144 C76 151 54 124 51 109 C88 100 111 111 117 144 M118 124 C135 92 177 101 188 112 C170 143 143 144 118 124 M117 101 C81 109 60 84 62 66 C97 62 116 76 117 101 M122 77 C122 46 146 28 166 30 C168 56 153 76 122 77 M121 65 C95 64 79 40 86 23 C111 27 126 43 121 65' : 'M118 145 C90 151 78 133 79 121 C102 116 116 127 118 145 M121 133 C123 110 146 105 157 111 C150 133 138 139 121 133'} fill="currentColor" />
      {full && <><path d="M117 144 62 117 M122 124 177 114 M118 100 71 73 M124 75 157 38" stroke="#c3cf83" strokeWidth="1.5" fill="none" opacity=".65" /><path d="M150 97 C159 73 183 73 196 80 C184 101 167 106 150 97 M88 110 C63 115 43 96 46 84 C70 82 86 94 88 110" fill="currentColor" opacity=".83" /></>}
      {stage === 'bloom' && <g transform={`translate(${variant === 1 ? 105 : 126} 62)`}><g fill={variant === 1 ? '#e8ba69' : '#dba2a0'}><ellipse cy="-13" rx="12" ry="21" /><ellipse cx="13" rx="21" ry="12" transform="rotate(22)" /><ellipse cy="13" rx="12" ry="21" /><ellipse cx="-13" rx="21" ry="12" transform="rotate(-22)" /></g><circle r="8" fill="#f4d985" /><circle r="3" fill="#9f7941" /></g>}
    </g>
    <path d="M76 161 L86 205 Q120 221 154 205 L164 161Z" fill={variant === 1 ? '#d8c9ad' : '#cb9677'} />
    <path d="M76 161 L86 205 Q99 212 109 213 L103 164Z" fill="#fff9df" opacity=".18" />
    <ellipse cx="120" cy="161" rx="45" ry="12" fill={variant === 1 ? '#e4d8c0' : '#e1b293'} />
    <ellipse cx="120" cy="160" rx="35" ry="7" fill="#75604c" />
    <path d="M113 193 Q99 191 99 181 Q112 179 116 190 M116 201 Q116 184 133 181 Q135 191 120 195" fill="none" stroke="#85654e" strokeWidth="2" opacity=".45" />
    <path d="M118 160 L118 147" stroke="#56763a" strokeWidth="5" />
  </svg>
}
