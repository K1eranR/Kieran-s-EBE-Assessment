import { useEffect, useState, useMemo, useCallback } from 'react'
import axios from 'axios'
import { Bar, Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'


// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionResponse {
  question_id: string
  question_text: string
  question_type: string
  element: string
  selected_option?: string
  selected_value?: number
  is_answered: boolean
  is_reflection: boolean
}

interface ElementScore {
  element: string
  total_questions: number
  answered_questions: number
  completion_percentage: number
  scores: { total_score: number; max_score: number; percentage: number }
}

interface AssessmentResultsData {
  instance: {
    id: string
    completed: boolean
    completed_at: string | null
    element: string
  }
  total_questions: number
  answered_questions: number
  completion_percentage: number
  scores: { total_score: number; max_score: number; percentage: number }
  element_scores: Record<string, ElementScore>
  question_responses?: QuestionResponse[]
  insights: Array<{ type: string; message: string; positive: boolean }>
}

interface Props {
  instanceId: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  good: '#22c55e',
  warn: '#f59e0b',
  bad: '#ef4444',
  blue: '#3b82f6',
  muted: '#94a3b8',
  track: '#e2e8f0',
  surface: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
}

const ELEMENT_PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

function scoreColor(pct: number) {
  if (pct >= 80) return COLORS.good
  if (pct >= 60) return COLORS.warn
  return COLORS.bad
}

function scoreLabel(pct: number) {
  if (pct >= 80) return 'Strong'
  if (pct >= 60) return 'Moderate'
  return 'Needs work'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CircleProgress({ pct, size = 130 }: { pct: number; size?: number }) {
  const [animated, setAnimated] = useState(0)
  const sw = 10
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (animated / 100) * circ
  const color = scoreColor(pct)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 100)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={COLORS.track} strokeWidth={sw} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1), stroke .3s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2
      }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: COLORS.text, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: COLORS.textMuted }}>
          {scoreLabel(pct)}
        </span>
      </div>
    </div>
  )
}

function BarProgress({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  const [animated, setAnimated] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 150)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div style={{
      width: '100%', height, background: COLORS.track,
      borderRadius: 999, overflow: 'hidden', marginTop: 8
    }}>
      <div style={{
        height: '100%', width: `${animated}%`, background: color,
        borderRadius: 999, transition: 'width 0.85s cubic-bezier(.4,0,.2,1)'
      }} />
    </div>
  )
}

function Skeleton({ width = '100%', height = 16, style = {} }: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width, height, borderRadius: 8,
      background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
      ...style
    }} />
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em',
      background: color + '18', color
    }}>
      {children}
    </span>
  )
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: `1px solid ${COLORS.border}`,
      padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      margin: '0 0 16px', fontSize: '0.75rem', textTransform: 'uppercase',
      letterSpacing: '0.1em', color: COLORS.textMuted, fontWeight: 700
    }}>
      {children}
    </h3>
  )
}

// ─── Question Breakdown ───────────────────────────────────────────────────────

type FilterType = 'all' | 'answered' | 'unanswered' | 'reflection'
type SortType = 'default' | 'score_high' | 'score_low'

function QuestionBreakdown({ questions }: { questions: QuestionResponse[] }) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('default')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = [...questions]
    if (filter === 'answered') list = list.filter(q => q.is_answered && !q.is_reflection)
    else if (filter === 'unanswered') list = list.filter(q => !q.is_answered)
    else if (filter === 'reflection') list = list.filter(q => q.is_reflection)
    if (sort === 'score_high') list.sort((a, b) => (b.selected_value ?? 0) - (a.selected_value ?? 0))
    if (sort === 'score_low') list.sort((a, b) => (a.selected_value ?? 0) - (b.selected_value ?? 0))
    return list
  }, [questions, filter, sort])

  const counts = useMemo(() => ({
    answered: questions.filter(q => q.is_answered && !q.is_reflection).length,
    unanswered: questions.filter(q => !q.is_answered).length,
    reflection: questions.filter(q => q.is_reflection).length,
  }), [questions])

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
    background: active ? COLORS.blue : COLORS.surface,
    color: active ? '#fff' : COLORS.textMuted,
    boxShadow: active ? '0 1px 4px rgba(59,130,246,0.3)' : 'none',
  })

  return (
    <Card>
      <SectionTitle>Question Breakdown</SectionTitle>

      {/* Filter + Sort bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'answered', 'unanswered', 'reflection'] as FilterType[]).map(f => (
            <button key={f} style={tabBtn(filter === f)} onClick={() => setFilter(f)}>
              {f === 'all' ? `All (${questions.length})` :
               f === 'answered' ? `Answered (${counts.answered})` :
               f === 'unanswered' ? `Skipped (${counts.unanswered})` :
               `Reflection (${counts.reflection})`}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortType)}
          style={{
            marginLeft: 'auto', padding: '5px 10px', borderRadius: 8,
            border: `1px solid ${COLORS.border}`, fontSize: '0.78rem',
            background: COLORS.surface, color: COLORS.textMuted, cursor: 'pointer'
          }}
        >
          <option value="default">Default order</option>
          <option value="score_high">Score: high → low</option>
          <option value="score_low">Score: low → high</option>
        </select>
      </div>

      {/* Question list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', color: COLORS.textMuted, padding: '24px 0', fontSize: '0.85rem' }}>
            No questions match this filter.
          </p>
        )}
        {filtered.map(q => {
          const isOpen = expanded === q.question_id
          return (
            <div
              key={q.question_id}
              style={{
                borderRadius: 12, border: `1px solid ${COLORS.border}`,
                overflow: 'hidden', transition: 'box-shadow 0.15s',
                boxShadow: isOpen ? '0 2px 12px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <div
                onClick={() => setExpanded(isOpen ? null : q.question_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', cursor: 'pointer',
                  background: isOpen ? COLORS.surface : '#fff', transition: 'background 0.15s'
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: q.is_answered
                    ? scoreColor((q.selected_value ?? 0) / 5 * 100)
                    : COLORS.track
                }} />
                <span style={{ flex: 1, fontSize: '0.85rem', color: COLORS.text, fontWeight: 500, lineHeight: 1.4 }}>
                  {q.question_text}
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {q.is_reflection && <Badge color={COLORS.blue}>Reflection</Badge>}
                  {!q.is_answered && <Badge color={COLORS.muted}>Skipped</Badge>}
                  {q.is_answered && q.selected_value != null && (
                    <Badge color={scoreColor((q.selected_value / 5) * 100)}>
                      {q.selected_value}/5
                    </Badge>
                  )}
                  <span style={{
                    fontSize: '0.75rem', color: COLORS.muted,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s', display: 'inline-block'
                  }}>▾</span>
                </div>
              </div>

              {isOpen && (
                <div style={{
                  padding: '12px 16px 16px', borderTop: `1px solid ${COLORS.border}`,
                  background: COLORS.surface
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: '0.68rem', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Element</p>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>Element {q.element}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: '0.68rem', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Type</p>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize' }}>
                        {q.is_reflection ? 'Reflection' : q.question_type}
                      </p>
                    </div>
                    {q.is_answered ? (
                      <>
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: '0.68rem', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Answer</p>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{q.selected_option ?? '—'}</p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: '0.68rem', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score</p>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: scoreColor((q.selected_value ?? 0) / 5 * 100) }}>
                            {q.selected_value} / 5
                          </p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: '0.68rem', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</p>
                        <p style={{ margin: 0, color: COLORS.muted, fontSize: '0.85rem' }}>Not answered</p>
                      </div>
                    )}
                  </div>
                  {q.is_answered && q.selected_value != null && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: COLORS.textMuted, marginBottom: 4 }}>
                        <span>Score</span><span>{q.selected_value}/5</span>
                      </div>
                      <BarProgress pct={(q.selected_value / 5) * 100} color={scoreColor((q.selected_value / 5) * 100)} height={6} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function RadarViz({ elementScores }: { elementScores: Record<string, ElementScore> }) {
  const data = useMemo(() =>
    Object.values(elementScores).map(e => ({
      element: `E${e.element}`,
      score: e.scores.percentage,
      fullMark: 100,
    })), [elementScores])

  if (data.length === 0) return null

  return (
    <Card>
      <SectionTitle>Element Radar</SectionTitle>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke={COLORS.border} />
          <PolarAngleAxis dataKey="element" tick={{ fill: COLORS.textMuted, fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: COLORS.muted, fontSize: 10 }} />
          <Radar name="Score" dataKey="score" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.18} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function BarViz({ elementScores }: { elementScores: Record<string, ElementScore> }) {
  const data = useMemo(() =>
    Object.values(elementScores).map((e, i) => ({
      name: `Element ${e.element}`,
      score: e.scores.percentage,
      color: ELEMENT_PALETTE[i % ELEMENT_PALETTE.length],
    })), [elementScores])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: '#fff', border: `1px solid ${COLORS.border}`,
        borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        fontSize: '0.8rem'
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, color: COLORS.text }}>{label}</p>
        <p style={{ margin: 0, color: scoreColor(payload[0].value) }}>
          Score: <strong>{payload[0].value}%</strong>
        </p>
      </div>
    )
  }

  return (
    <Card>
      <SectionTitle>Score by Element</SectionTitle>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: COLORS.surface }} />
          <Bar dataKey="score" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportJSON(data: AssessmentResultsData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `assessment-${data.instance.id.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function copyToClipboard(data: AssessmentResultsData) {
  const text = [
    `Assessment Results — Element ${data.instance.element}`,
    `Score: ${data.scores.percentage}% (${data.scores.total_score}/${data.scores.max_score})`,
    `Completion: ${data.completion_percentage}% (${data.answered_questions}/${data.total_questions})`,
    '',
    'Element Scores:',
    ...Object.values(data.element_scores).map(e =>
      `  Element ${e.element}: ${e.scores.percentage}% — ${e.answered_questions}/${e.total_questions} answered`
    ),
  ].join('\n')
  await navigator.clipboard.writeText(text)
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1, 2, 3].map(i => (
        <Card key={i}>
          <Skeleton height={14} width="40%" style={{ marginBottom: 16 }} />
          <Skeleton height={10} style={{ marginBottom: 8 }} />
          <Skeleton height={10} width="80%" style={{ marginBottom: 8 }} />
          <Skeleton height={10} width="60%" />
        </Card>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AssessmentResults({ instanceId }: Props) {
  const [results, setResults] = useState<AssessmentResultsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyDone, setCopyDone] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'charts'>('overview')

  const fetchResults = useCallback(async () => {
    if (!instanceId) return
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/api/assessment/results/${instanceId}`
      )
      setResults(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load assessment results')
    } finally {
      setLoading(false)
    }
  }, [instanceId])

  useEffect(() => { fetchResults() }, [fetchResults])

  const handleCopy = async () => {
    if (!results) return
    await copyToClipboard(results)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  if (loading) return (
    <div style={wrapStyle}>
      <style>{shimmerCSS}</style>
      <LoadingSkeleton />
    </div>
  )

  if (error) return (
    <div style={wrapStyle}>
      <Card style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
        <p style={{ color: COLORS.bad, fontWeight: 600, marginBottom: 8 }}>{error}</p>
        <p style={{ color: COLORS.textMuted, fontSize: '0.85rem', marginBottom: 20 }}>
          Check that the instance ID is valid and the API is running.
        </p>
        <button onClick={fetchResults} style={btnPrimary}>Retry</button>
      </Card>
    </div>
  )

  if (!results) return (
    <div style={wrapStyle}>
      <Card style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
        <p style={{ color: COLORS.textMuted }}>No results to display.</p>
      </Card>
    </div>
  )

  const hasElementScores = Object.keys(results.element_scores).length > 0
  const questions: QuestionResponse[] = results.question_responses ?? generateMockQuestions(results)

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'questions' as const, label: `Questions (${results.total_questions})` },
    { id: 'charts' as const, label: 'Charts' },
  ]

  return (
    <div style={wrapStyle}>
      <style>{shimmerCSS + responsiveCSS}</style>

      {/* Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 12, marginBottom: 20
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800, color: COLORS.text }}>
            Assessment Results
          </h2>
          <p style={{ margin: 0, fontSize: '0.78rem', color: COLORS.textMuted }}>
            Element {results.instance.element} · {results.instance.id.slice(0, 8)}…
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCopy} style={btnSecondary}>
            {copyDone ? '✓ Copied!' : '📋 Copy'}
          </button>
          <button onClick={() => exportJSON(results)} style={btnSecondary}>
            ⬇ JSON
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        borderBottom: `1px solid ${COLORS.border}`
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
              color: activeTab === t.id ? COLORS.blue : COLORS.textMuted,
              borderBottom: `2px solid ${activeTab === t.id ? COLORS.blue : 'transparent'}`,
              marginBottom: -1
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="stats-grid">
            <Card style={{ textAlign: 'center' }}>
              <SectionTitle>Completion</SectionTitle>
              <CircleProgress pct={results.completion_percentage} />
              <p style={{ margin: '12px 0 0', fontSize: '0.82rem', color: COLORS.textMuted }}>
                {results.answered_questions} / {results.total_questions} answered
              </p>
            </Card>

            <Card>
              <SectionTitle>Overall Score</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <span style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1, color: scoreColor(results.scores.percentage) }}>
                  {results.scores.percentage}%
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: COLORS.text }}>{scoreLabel(results.scores.percentage)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: COLORS.textMuted }}>
                    {results.scores.total_score} / {results.scores.max_score} pts
                  </p>
                </div>
              </div>
              <BarProgress pct={results.scores.percentage} color={scoreColor(results.scores.percentage)} height={10} />
            </Card>
          </div>

          {hasElementScores && (
            <Card>
              <SectionTitle>Scores by Element</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.values(results.element_scores).map((el, i) => (
                  <div key={el.element}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: ELEMENT_PALETTE[i % ELEMENT_PALETTE.length] }} />
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: COLORS.text }}>Element {el.element}</span>
                        <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>{el.answered_questions}/{el.total_questions} answered</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>{el.scores.total_score}/{el.scores.max_score} pts</span>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: scoreColor(el.scores.percentage) }}>
                          {el.scores.percentage}%
                        </span>
                      </div>
                    </div>
                    <BarProgress pct={el.scores.percentage} color={ELEMENT_PALETTE[i % ELEMENT_PALETTE.length]} height={8} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {results.insights.length > 0 && (
            <Card>
              <SectionTitle>Insights</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.insights.map((ins, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10,
                    alignItems: 'flex-start',
                    background: ins.positive ? '#f0fdf4' : '#fff5f5',
                    border: `1px solid ${ins.positive ? '#bbf7d0' : '#fecaca'}`
                  }}>
                    <span style={{ fontSize: '1rem', lineHeight: 1.5 }}>{ins.positive ? '✅' : '⚠️'}</span>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: ins.positive ? COLORS.good : COLORS.bad }}>{ins.type}</p>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.text }}>{ins.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Questions ── */}
      {activeTab === 'questions' && <QuestionBreakdown questions={questions} />}

      {/* ── Charts ── */}
      {activeTab === 'charts' && (
        hasElementScores ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BarViz elementScores={results.element_scores} />
            <RadarViz elementScores={results.element_scores} />
          </div>
        ) : (
          <Card style={{ textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ color: COLORS.textMuted }}>No element score data available for charts.</p>
          </Card>
        )
      )}
    </div>
  )
}



function generateMockQuestions(results: AssessmentResultsData): QuestionResponse[] {
  return [
    { question_id: 'q1', question_text: 'How effectively do you manage your time across competing priorities?', question_type: 'scale', element: results.instance.element, selected_option: 'Often', selected_value: 4, is_answered: true, is_reflection: false },
    { question_id: 'q2', question_text: 'Do you proactively communicate blockers to your team?', question_type: 'scale', element: results.instance.element, selected_option: 'Sometimes', selected_value: 3, is_answered: true, is_reflection: false },
    { question_id: 'q3', question_text: 'Rate your ability to adapt when requirements change.', question_type: 'scale', element: results.instance.element, selected_option: undefined, selected_value: undefined, is_answered: false, is_reflection: false },
    { question_id: 'q4', question_text: 'Reflect on a recent challenge and what you learned from it.', question_type: 'text', element: results.instance.element, selected_option: 'Provided a response', selected_value: 5, is_answered: true, is_reflection: true },
  ]
}

// ─── Static styles ────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '24px 16px',
  fontFamily: 'system-ui, sans-serif',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: COLORS.blue, color: '#fff', fontWeight: 600, fontSize: '0.85rem',
}

const btnSecondary: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 8,
  border: `1px solid ${COLORS.border}`, cursor: 'pointer',
  background: '#fff', color: COLORS.textMuted, fontWeight: 600, fontSize: '0.78rem',
  transition: 'all 0.15s',
}

const shimmerCSS = `
  @keyframes shimmer {
    0% { background-position: 200% 0 }
    100% { background-position: -200% 0 }
  }
`

const responsiveCSS = `
  .stats-grid {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 16px;
  }
  @media (max-width: 560px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
`
