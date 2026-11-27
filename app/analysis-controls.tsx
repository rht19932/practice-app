'use client';
import { useEffect, useId, useState } from 'react';
import { api, type Filter, type Scope, type Tag } from './analysis-api';

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M6 18 18 6',
    left: 'm15 18-6-6 6-6',
    right: 'm9 18 6-6-6-6',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    layers: 'm12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5',
    search: 'M20 20l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    image: 'M3 3h18v18H3zM3 21l8-9 5 4 5-7',
    calendar: 'M3 5h18v16H3zM7 3v4M17 3v4M3 10h18',
    filter: 'M4 6h16M7 12h10M10 18h4',
    eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
    check: 'm4 12 5 5L20 6',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.layers} />
    </svg>
  );
}
export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span className="tag-chip">
      <span>{tag.key}</span>
      <b>{tag.value}</b>
    </span>
  );
}
export function SuggestedInput({
  value,
  onChange,
  tagKey,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  tagKey?: string;
  placeholder: string;
}) {
  const id = useId();
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const path =
        tagKey === undefined
          ? `/tags/keys?q=${encodeURIComponent(value)}`
          : `/tags/values?key=${encodeURIComponent(tagKey)}&q=${encodeURIComponent(value)}`;
      if (tagKey === '') return;
      api<{ value: string }[]>(path, 'GET', undefined, controller.signal)
        .then((rows) => setOptions(rows.map((row) => row.value)))
        .catch(() => undefined);
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tagKey, value]);
  return (
    <>
      <input
        list={id}
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={id}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
export function TagEditor({ tags, onChange }: { tags: Tag[]; onChange: (tags: Tag[]) => void }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  return (
    <div className="tag-editor">
      <div className="editable-tags">
        {tags.map((tag, index) => (
          <span key={index}>
            {tag.key} <b>{tag.value}</b>
            <button
              type="button"
              aria-label={`Remove ${tag.key}`}
              onClick={() => onChange(tags.filter((_, i) => i !== index))}
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-input-row">
        <SuggestedInput value={key} onChange={setKey} placeholder="Tag key" />
        <SuggestedInput value={value} onChange={setValue} tagKey={key} placeholder="Value" />
        <button
          type="button"
          className="square-btn"
          aria-label="Add tag"
          onClick={() => {
            if (!key.trim() || !value.trim()) return;
            onChange([...tags, { key: key.trim(), value: value.trim() }]);
            setKey('');
            setValue('');
          }}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
      <small>Use existing suggestions or enter any new key and value.</small>
    </div>
  );
}
export function FilterEditor({
  filter,
  onChange,
  imageOnly = false,
}: {
  filter: Filter;
  onChange: (filter: Filter) => void;
  imageOnly?: boolean;
}) {
  if (filter.type === 'not' || filter.type === 'image-match')
    return (
      <div className="filter-group nested">
        <div className="filter-line">
          <b>{filter.type === 'not' ? 'NOT' : 'On the same image'}</b>
          <button onClick={() => onChange(filter.child)}>Unwrap</button>
        </div>
        <FilterEditor
          filter={filter.child}
          onChange={(child) => onChange({ ...filter, child })}
          imageOnly={imageOnly || filter.type === 'image-match'}
        />
      </div>
    );
  if (filter.type === 'rule')
    return (
      <div className="filter-rule">
        <select
          aria-label="Tag level"
          value={filter.scope}
          onChange={(event) => onChange({ ...filter, scope: event.target.value as Scope })}
        >
          {(imageOnly ? ['image'] : ['study', 'occurrence', 'image']).map((scope) => (
            <option key={scope}>{scope}</option>
          ))}
        </select>
        <SuggestedInput
          value={filter.key}
          onChange={(key) => onChange({ ...filter, key })}
          placeholder="Tag key"
        />
        <select
          aria-label="Comparison"
          value={filter.test}
          onChange={(event) => onChange({ ...filter, test: event.target.value as 'is' })}
        >
          <option value="is">is</option>
          <option value="is-not">is not</option>
          <option value="has">has any value</option>
          <option value="missing">is missing</option>
        </select>
        {['is', 'is-not'].includes(filter.test) && (
          <SuggestedInput
            value={filter.value ?? ''}
            tagKey={filter.key}
            onChange={(value) => onChange({ ...filter, value })}
            placeholder="Value"
          />
        )}
      </div>
    );
  // All remaining variants are groups.
  if (filter.type !== 'group') return null;
  return (
    <div className="filter-group">
      <div className="filter-line">
        Match{' '}
        <select
          value={filter.join}
          onChange={(event) => onChange({ ...filter, join: event.target.value as 'and' | 'or' })}
        >
          <option value="and">all (AND)</option>
          <option value="or">any (OR)</option>
        </select>
        <span>of these</span>
        <button className="icon-btn" onClick={() => onChange({ type: 'not', child: filter })}>
          Negate group
        </button>
      </div>
      {filter.children.map((child, index) => (
        <div className="filter-child" key={index}>
          <FilterEditor
            filter={child}
            imageOnly={imageOnly}
            onChange={(next) =>
              onChange({
                ...filter,
                children: filter.children.map((item, i) => (i === index ? next : item)),
              })
            }
          />
          <button
            className="icon-btn"
            aria-label="Remove condition or group"
            onClick={() =>
              onChange({ ...filter, children: filter.children.filter((_, i) => i !== index) })
            }
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      <div className="filter-add">
        <button
          onClick={() =>
            onChange({
              ...filter,
              children: [
                ...filter.children,
                {
                  type: 'rule',
                  scope: imageOnly ? 'image' : 'occurrence',
                  key: '',
                  test: 'is',
                  value: '',
                },
              ],
            })
          }
        >
          + Condition
        </button>
        <button
          onClick={() =>
            onChange({
              ...filter,
              children: [...filter.children, { type: 'group', join: 'or', children: [] }],
            })
          }
        >
          + AND/OR group
        </button>
        {!imageOnly && (
          <button
            onClick={() =>
              onChange({
                ...filter,
                children: [
                  ...filter.children,
                  {
                    type: 'image-match',
                    child: {
                      type: 'group',
                      join: 'and',
                      children: [{ type: 'rule', scope: 'image', key: '', test: 'is', value: '' }],
                    },
                  },
                ],
              })
            }
          >
            + Same-image group
          </button>
        )}
      </div>
    </div>
  );
}
export function cleanFilter(filter: Filter): Filter | undefined {
  if (filter.type === 'rule')
    return filter.key.trim() && (['has', 'missing'].includes(filter.test) || filter.value?.trim())
      ? filter
      : undefined;
  if (filter.type === 'group') {
    const children = filter.children.map(cleanFilter).filter((child): child is Filter => !!child);
    return children.length ? { ...filter, children } : undefined;
  }
  const child = cleanFilter(filter.child);
  return child ? { ...filter, child } : undefined;
}
