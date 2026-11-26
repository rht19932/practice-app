'use client';

// Preview images use temporary blob URLs created from local file inputs.
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';

type Tag = { key: string; value: string };
type Study = { id: string; name: string; description: string; tags: Tag[] };
type Shot = { id: string; stage: string; time: string; tags: Tag[]; seed: number; url?: string };
type Occurrence = {
  id: string;
  studyId: string;
  title: string;
  date: string;
  notes: string;
  tags: Tag[];
  shots: Shot[];
};
type Scope = 'study' | 'occurrence' | 'image';
type Rule = {
  id: string;
  type: 'rule';
  scope: Scope;
  key: string;
  value: string;
  test: 'is' | 'is-not' | 'has';
};
type Group = { id: string; type: 'group'; join: 'and' | 'or'; children: Filter[] };
type Filter = Rule | Group;

const startingStudies: Study[] = [
  {
    id: 's1',
    name: 'Nifty flag patterns',
    description: 'What makes a continuation hold, fail, or offer a second chance?',
    tags: [
      { key: 'instrument', value: 'NIFTY' },
      { key: 'topic', value: 'flag' },
    ],
  },
  {
    id: 's2',
    name: 'BankNifty breakouts',
    description: 'Opening range breaks and the signs of acceptance or rejection.',
    tags: [
      { key: 'instrument', value: 'BANKNIFTY' },
      { key: 'topic', value: 'breakout' },
    ],
  },
  {
    id: 's3',
    name: 'Nifty day types',
    description: 'Read the early clues of trend, range, and volatile days.',
    tags: [
      { key: 'instrument', value: 'NIFTY' },
      { key: 'topic', value: 'day type' },
    ],
  },
];
const startingOccurrences: Occurrence[] = [
  {
    id: 'a',
    studyId: 's1',
    title: 'Morning flag after gap up',
    date: '2026-11-19',
    notes: 'A tight pullback after a strong open. The retest held above the opening range.',
    tags: [
      { key: 'outcome', value: 'success' },
      { key: 'context', value: 'strong trend' },
      { key: 'timeframe', value: '5m' },
    ],
    shots: [
      {
        id: 'a1',
        stage: 'Entry',
        time: '10:15',
        tags: [{ key: 'signal', value: 'tight pullback' }],
        seed: 1,
      },
      {
        id: 'a2',
        stage: 'Follow-through',
        time: '11:20',
        tags: [{ key: 'signal', value: 'retest held' }],
        seed: 2,
      },
      { id: 'a3', stage: 'Exit', time: '13:05', tags: [], seed: 3 },
    ],
  },
  {
    id: 'b',
    studyId: 's1',
    title: 'Breakout back into the range',
    date: '2026-11-17',
    notes: 'The first move looked clean, then failed to hold above the prior high.',
    tags: [
      { key: 'outcome', value: 'failure' },
      { key: 'context', value: 'range' },
      { key: 'timeframe', value: '5m' },
    ],
    shots: [
      { id: 'b1', stage: 'Entry', time: '11:05', tags: [], seed: 4 },
      {
        id: 'b2',
        stage: 'Failure sign',
        time: '11:45',
        tags: [{ key: 'signal', value: 're-entered range' }],
        seed: 5,
      },
    ],
  },
  {
    id: 'c',
    studyId: 's1',
    title: 'Afternoon continuation',
    date: '2026-11-12',
    notes: 'A shallow pause after a sustained move. The second attempt worked better.',
    tags: [
      { key: 'outcome', value: 'success' },
      { key: 'context', value: 'broad trend' },
      { key: 'timeframe', value: '15m' },
    ],
    shots: [
      { id: 'c1', stage: 'Setup', time: '13:00', tags: [], seed: 6 },
      { id: 'c2', stage: 'Continuation', time: '14:15', tags: [], seed: 7 },
    ],
  },
  {
    id: 'd',
    studyId: 's2',
    title: 'Opening range rejection',
    date: '2026-11-18',
    notes: 'A quick push through the range reversed after two weak closes.',
    tags: [
      { key: 'outcome', value: 'failure' },
      { key: 'context', value: 'volatile' },
      { key: 'timeframe', value: '5m' },
    ],
    shots: [
      { id: 'd1', stage: 'Breakout', time: '09:45', tags: [], seed: 8 },
      { id: 'd2', stage: 'Reversal', time: '10:10', tags: [], seed: 9 },
    ],
  },
  {
    id: 'e',
    studyId: 's3',
    title: 'Trend day with shallow pullbacks',
    date: '2026-11-20',
    notes: 'The opening drive held and each pullback stayed brief.',
    tags: [
      { key: 'final day type', value: 'strong trend' },
      { key: 'early hypothesis', value: 'trend' },
      { key: 'opening', value: 'gap up' },
    ],
    shots: [
      { id: 'e1', stage: 'Open', time: '09:35', tags: [], seed: 10 },
      {
        id: 'e2',
        stage: 'Midday',
        time: '12:00',
        tags: [{ key: 'signal', value: 'shallow pullback' }],
        seed: 11,
      },
      { id: 'e3', stage: 'Close', time: '15:20', tags: [], seed: 12 },
    ],
  },
  {
    id: 'f',
    studyId: 's3',
    title: 'Early trend signal, range finish',
    date: '2026-11-14',
    notes: 'The early move suggested a trend, but price kept rotating around the open.',
    tags: [
      { key: 'final day type', value: 'volatile range' },
      { key: 'early hypothesis', value: 'trend' },
      { key: 'opening', value: 'inside range' },
    ],
    shots: [
      { id: 'f1', stage: 'Open', time: '09:40', tags: [], seed: 13 },
      { id: 'f2', stage: 'Midday', time: '12:15', tags: [], seed: 14 },
    ],
  },
];

const norm = (s: string) => s.trim().toLocaleLowerCase();
const id = () => Math.random().toString(36).slice(2, 10);
const distinct = (items: string[]) => [
  ...new Map(items.filter(Boolean).map((item) => [norm(item), item])).values(),
];
const studyOf = (studies: Study[], occurrence: Occurrence) =>
  studies.find((s) => s.id === occurrence.studyId);
function scopedTags(scope: Scope, study: Study | undefined, occurrence: Occurrence): Tag[] {
  if (scope === 'study') return study?.tags ?? [];
  if (scope === 'occurrence') return occurrence.tags;
  return occurrence.shots.flatMap((shot) => [...shot.tags, { key: 'stage', value: shot.stage }]);
}
function matches(filter: Filter, study: Study | undefined, occurrence: Occurrence): boolean {
  if (filter.type === 'group')
    return (
      !filter.children.length ||
      (filter.join === 'and'
        ? filter.children.every((child) => matches(child, study, occurrence))
        : filter.children.some((child) => matches(child, study, occurrence)))
    );
  if (!filter.key.trim()) return true;
  const tags = scopedTags(filter.scope, study, occurrence).filter(
    (tag) => norm(tag.key) === norm(filter.key)
  );
  if (filter.test === 'has') return tags.length > 0;
  if (!filter.value.trim()) return true;
  const found = tags.some((tag) => norm(tag.value) === norm(filter.value));
  return filter.test === 'is' ? found : !found;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const d: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    down: <path d="m6 9 6 6 6-6" />,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    filter: (
      <>
        <path d="M4 6h16M7 12h10M10 18h4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m0 0L7 8m5-5 5 5" />
        <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d[name]}
    </svg>
  );
}

function Chart({ seed }: { seed: number }) {
  const candles = Array.from({ length: 24 }, (_, i) => {
    const drift = seed % 5 === 4 ? i * 0.5 : i * 2.1;
    const center = 112 - drift - Math.sin(i * 1.35 + seed) * 10 - Math.sin(i * 0.43 + seed) * 14;
    const open = center + Math.sin(i * 2.2 + seed) * 7;
    const close = center + Math.cos(i * 2.4 + seed) * 7;
    return {
      x: 34 + i * 18,
      open,
      close,
      high: Math.min(open, close) - 8,
      low: Math.max(open, close) + 8,
      up: close < open,
    };
  });
  return (
    <svg
      className="chart"
      viewBox="0 0 480 220"
      preserveAspectRatio="none"
      role="img"
      aria-label="Illustrative chart preview"
    >
      <rect width="480" height="220" fill="#fbfcfb" />
      {[35, 75, 115, 155, 195].map((y) => (
        <line key={y} x1="20" x2="465" y1={y} y2={y} stroke="#e7eeea" />
      ))}
      {[36, 108, 180, 252, 324, 396].map((x) => (
        <line key={x} x1={x} x2={x} y1="16" y2="198" stroke="#edf1ee" />
      ))}
      <path d={`M24 ${seed % 2 ? 137 : 109}H462`} stroke="#b7c7be" strokeDasharray="5 5" />
      {candles.map((c, i) => (
        <g key={i} stroke={c.up ? '#158f7b' : '#d67e6c'} fill={c.up ? '#158f7b' : '#d67e6c'}>
          <line x1={c.x} x2={c.x} y1={c.high} y2={c.low} strokeWidth="1.5" />
          <rect
            x={c.x - 4}
            y={Math.min(c.open, c.close)}
            width="8"
            height={Math.max(3, Math.abs(c.close - c.open))}
            rx="1"
          />
        </g>
      ))}
    </svg>
  );
}

function TagChip({ tag, accent = false }: { tag: Tag; accent?: boolean }) {
  return (
    <span className={`tag-chip ${accent ? 'accent' : ''}`}>
      <span>{tag.key}</span>
      <b>{tag.value}</b>
    </span>
  );
}

function TagEditor({
  tags,
  onChange,
  allTags,
}: {
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
  allTags: Tag[];
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const keys = distinct(allTags.map((tag) => tag.key));
  const values = distinct(
    allTags.filter((tag) => norm(tag.key) === norm(key)).map((tag) => tag.value)
  );
  function add() {
    if (
      !key.trim() ||
      !value.trim() ||
      tags.some((tag) => norm(tag.key) === norm(key) && norm(tag.value) === norm(value))
    )
      return;
    onChange([
      ...tags,
      {
        key: keys.find((x) => norm(x) === norm(key)) ?? key.trim(),
        value: values.find((x) => norm(x) === norm(value)) ?? value.trim(),
      },
    ]);
    setKey('');
    setValue('');
  }
  return (
    <div className="tag-editor">
      <div className="editable-tags">
        {tags.length ? (
          tags.map((tag, i) => (
            <span key={i}>
              {tag.key} <b>{tag.value}</b>
              <button
                aria-label={`Remove ${tag.key}`}
                onClick={() => onChange(tags.filter((_, j) => j !== i))}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))
        ) : (
          <small>No tags yet</small>
        )}
      </div>
      <div className="tag-input-row">
        <input
          list="known-keys"
          placeholder="Tag key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <datalist id="known-keys">
          {keys.map((x) => (
            <option value={x} key={x} />
          ))}
        </datalist>
        <input
          list="known-values"
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <datalist id="known-values">
          {values.map((x) => (
            <option value={x} key={x} />
          ))}
        </datalist>
        <button className="square-btn" onClick={add} aria-label="Add tag">
          <Icon name="plus" size={16} />
        </button>
      </div>
      <small>Use a suggestion or type a new key and value.</small>
    </div>
  );
}

function FilterGroup({
  group,
  onChange,
  onRemove,
  tags,
}: {
  group: Group;
  onChange: (next: Group) => void;
  onRemove?: () => void;
  tags: Tag[];
}) {
  const update = (child: Filter) =>
    onChange({
      ...group,
      children: group.children.map((item) => (item.id === child.id ? child : item)),
    });
  return (
    <div className={`filter-group ${onRemove ? 'nested' : ''}`}>
      <div className="filter-line">
        <span>Match</span>
        <select
          value={group.join}
          onChange={(e) => onChange({ ...group, join: e.target.value as Group['join'] })}
        >
          <option value="and">all (AND)</option>
          <option value="or">any (OR)</option>
        </select>
        <span>of these</span>
        {onRemove && (
          <button className="icon-btn at-end" onClick={onRemove} aria-label="Remove group">
            <Icon name="close" size={15} />
          </button>
        )}
      </div>
      {group.children.map((child) =>
        child.type === 'group' ? (
          <FilterGroup
            key={child.id}
            group={child}
            tags={tags}
            onChange={update}
            onRemove={() =>
              onChange({
                ...group,
                children: group.children.filter((item) => item.id !== child.id),
              })
            }
          />
        ) : (
          <div className="filter-rule" key={child.id}>
            <select
              aria-label="Tag level"
              value={child.scope}
              onChange={(e) => update({ ...child, scope: e.target.value as Scope })}
            >
              <option value="study">Study</option>
              <option value="occurrence">Occurrence</option>
              <option value="image">Image</option>
            </select>
            <input
              list="filter-keys"
              placeholder="Tag key"
              value={child.key}
              onChange={(e) => update({ ...child, key: e.target.value })}
            />
            <select
              aria-label="Comparison"
              value={child.test}
              onChange={(e) => update({ ...child, test: e.target.value as Rule['test'] })}
            >
              <option value="is">is</option>
              <option value="is-not">is not</option>
              <option value="has">has any value</option>
            </select>
            {child.test !== 'has' && (
              <input
                list={`values-${child.id}`}
                placeholder="Value"
                value={child.value}
                onChange={(e) => update({ ...child, value: e.target.value })}
              />
            )}
            <datalist id={`values-${child.id}`}>
              {distinct(
                tags.filter((tag) => norm(tag.key) === norm(child.key)).map((tag) => tag.value)
              ).map((x) => (
                <option value={x} key={x} />
              ))}
            </datalist>
            <button
              className="icon-btn"
              onClick={() =>
                onChange({
                  ...group,
                  children: group.children.filter((item) => item.id !== child.id),
                })
              }
              aria-label="Remove condition"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        )
      )}
      <datalist id="filter-keys">
        {distinct(tags.map((tag) => tag.key)).map((x) => (
          <option value={x} key={x} />
        ))}
      </datalist>
      <div className="filter-add">
        <button
          onClick={() =>
            onChange({
              ...group,
              children: [
                ...group.children,
                { id: id(), type: 'rule', scope: 'occurrence', key: '', value: '', test: 'is' },
              ],
            })
          }
        >
          <Icon name="plus" size={14} /> Condition
        </button>
        <button
          onClick={() =>
            onChange({
              ...group,
              children: [...group.children, { id: id(), type: 'group', join: 'or', children: [] }],
            })
          }
        >
          <Icon name="plus" size={14} /> AND/OR group
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [studies, setStudies] = useState(startingStudies);
  const [occurrences, setOccurrences] = useState(startingOccurrences);
  const [studyId, setStudyId] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<Group>({
    id: 'root',
    type: 'group',
    join: 'and',
    children: [],
  });
  const [groupBy, setGroupBy] = useState('study');
  const [viewId, setViewId] = useState<string | null>(null);
  const [shotIndex, setShotIndex] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [editImageTags, setEditImageTags] = useState(false);
  const [modal, setModal] = useState<'study' | 'occurrence' | null>(null);
  const [studyDraft, setStudyDraft] = useState({ name: '', description: '', tags: [] as Tag[] });
  const [occDraft, setOccDraft] = useState({
    studyId: 's1',
    title: '',
    date: '',
    notes: '',
    tags: [] as Tag[],
    files: [] as File[],
    stages: [] as string[],
  });
  const [thought, setThought] = useState('');
  const [thoughts, setThoughts] = useState<Record<string, string[]>>({});
  const allTags = useMemo(
    () => [
      ...studies.flatMap((s) => s.tags),
      ...occurrences.flatMap((o) => [
        ...o.tags,
        ...o.shots.flatMap((shot) => [...shot.tags, { key: 'stage', value: shot.stage }]),
      ]),
    ],
    [studies, occurrences]
  );
  const results = useMemo(
    () =>
      occurrences.filter((o) => {
        const s = studyOf(studies, o);
        const text = [
          o.title,
          o.notes,
          o.date,
          s?.name,
          ...scopedTags('study', s, o).map((t) => `${t.key} ${t.value}`),
          ...o.tags.map((t) => `${t.key} ${t.value}`),
        ]
          .join(' ')
          .toLocaleLowerCase();
        return (
          (studyId === 'all' || o.studyId === studyId) &&
          text.includes(search.toLocaleLowerCase()) &&
          (!dateFrom || o.date >= dateFrom) &&
          (!dateTo || o.date <= dateTo) &&
          matches(filter, s, o)
        );
      }),
    [occurrences, studies, studyId, search, dateFrom, dateTo, filter]
  );
  const groups = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of results) {
      const s = studyOf(studies, o);
      const values =
        groupBy === 'none'
          ? ['All occurrences']
          : groupBy === 'study'
            ? [s?.name ?? 'Other']
            : groupBy === 'date'
              ? [o.date || 'Unspecified']
              : groupBy === 'month'
                ? [o.date.slice(0, 7) || 'Unspecified']
                : (() => {
                    const [scope, key] = groupBy.split(':') as [Scope, string];
                    return distinct(
                      scopedTags(scope, s, o)
                        .filter((t) => norm(t.key) === norm(key))
                        .map((t) => t.value)
                    );
                  })();
      for (const value of values.length ? values : ['Unspecified'])
        map.set(value, [...(map.get(value) ?? []), o]);
    }
    return [...map.entries()];
  }, [results, studies, groupBy]);
  const viewing = occurrences.find((o) => o.id === viewId);
  const currentStudy = viewing && studyOf(studies, viewing);
  const shot = viewing?.shots[shotIndex];
  function open(id: string) {
    setViewId(id);
    setShotIndex(0);
    setReveal(false);
    setEditImageTags(false);
    setThought('');
  }
  function stepOccurrence(step: number) {
    const index = results.findIndex((o) => o.id === viewId);
    if (index >= 0 && results.length)
      open(results[(index + step + results.length) % results.length].id);
  }
  function createStudy() {
    if (!studyDraft.name.trim()) return;
    const next: Study = {
      id: id(),
      name: studyDraft.name.trim(),
      description: studyDraft.description.trim(),
      tags: studyDraft.tags,
    };
    setStudies([...studies, next]);
    setStudyId(next.id);
    setStudyDraft({ name: '', description: '', tags: [] });
    setModal(null);
  }
  function createOccurrence() {
    if (!occDraft.title.trim() || !occDraft.files.length) return;
    const next: Occurrence = {
      id: id(),
      studyId: occDraft.studyId,
      title: occDraft.title.trim(),
      date: occDraft.date,
      notes: occDraft.notes.trim(),
      tags: occDraft.tags,
      shots: occDraft.files.map((file, i) => ({
        id: id(),
        stage: occDraft.stages[i]?.trim() || `Image ${i + 1}`,
        time: '',
        tags: [],
        seed: i,
        url: URL.createObjectURL(file),
      })),
    };
    setOccurrences([next, ...occurrences]);
    setStudyId(next.studyId);
    setOccDraft({
      studyId: next.studyId,
      title: '',
      date: '',
      notes: '',
      tags: [],
      files: [],
      stages: [],
    });
    setModal(null);
    open(next.id);
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div>
            <strong>Chart Atlas</strong>
            <small>Pattern study workspace</small>
          </div>
        </div>
        <div className="side-label">WORKSPACE</div>
        <button
          className={`side-item ${studyId === 'all' ? 'active' : ''}`}
          onClick={() => {
            setStudyId('all');
            setViewId(null);
          }}
        >
          <Icon name="grid" />
          <span>All occurrences</span>
          <em>{occurrences.length}</em>
        </button>
        <div className="side-label side-label-spaced">
          YOUR STUDIES{' '}
          <button onClick={() => setModal('study')} aria-label="New study">
            <Icon name="plus" size={15} />
          </button>
        </div>
        {studies.map((s, index) => (
          <button
            key={s.id}
            className={`side-item ${studyId === s.id ? 'active' : ''}`}
            onClick={() => {
              setStudyId(s.id);
              setViewId(null);
            }}
          >
            <span className={`study-dot dot-${index % 3}`} />
            <span>
              {s.name}
              <small>{s.tags.find((t) => norm(t.key) === 'instrument')?.value ?? 'Study'}</small>
            </span>
            <em>{occurrences.filter((o) => o.studyId === s.id).length}</em>
          </button>
        ))}
        <button className="side-create" onClick={() => setModal('study')}>
          <Icon name="plus" size={16} /> New study
        </button>
        <div className="side-bottom">
          <div className="side-tip">
            <Icon name="layers" />
            <strong>Learn from the sequence</strong>
            <p>Collect each occurrence, then review what the chart showed at every stage.</p>
          </div>
          <div className="prototype">
            <span /> UI prototype · session only
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <Icon name="right" size={14} />
            <strong>
              {studyId === 'all' ? 'All occurrences' : studies.find((s) => s.id === studyId)?.name}
            </strong>
            {viewing && (
              <>
                <Icon name="right" size={14} />
                <span>{viewing.title}</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <span>A place to study the market, one chart at a time</span>
            <button
              className="primary"
              onClick={() => {
                setOccDraft((draft) => ({
                  ...draft,
                  studyId: studyId === 'all' ? (studies[0]?.id ?? '') : studyId,
                }));
                setModal('occurrence');
              }}
            >
              <Icon name="plus" size={17} /> Add occurrence
            </button>
          </div>
        </header>
        {viewing && shot ? (
          <div className="review">
            <button className="back" onClick={() => setViewId(null)}>
              <Icon name="left" size={16} /> Back to results
            </button>
            <div className="review-heading">
              <div>
                <div className="eyebrow">
                  {currentStudy?.name} <span>·</span> {viewing.date || 'Undated'}
                </div>
                <h1>{viewing.title}</h1>
                <p>{viewing.notes}</p>
              </div>
              <div className="review-buttons">
                <button className="secondary" onClick={() => stepOccurrence(-1)}>
                  <Icon name="left" size={16} /> Previous
                </button>
                <button className="secondary" onClick={() => stepOccurrence(1)}>
                  Next <Icon name="right" size={16} />
                </button>
              </div>
            </div>
            <div className="review-columns">
              <div className="review-center">
                <div className="chart-top">
                  <div>
                    <span className="stage">{shot.stage}</span>
                    <span>
                      Image {shotIndex + 1} of {viewing.shots.length}
                      {shot.time ? ` · ${shot.time}` : ''}
                    </span>
                  </div>
                  <span>{shot.url ? 'Your uploaded chart' : 'Illustrative sample chart'}</span>
                </div>
                <div className="large-chart">
                  {shot.url ? (
                    <img src={shot.url} alt={`${viewing.title}: ${shot.stage}`} />
                  ) : (
                    <Chart seed={shot.seed} />
                  )}
                </div>
                <div className="chart-nav">
                  <button disabled={shotIndex === 0} onClick={() => setShotIndex(shotIndex - 1)}>
                    <Icon name="left" size={17} /> Previous image
                  </button>
                  <div className="dots">
                    {viewing.shots.map((s, i) => (
                      <button
                        key={s.id}
                        className={i === shotIndex ? 'on' : ''}
                        onClick={() => setShotIndex(i)}
                        aria-label={`View ${s.stage}`}
                      />
                    ))}
                  </div>
                  <button
                    disabled={shotIndex === viewing.shots.length - 1}
                    onClick={() => setShotIndex(shotIndex + 1)}
                  >
                    Next image <Icon name="right" size={17} />
                  </button>
                </div>
                <div className="timeline">
                  <div className="timeline-head">
                    <strong>Occurrence timeline</strong>
                    <span>{viewing.shots.length} images</span>
                  </div>
                  <div className="timeline-list">
                    {viewing.shots.map((s, i) => (
                      <button
                        className={i === shotIndex ? 'selected' : ''}
                        onClick={() => setShotIndex(i)}
                        key={s.id}
                      >
                        <b>{String(i + 1).padStart(2, '0')}</b>
                        <span>
                          {s.stage}
                          <small>{s.time || 'Added image'}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <aside className="review-side">
                <div className="detail-panel">
                  <div className="detail-title">
                    <strong>Tags & context</strong>
                    <Icon name="layers" size={16} />
                  </div>
                  <div className="tag-level">
                    <small>STUDY</small>
                    <div>
                      {currentStudy?.tags.map((t, i) => (
                        <TagChip tag={t} key={i} />
                      ))}
                    </div>
                  </div>
                  <div className="tag-level">
                    <small>OCCURRENCE</small>
                    <div>
                      {viewing.tags
                        .filter((t) => reveal || norm(t.key) !== 'outcome')
                        .map((t, i) => (
                          <TagChip tag={t} key={i} accent={norm(t.key) === 'outcome'} />
                        ))}
                      {!reveal && viewing.tags.some((t) => norm(t.key) === 'outcome') && (
                        <span className="concealed">Outcome hidden</span>
                      )}
                    </div>
                  </div>
                  <div className="tag-level">
                    <small>THIS IMAGE</small>
                    <div>
                      <TagChip tag={{ key: 'stage', value: shot.stage }} />
                      {shot.tags.map((t, i) => (
                        <TagChip tag={t} key={i} />
                      ))}
                    </div>
                    <button className="edit-tags" onClick={() => setEditImageTags(!editImageTags)}>
                      {editImageTags ? 'Done editing' : 'Edit image tags'}
                    </button>
                    {editImageTags && (
                      <div className="image-editor">
                        <label>
                          Stage
                          <input
                            value={shot.stage}
                            onChange={(e) =>
                              setOccurrences((items) =>
                                items.map((item) =>
                                  item.id === viewing.id
                                    ? {
                                        ...item,
                                        shots: item.shots.map((image) =>
                                          image.id === shot.id
                                            ? { ...image, stage: e.target.value }
                                            : image
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        </label>
                        <TagEditor
                          tags={shot.tags}
                          allTags={allTags}
                          onChange={(tags) =>
                            setOccurrences((items) =>
                              items.map((item) =>
                                item.id === viewing.id
                                  ? {
                                      ...item,
                                      shots: item.shots.map((image) =>
                                        image.id === shot.id ? { ...image, tags } : image
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                  <button className="reveal" onClick={() => setReveal(!reveal)}>
                    <Icon name="eye" size={17} /> {reveal ? 'Hide outcome' : 'Reveal outcome'}
                  </button>
                </div>
                <div className="detail-panel thought-panel">
                  <div className="detail-title">
                    <strong>What do you expect next?</strong>
                    <Icon name="eye" size={16} />
                  </div>
                  <p>Record a thought before moving to the next image.</p>
                  <textarea
                    value={thought}
                    onChange={(e) => setThought(e.target.value)}
                    placeholder="What signs would make you wait, continue, or reverse?"
                  />
                  <button
                    className="secondary"
                    onClick={() => {
                      if (!thought.trim()) return;
                      setThoughts({
                        ...thoughts,
                        [viewing.id]: [
                          ...(thoughts[viewing.id] ?? []),
                          `${shot.stage}: ${thought.trim()}`,
                        ],
                      });
                      setThought('');
                    }}
                  >
                    Save thought
                  </button>
                  {(thoughts[viewing.id] ?? []).map((t, i) => (
                    <div className="saved-thought" key={i}>
                      {t}
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="browse">
            <div className="page-hero">
              <div className="eyebrow">
                CHART JOURNAL <span className="eyebrow-rule" />
              </div>
              <div className="hero-line">
                <div>
                  <h1>
                    {studyId === 'all'
                      ? 'Explore your occurrences'
                      : studies.find((s) => s.id === studyId)?.name}
                  </h1>
                  <p>
                    {studyId === 'all'
                      ? 'Collect patterns, compare conditions, and study how each setup unfolds.'
                      : studies.find((s) => s.id === studyId)?.description}
                  </p>
                </div>
                <div className="hero-count">
                  <strong>{results.length}</strong>
                  <span>occurrences in view</span>
                </div>
              </div>
            </div>
            <div className="stats">
              <div>
                <span className="stat-icon green">
                  <Icon name="layers" />
                </span>
                <strong>{studies.length}</strong>
                <small>Active studies</small>
              </div>
              <div>
                <span className="stat-icon gold">
                  <Icon name="image" />
                </span>
                <strong>{results.reduce((sum, o) => sum + o.shots.length, 0)}</strong>
                <small>Chart images in view</small>
              </div>
              <div>
                <span className="stat-icon purple">
                  <Icon name="calendar" />
                </span>
                <strong>{distinct(results.map((o) => o.date)).length}</strong>
                <small>Trading days in view</small>
              </div>
            </div>
            <div className="library-head">
              <h2>Occurrence library</h2>
              <p>Filter across studies, then open an occurrence to follow its sequence.</p>
            </div>
            <div className="control-bar">
              <label className="search">
                <Icon name="search" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search titles, notes, tags, or dates..."
                />
              </label>
              <label className="date-filter">
                From
                <input
                  type="date"
                  aria-label="From date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="date-filter">
                To
                <input
                  type="date"
                  aria-label="To date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
              <button
                className={`filter-button ${filterOpen ? 'selected' : ''}`}
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Icon name="filter" size={17} /> Filters{' '}
                {filter.children.length > 0 && <b>{filter.children.length}</b>}
              </button>
              <label className="group-select">
                Group by{' '}
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                  <option value="study">Study</option>
                  <option value="none">None</option>
                  <option value="date">Chart date</option>
                  <option value="month">Month</option>
                  {distinct(studies.flatMap((s) => s.tags.map((t) => t.key))).map((key) => (
                    <option value={`study:${key}`} key={`s-${key}`}>
                      {key} · study
                    </option>
                  ))}
                  {distinct(occurrences.flatMap((o) => o.tags.map((t) => t.key))).map((key) => (
                    <option value={`occurrence:${key}`} key={`o-${key}`}>
                      {key} · occurrence
                    </option>
                  ))}
                  {distinct(
                    occurrences.flatMap((o) =>
                      o.shots.flatMap((shot) => shot.tags.map((t) => t.key))
                    )
                  ).map((key) => (
                    <option value={`image:${key}`} key={`i-${key}`}>
                      {key} · image
                    </option>
                  ))}
                  <option value="image:stage">stage · image</option>
                </select>
                <Icon name="down" size={15} />
              </label>
            </div>
            {filterOpen && (
              <div className="filter-panel">
                <div className="filter-head">
                  <div>
                    <strong>Build a filter</strong>
                    <span>Combine any number of tag conditions and nested groups.</span>
                  </div>
                  <button
                    onClick={() =>
                      setFilter({ id: 'root', type: 'group', join: 'and', children: [] })
                    }
                  >
                    Clear all
                  </button>
                </div>
                <FilterGroup group={filter} onChange={setFilter} tags={allTags} />
              </div>
            )}
            {groups.length ? (
              groups.map(([label, items]) => (
                <section className="result-group" key={label}>
                  <div className="result-head">
                    <div>
                      <span className="result-mark" />
                      <h3>{label}</h3>
                      <small>
                        {items.length} {items.length === 1 ? 'occurrence' : 'occurrences'}
                      </small>
                    </div>
                    <span>
                      {groupBy === 'study'
                        ? studies
                            .find((s) => s.name === label)
                            ?.tags.map((t) => t.value)
                            .join(' · ')
                        : 'Filtered examples'}
                    </span>
                  </div>
                  <div className="cards">
                    {items.map((o) => {
                      const s = studyOf(studies, o);
                      return (
                        <button className="occ-card" key={o.id} onClick={() => open(o.id)}>
                          <div className="card-chart">
                            {o.shots[0]?.url ? (
                              <img src={o.shots[0].url} alt={`${o.title} preview`} />
                            ) : (
                              <Chart seed={o.shots[0]?.seed ?? 1} />
                            )}
                            <span className="image-badge">
                              <Icon name="image" size={13} /> {o.shots.length}
                            </span>
                          </div>
                          <div className="card-body">
                            <div className="card-meta">
                              <span>
                                {s?.tags.find((t) => norm(t.key) === 'instrument')?.value ??
                                  'STUDY'}
                              </span>
                              <span>{o.date || 'Undated'}</span>
                            </div>
                            <h4>{o.title}</h4>
                            <p>{o.notes}</p>
                            <div className="card-tags">
                              {o.tags.slice(0, 3).map((t, i) => (
                                <TagChip tag={t} key={i} accent={norm(t.key) === 'outcome'} />
                              ))}
                            </div>
                            <div className="card-foot">
                              <strong>
                                Review sequence <Icon name="right" size={14} />
                              </strong>
                              <span>{o.shots.map((shot) => shot.stage).join(' → ')}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="empty">
                <Icon name="search" size={30} />
                <h3>No occurrences match</h3>
                <p>Try a different combination of tags or add an occurrence.</p>
                <button
                  className="secondary"
                  onClick={() => {
                    setSearch('');
                    setFilter({ id: 'root', type: 'group', join: 'and', children: [] });
                  }}
                >
                  Clear search and filters
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      {modal && (
        <div
          className="modal-shade"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === 'study' ? 'Create study' : 'Add occurrence'}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">
                  {modal === 'study' ? 'NEW COLLECTION' : 'NEW EXAMPLE'}
                </span>
                <h2>{modal === 'study' ? 'Create a study' : 'Add an occurrence'}</h2>
                <p>
                  {modal === 'study'
                    ? 'Gather related occurrences around one question.'
                    : 'Add images that show how this example unfolded.'}
                </p>
              </div>
              <button className="icon-btn" aria-label="Close" onClick={() => setModal(null)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            {modal === 'study' ? (
              <div className="modal-body">
                <label>
                  Study name
                  <input
                    autoFocus
                    value={studyDraft.name}
                    onChange={(e) => setStudyDraft({ ...studyDraft, name: e.target.value })}
                    placeholder="e.g. Nifty flag patterns"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={studyDraft.description}
                    onChange={(e) => setStudyDraft({ ...studyDraft, description: e.target.value })}
                    placeholder="What are you trying to learn?"
                  />
                </label>
                <label>Study tags</label>
                <TagEditor
                  tags={studyDraft.tags}
                  onChange={(tags) => setStudyDraft({ ...studyDraft, tags })}
                  allTags={allTags}
                />
              </div>
            ) : (
              <div className="modal-body">
                <label>
                  Study
                  <select
                    value={occDraft.studyId}
                    onChange={(e) => setOccDraft({ ...occDraft, studyId: e.target.value })}
                  >
                    {studies.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="two-fields">
                  <label>
                    Occurrence title
                    <input
                      autoFocus
                      value={occDraft.title}
                      onChange={(e) => setOccDraft({ ...occDraft, title: e.target.value })}
                      placeholder="e.g. Failed morning breakout"
                    />
                  </label>
                  <label>
                    Chart date
                    <input
                      type="date"
                      value={occDraft.date}
                      onChange={(e) => setOccDraft({ ...occDraft, date: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea
                    value={occDraft.notes}
                    onChange={(e) => setOccDraft({ ...occDraft, notes: e.target.value })}
                    placeholder="What made this example interesting?"
                  />
                </label>
                <label>Occurrence tags</label>
                <TagEditor
                  tags={occDraft.tags}
                  onChange={(tags) => setOccDraft({ ...occDraft, tags })}
                  allTags={allTags}
                />
                <label className="upload">
                  <Icon name="upload" size={24} />
                  <strong>Add chart images</strong>
                  <span>Choose one or more images, then name each stage.</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = [...occDraft.files, ...Array.from(e.target.files ?? [])];
                      setOccDraft({
                        ...occDraft,
                        files,
                        stages: files.map((_, i) => occDraft.stages[i] ?? ''),
                      });
                    }}
                  />
                </label>
                {occDraft.files.length > 0 && (
                  <div className="file-list">
                    {occDraft.files.map((file, i) => (
                      <div key={`${file.name}-${i}`}>
                        <b>{i + 1}</b>
                        <span>{file.name}</span>
                        <input
                          value={occDraft.stages[i] ?? ''}
                          onChange={(e) =>
                            setOccDraft({
                              ...occDraft,
                              stages: occDraft.stages.map((stage, j) =>
                                i === j ? e.target.value : stage
                              ),
                            })
                          }
                          placeholder="Stage, e.g. Entry"
                        />
                        <button
                          className="icon-btn"
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            setOccDraft({
                              ...occDraft,
                              files: occDraft.files.filter((_, j) => j !== i),
                              stages: occDraft.stages.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <Icon name="close" size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="modal-foot">
              <small>Prototype data is kept in memory until you refresh.</small>
              <div>
                <button className="secondary" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={
                    modal === 'study'
                      ? !studyDraft.name.trim()
                      : !occDraft.title.trim() || !occDraft.files.length
                  }
                  onClick={modal === 'study' ? createStudy : createOccurrence}
                >
                  <Icon name="check" size={16} />{' '}
                  {modal === 'study' ? 'Create study' : 'Add occurrence'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
