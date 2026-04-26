import { useState, useEffect } from 'react';

const DEFAULT_GOALS = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
  fiber: 30,
};
const COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  calories: { bar: '#f97316', bg: '#fff7ed', text: '#c2410c' },
  protein: { bar: '#6366f1', bg: '#eef2ff', text: '#4338ca' },
  carbs: { bar: '#10b981', bg: '#ecfdf5', text: '#047857' },
  fat: { bar: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
  fiber: { bar: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9' },
};
const FILTERS = [
  'High Protein',
  'Low Carb',
  'Vegetarian',
  'Vegan',
  'Gut Health',
  'High Fiber',
  'Low Fat',
  'Quick & Easy',
];
const PORTION_PRESETS = [10, 25, 33, 50, 75, 100];

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDay = (d: string, o: Intl.DateTimeFormatOptions = {}) =>
  new Date(d + 'T12:00:00').toLocaleDateString([], o);
const sumM = (items: any[]) =>
  items.reduce(
    (a, e) => ({
      calories: a.calories + (e.calories || 0),
      protein: a.protein + (e.protein || 0),
      carbs: a.carbs + (e.carbs || 0),
      fat: a.fat + (e.fat || 0),
      fiber: a.fiber + (e.fiber || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
const pct = (v: number, g: number) => Math.min(100, Math.round((v / g) * 100));
const lsGet = (k: string) => {
  try {
    const r = localStorage.getItem(k);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: any) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const callClaude = async (body: any) => {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.error?.message || 'API error');
  }
  return res.json();
};

const parseJ = (text: string) => {
  const m = text
    .replace(/```json|```/g, '')
    .trim()
    .match(/[\[{][\s\S]*[\]}]/);
  if (!m) throw new Error('Parse error');
  return JSON.parse(m[0]);
};

function Pills({ item, sm }: { item: any; sm?: boolean }) {
  const p = sm
    ? { fontSize: 11, padding: '1px 5px' }
    : { fontSize: 12, padding: '2px 7px' };
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
      {(
        [
          ['#fff7ed', '#c2410c', Math.round(item.calories || 0), 'kcal'],
          ['#eef2ff', '#4338ca', Math.round(item.protein || 0), 'P'],
          ['#ecfdf5', '#047857', Math.round(item.carbs || 0), 'C'],
          ['#fffbeb', '#b45309', Math.round(item.fat || 0), 'F'],
          ['#f5f3ff', '#6d28d9', Math.round(item.fiber || 0), 'Fi'],
        ] as [string, string, number, string][]
      ).map(([bg, c, v, l]) => (
        <span
          key={l}
          style={{
            background: bg,
            color: c,
            borderRadius: 6,
            fontWeight: 600,
            ...p,
          }}
        >
          {v}
          {l !== 'kcal' ? 'g' : ''} {l}
        </span>
      ))}
    </div>
  );
}

function Bar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: any;
}) {
  const p = pct(value, goal),
    over = value > goal;
  return (
    <div style={{ marginBottom: 11 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 3,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: color.text }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          <strong style={{ color: over ? '#ef4444' : '#111' }}>
            {Math.round(value)}
          </strong>
          /{goal}
          {label === 'Calories' ? ' kcal' : 'g'}{' '}
          <span
            style={{
              fontSize: 11,
              background: over ? '#fee2e2' : color.bg,
              color: over ? '#b91c1c' : color.text,
              borderRadius: 99,
              padding: '1px 6px',
              fontWeight: 700,
            }}
          >
            {p}%
          </span>
        </span>
      </div>
      <div
        style={{
          height: 9,
          borderRadius: 99,
          background: '#f3f4f6',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${p}%`,
            borderRadius: 99,
            background: over ? '#ef4444' : color.bar,
            transition: 'width 0.4s',
          }}
        />
      </div>
    </div>
  );
}

function Modal({
  onClose,
  children,
  sheet,
}: {
  onClose: () => void;
  children: React.ReactNode;
  sheet?: boolean;
}) {
  const outer: React.CSSProperties = sheet
    ? {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 150,
      }
    : {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 150,
      };
  const inner: React.CSSProperties = sheet
    ? {
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        padding: 22,
        width: '100%',
        maxWidth: 580,
        maxHeight: '88vh',
        overflowY: 'auto',
      }
    : {
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        width: 'min(320px,90vw)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      };
  return (
    <div style={outer} onClick={onClose}>
      <div style={inner} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function GoalModal({ goals, onSave, onClose }: any) {
  const [d, setD] = useState({ ...goals });
  return (
    <Modal onClose={onClose}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
        Daily Targets
      </h3>
      {Object.entries({
        calories: 'Calories (kcal)',
        protein: 'Protein (g)',
        carbs: 'Carbs (g)',
        fat: 'Fat (g)',
        fiber: 'Fiber (g)',
      }).map(([k, l]) => (
        <div key={k} style={{ marginBottom: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 3,
            }}
          >
            {l as string}
          </label>
          <input
            type="number"
            value={(d as any)[k] || 0}
            onChange={(e) => setD((x: any) => ({ ...x, [k]: +e.target.value }))}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1.5px solid #e5e7eb',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 8,
            border: '1.5px solid #e5e7eb',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(d)}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 8,
            border: 'none',
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function CalModal({ activeDay, log, onSelect, onClose }: any) {
  const [vd, setVd] = useState(new Date(activeDay + 'T12:00:00'));
  const yr = vd.getFullYear(),
    mo = vd.getMonth(),
    ts = todayStr();
  const cells: (number | null)[] = [];
  for (let i = 0; i < new Date(yr, mo, 1).getDay(); i++) cells.push(null);
  for (let d = 1; d <= new Date(yr, mo + 1, 0).getDate(); d++) cells.push(d);
  const ds = (d: number) =>
    `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return (
    <Modal onClose={onClose}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <button
          onClick={() => setVd(new Date(yr, mo - 1, 1))}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            padding: '2px 6px',
          }}
        >
          ‹
        </button>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {vd.toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setVd(new Date(yr, mo + 1, 1))}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            padding: '2px 6px',
          }}
        >
          ›
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7,1fr)',
          gap: 2,
          marginBottom: 4,
        }}
      >
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 600,
              color: '#9ca3af',
              padding: '3px 0',
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7,1fr)',
          gap: 2,
        }}
      >
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const s = ds(d),
            isA = s === activeDay,
            isT = s === ts,
            has = log[s]?.length > 0;
          return (
            <div
              key={i}
              onClick={() => {
                onSelect(s);
                onClose();
              }}
              style={{
                textAlign: 'center',
                padding: '6px 2px',
                borderRadius: 7,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isA || isT ? 700 : 400,
                background: isA ? '#111' : isT ? '#f3f4f6' : 'transparent',
                color: isA ? '#fff' : '#374151',
              }}
            >
              {d}
              {has && !isA && (
                <div
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 99,
                    background: '#10b981',
                    margin: '2px auto 0',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={() => {
          onSelect(ts);
          onClose();
        }}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '8px 0',
          borderRadius: 8,
          border: '1.5px solid #e5e7eb',
          background: '#fff',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Today
      </button>
    </Modal>
  );
}

function RecommendModal({ goals, totals, onClose, onAdd }: any) {
  const [sel, setSel] = useState<string[]>([]);
  const [recs, setRecs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const rem = {
    calories: Math.max(0, goals.calories - totals.calories),
    protein: Math.max(0, goals.protein - totals.protein),
    fiber: Math.max(0, goals.fiber - totals.fiber),
  };
  async function go() {
    setLoading(true);
    setErr('');
    setRecs(null);
    try {
      const d = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        system: `Nutrition assistant. Respond ONLY with a raw JSON array of 4 suggestions: [{"name":"","serving":"","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"reason":"","tags":[]}]`,
        messages: [
          {
            role: 'user',
            content: `Remaining: ${rem.calories}kcal, ${
              rem.protein
            }g protein, ${rem.fiber}g fiber. Filters: ${
              sel.length ? sel.join(', ') : 'none'
            }.`,
          },
        ],
      });
      setRecs(
        parseJ(
          d.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('')
        )
      );
    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
  }
  return (
    <Modal sheet onClose={onClose}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>What to eat? 🤔</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {Math.round(rem.calories)} kcal · {Math.round(rem.protein)}g protein
            remaining
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: '#9ca3af',
          }}
        >
          ✕
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap' as const,
          gap: 6,
          marginBottom: 12,
        }}
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() =>
              setSel((s) =>
                s.includes(f) ? s.filter((x) => x !== f) : [...s, f]
              )
            }
            style={{
              padding: '5px 11px',
              borderRadius: 99,
              border: `1.5px solid ${sel.includes(f) ? '#111' : '#e5e7eb'}`,
              background: sel.includes(f) ? '#111' : '#fff',
              color: sel.includes(f) ? '#fff' : '#374151',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {f}
          </button>
        ))}
      </div>
      <button
        onClick={go}
        disabled={loading}
        style={{
          width: '100%',
          padding: '11px 0',
          borderRadius: 10,
          border: 'none',
          background: loading ? '#9ca3af' : '#111',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          cursor: loading ? 'default' : 'pointer',
          marginBottom: 12,
        }}
      >
        {loading ? 'Searching…' : 'Get Recommendations ✨'}
      </button>
      {err && (
        <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>
          {err}
        </div>
      )}
      {recs &&
        recs.map((r, i) => (
          <div
            key={i}
            style={{
              border: '1.5px solid #f3f4f6',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {r.serving}
                </div>
              </div>
              <button
                onClick={() => onAdd(r)}
                style={{
                  padding: '4px 11px',
                  borderRadius: 7,
                  border: 'none',
                  background: '#111',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Log
              </button>
            </div>
            <Pills item={r} sm />
            <div
              style={{
                fontSize: 11,
                color: '#6b7280',
                marginTop: 6,
                fontStyle: 'italic',
              }}
            >
              {r.reason}
            </div>
          </div>
        ))}
    </Modal>
  );
}

function AnalyzeModal({ goals, totals, entries, activeDay, onClose }: any) {
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    run();
  }, []);
  async function run() {
    setLoading(true);
    setErr('');
    setRes(null);
    try {
      const logText = entries
        .flatMap((e: any) => (e.type === 'meal' ? e.items : [e]))
        .map(
          (i: any) =>
            `${i.name}: ${i.calories}kcal ${i.protein}g P ${i.carbs}g C ${
              i.fat
            }g F ${i.fiber || 0}g Fi`
        )
        .join('\n');
      const d = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        system: `Nutrition coach. Respond ONLY with raw JSON: {"score":0,"headline":"","highlights":[""],"improvements":[""],"tip":""}`,
        messages: [
          {
            role: 'user',
            content: `Goals: ${goals.calories}kcal ${goals.protein}g P ${
              goals.carbs
            }g C ${goals.fat}g F ${goals.fiber}g Fi\nActual: ${
              totals.calories
            }kcal ${totals.protein}g P ${totals.carbs}g C ${totals.fat}g F ${
              totals.fiber || 0
            }g Fi\n${logText}`,
          },
        ],
      });
      setRes(
        parseJ(
          d.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('')
        )
      );
    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
  }
  const sc = res?.score || 0,
    col = sc >= 8 ? '#10b981' : sc >= 5 ? '#f59e0b' : '#ef4444',
    bg = sc >= 8 ? '#ecfdf5' : sc >= 5 ? '#fffbeb' : '#fee2e2';
  return (
    <Modal sheet onClose={onClose}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>Day Analysis 📊</div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: '#9ca3af',
          }}
        >
          ✕
        </button>
      </div>
      {loading && (
        <div
          style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}
        >
          🔍 Analyzing…
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: '#ef4444' }}>{err}</div>}
      {res && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              background: bg,
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 14,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  color: col,
                  lineHeight: 1,
                }}
              >
                {res.score}
              </div>
              <div style={{ fontSize: 10, color: col, fontWeight: 600 }}>
                /10
              </div>
            </div>
            <div
              style={{ fontSize: 13, fontWeight: 700, color: '#111', flex: 1 }}
            >
              {res.headline}
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            ✅ Wins
          </div>
          {res.highlights?.map((h: string, i: number) => (
            <div
              key={i}
              style={{
                fontSize: 13,
                color: '#374151',
                padding: '6px 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              ↑ {h}
            </div>
          ))}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              margin: '12px 0 6px',
            }}
          >
            🔧 Improve
          </div>
          {res.improvements?.map((h: string, i: number) => (
            <div
              key={i}
              style={{
                fontSize: 13,
                color: '#374151',
                padding: '6px 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              → {h}
            </div>
          ))}
          <div
            style={{
              background: '#eef2ff',
              borderRadius: 10,
              padding: '11px 13px',
              marginTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#4338ca',
                marginBottom: 3,
              }}
            >
              💡 Tomorrow
            </div>
            <div style={{ fontSize: 13, color: '#374151' }}>{res.tip}</div>
          </div>
          <button
            onClick={run}
            style={{
              width: '100%',
              marginTop: 10,
              padding: '9px 0',
              borderRadius: 9,
              border: '1.5px solid #e5e7eb',
              background: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh ↺
          </button>
        </>
      )}
    </Modal>
  );
}

function RecipeModal({
  recipes,
  onLog,
  onSave,
  onUpdate,
  onDelete,
  onClose,
}: any) {
  const [tab, setTab] = useState(recipes.length > 0 ? 'saved' : 'form');
  const [name, setName] = useState('');
  const [ings, setIngs] = useState('');
  const [servs, setServs] = useState('4');
  const [result, setResult] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [active, setActive] = useState<any>(null);
  const [portion, setPortion] = useState(25);
  const [customP, setCustomP] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [expandedR, setExpandedR] = useState<Record<string, boolean>>({});
  const [editIngs, setEditIngs] = useState<Record<string, string>>({});
  const [editServs, setEditServs] = useState<Record<string, string>>({});
  const ap = useCustom ? parseFloat(customP) || 0 : portion;
  function reset() {
    setName('');
    setIngs('');
    setServs('4');
    setResult(null);
    setErr('');
    setEditing(null);
  }
  async function calc(iText?: string, sText?: string, nText?: string) {
    const i = iText || ings,
      s = sText || servs,
      n = nText || name;
    if (!i.trim()) return;
    setLoading(true);
    setErr('');
    setResult(null);
    try {
      const d = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Nutrition assistant. Search macros for each ingredient, sum totals, divide by servings. Respond ONLY with raw JSON: {"recipeName":"","totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"totalFiber":0,"perServingCalories":0,"perServingProtein":0,"perServingCarbs":0,"perServingFat":0,"perServingFiber":0}`,
        messages: [
          {
            role: 'user',
            content: `Recipe: ${
              n || 'Recipe'
            }\nServings: ${s}\nIngredients:\n${i}`,
          },
        ],
      });
      setResult(
        parseJ(
          d.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('')
        )
      );
    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
  }
  function saveAndPortion() {
    const r = {
      id: editing?.id || Date.now(),
      name: name || result.recipeName || 'Recipe',
      ingredients: ings,
      servings: parseInt(servs) || 1,
      savedAt: editing?.savedAt || Date.now(),
      ...result,
    };
    editing ? onUpdate(r) : onSave(r);
    setActive(r);
    setTab('portion');
  }
  function logIt() {
    const p = ap / 100;
    onLog({
      type: 'single',
      id: Date.now(),
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      name: `${active.name} (${ap}%)`,
      calories: Math.round(active.totalCalories * p),
      protein: Math.round(active.totalProtein * p),
      carbs: Math.round(active.totalCarbs * p),
      fat: Math.round(active.totalFat * p),
      fiber: Math.round(active.totalFiber * p),
    });
    onClose();
  }
  function startEdit(r: any) {
    setEditing(r);
    setName(r.name);
    setIngs(r.ingredients);
    setServs(String(r.servings));
    setResult(null);
    setTab('form');
  }
  const pm = active
    ? {
        calories: Math.round((active.totalCalories * ap) / 100),
        protein: Math.round((active.totalProtein * ap) / 100),
        carbs: Math.round((active.totalCarbs * ap) / 100),
        fat: Math.round((active.totalFat * ap) / 100),
        fiber: Math.round((active.totalFiber * ap) / 100),
      }
    : null;
  return (
    <Modal sheet onClose={onClose}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>🍲 Recipes</div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: '#9ca3af',
          }}
        >
          ✕
        </button>
      </div>
      {tab !== 'portion' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(
            [
              ['saved', `Saved (${recipes.length})`],
              ['form', editing ? 'Edit' : 'New'],
            ] as [string, string][]
          ).map(([t, l]) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === 'form' && !editing) reset();
              }}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 8,
                border: 'none',
                background: tab === t ? '#111' : '#f3f4f6',
                color: tab === t ? '#fff' : '#374151',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {tab === 'saved' && (
        <>
          {recipes.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 0',
                color: '#9ca3af',
                fontSize: 13,
              }}
            >
              No saved recipes yet.
            </div>
          )}
          {recipes.map((r: any) => {
            const isExp = expandedR[r.id];
            const curIngs =
              editIngs[r.id] !== undefined ? editIngs[r.id] : r.ingredients;
            const curServs =
              editServs[r.id] !== undefined
                ? editServs[r.id]
                : String(r.servings);
            return (
              <div
                key={r.id}
                style={{
                  border: '1.5px solid #f3f4f6',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{ cursor: 'pointer', marginBottom: 6 }}
                  onClick={() =>
                    setExpandedR((x) => ({ ...x, [r.id]: !x[r.id] }))
                  }
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {r.name}
                  </span>
                  <span
                    style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}
                  >
                    {r.servings} srv {isExp ? '▲' : '▼'}
                  </span>
                </div>
                <Pills
                  item={{
                    calories: r.totalCalories,
                    protein: r.totalProtein,
                    carbs: r.totalCarbs,
                    fat: r.totalFat,
                    fiber: r.totalFiber,
                  }}
                  sm
                />
                {isExp && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px solid #f3f4f6',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#374151',
                        marginBottom: 5,
                      }}
                    >
                      Ingredients
                    </div>
                    <textarea
                      value={curIngs}
                      onChange={(e) =>
                        setEditIngs((x) => ({ ...x, [r.id]: e.target.value }))
                      }
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1.5px solid #e5e7eb',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                        resize: 'vertical',
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginBottom: 8,
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Servings:
                      </label>
                      <input
                        type="number"
                        value={curServs}
                        onChange={(e) =>
                          setEditServs((x) => ({
                            ...x,
                            [r.id]: e.target.value,
                          }))
                        }
                        min={1}
                        style={{
                          width: 60,
                          padding: '5px 8px',
                          borderRadius: 7,
                          border: '1.5px solid #e5e7eb',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        setName(r.name);
                        setIngs(curIngs);
                        setServs(curServs);
                        setEditing(r);
                        setTab('form');
                        calc(curIngs, curServs, r.name);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 0',
                        borderRadius: 8,
                        border: 'none',
                        background: '#6366f1',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        marginBottom: 4,
                      }}
                    >
                      Recalculate ✨
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setActive(r);
                      setTab('portion');
                    }}
                    style={{
                      flex: 2,
                      padding: '6px 0',
                      borderRadius: 7,
                      border: 'none',
                      background: '#111',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Use
                  </button>
                  <button
                    onClick={() => startEdit(r)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: 7,
                      border: '1.5px solid #e5e7eb',
                      background: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDelete(r.id)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: 7,
                      border: '1.5px solid #fee2e2',
                      background: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: '#ef4444',
                    }}
                  >
                    Del
                  </button>
                </div>
              </div>
            );
          })}
          <button
            onClick={() => {
              reset();
              setTab('form');
            }}
            style={{
              width: '100%',
              padding: '9px 0',
              borderRadius: 8,
              border: '1.5px dashed #e5e7eb',
              background: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              color: '#374151',
              marginTop: 4,
            }}
          >
            + Add new recipe
          </button>
        </>
      )}
      {tab === 'form' && (
        <>
          {editing && (
            <button
              onClick={() => {
                reset();
                setTab('saved');
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                color: '#9ca3af',
                cursor: 'pointer',
                marginBottom: 8,
                padding: 0,
              }}
            >
              ← Back
            </button>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recipe name"
            style={{
              width: '100%',
              padding: '8px 11px',
              borderRadius: 9,
              border: '1.5px solid #e5e7eb',
              fontSize: 13,
              outline: 'none',
              marginBottom: 8,
              boxSizing: 'border-box',
            }}
          />
          <textarea
            value={ings}
            onChange={(e) => setIngs(e.target.value)}
            placeholder={
              'Ingredients (one per line):\n2 chicken breasts\n1 cup rice\n2 tbsp olive oil'
            }
            rows={5}
            style={{
              width: '100%',
              padding: '9px 11px',
              borderRadius: 9,
              border: '1.5px solid #e5e7eb',
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              marginBottom: 8,
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <label
              style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Total servings:
            </label>
            <input
              type="number"
              value={servs}
              onChange={(e) => setServs(e.target.value)}
              min={1}
              style={{
                width: 64,
                padding: '7px 9px',
                borderRadius: 8,
                border: '1.5px solid #e5e7eb',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          {!result && (
            <button
              onClick={() => calc()}
              disabled={loading || !ings.trim()}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: 9,
                border: 'none',
                background: loading ? '#9ca3af' : '#111',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
              }}
            >
              {loading ? '🔍 Calculating…' : 'Calculate Macros ✨'}
            </button>
          )}
          {err && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>
              {err}
            </div>
          )}
          {result && (
            <>
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: 9,
                  padding: '11px 13px',
                  marginBottom: 10,
                  border: '1.5px solid #f3f4f6',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Full recipe · {servs} servings
                </div>
                <Pills
                  item={{
                    calories: result.totalCalories,
                    protein: result.totalProtein,
                    carbs: result.totalCarbs,
                    fat: result.totalFat,
                    fiber: result.totalFiber,
                  }}
                  sm
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setResult(null)}
                  style={{
                    flex: 1,
                    padding: '9px 0',
                    borderRadius: 8,
                    border: '1.5px solid #e5e7eb',
                    background: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Recalc
                </button>
                <button
                  onClick={saveAndPortion}
                  style={{
                    flex: 2,
                    padding: '9px 0',
                    borderRadius: 8,
                    border: 'none',
                    background: '#111',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {editing ? 'Save changes →' : 'Save & portion →'}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {tab === 'portion' && active && (
        <>
          <button
            onClick={() => setTab('saved')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 12,
              color: '#9ca3af',
              cursor: 'pointer',
              marginBottom: 8,
              padding: 0,
            }}
          >
            ← Back
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            {active.name}
          </div>
          <div
            style={{
              background: '#f9fafb',
              borderRadius: 9,
              padding: '10px 12px',
              marginBottom: 12,
            }}
          >
            <Pills
              item={{
                calories: active.totalCalories,
                protein: active.totalProtein,
                carbs: active.totalCarbs,
                fat: active.totalFat,
                fiber: active.totalFiber,
              }}
              sm
            />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              Per serving: {active.perServingCalories} kcal ·{' '}
              {active.perServingProtein}g P
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            How much did you eat?
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap' as const,
              gap: 6,
              marginBottom: 8,
            }}
          >
            {PORTION_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPortion(p);
                  setUseCustom(false);
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 7,
                  border: `1.5px solid ${
                    !useCustom && portion === p ? '#111' : '#e5e7eb'
                  }`,
                  background: !useCustom && portion === p ? '#111' : '#fff',
                  color: !useCustom && portion === p ? '#fff' : '#374151',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {p === 100 ? 'All' : p + '%'}
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              style={{
                padding: '5px 10px',
                borderRadius: 7,
                border: `1.5px solid ${useCustom ? '#111' : '#e5e7eb'}`,
                background: useCustom ? '#111' : '#fff',
                color: useCustom ? '#fff' : '#374151',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Custom
            </button>
          </div>
          {useCustom && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                type="number"
                value={customP}
                onChange={(e) => setCustomP(e.target.value)}
                placeholder="e.g. 35"
                min={1}
                max={100}
                style={{
                  width: 72,
                  padding: '6px 9px',
                  borderRadius: 8,
                  border: '1.5px solid #e5e7eb',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                % of recipe
              </span>
            </div>
          )}
          {pm && ap > 0 && (
            <div
              style={{
                background: '#ecfdf5',
                borderRadius: 9,
                padding: '10px 12px',
                marginBottom: 12,
                border: '1.5px solid #d1fae5',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#047857',
                  marginBottom: 5,
                }}
              >
                Your portion ({ap}%)
              </div>
              <Pills item={pm} sm />
            </div>
          )}
          <button
            onClick={logIt}
            disabled={ap <= 0}
            style={{
              width: '100%',
              padding: '10px 0',
              borderRadius: 9,
              border: 'none',
              background: ap <= 0 ? '#9ca3af' : '#111',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: ap <= 0 ? 'default' : 'pointer',
            }}
          >
            Log {ap}% ✓
          </button>
        </>
      )}
    </Modal>
  );
}

export default function App() {
  const [goals, setGoals] = useState<any>(() => ({
    ...DEFAULT_GOALS,
    ...(lsGet('macro-goals') || {}),
  }));
  const [log, setLog] = useState<any>(() => lsGet('macro-log') || {});
  const [recipes, setRecipes] = useState<any[]>(
    () => lsGet('macro-recipes') || []
  );
  const [activeDay, setActiveDay] = useState(todayStr());
  const [input, setInput] = useState('');
  const [mealName, setMealName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [err, setErr] = useState('');
  const [photoP, setPhotoP] = useState<string | null>(null);
  const [photoB, setPhotoB] = useState<string | null>(null);
  const [photoRes, setPhotoRes] = useState<any>(null);
  const [photoLoad, setPhotoLoad] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [modal, setModal] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const isToday = activeDay === todayStr();
  const dayEntries: any[] = log[activeDay] || [];
  const dayT = sumM(
    dayEntries.flatMap((e: any) => (e.type === 'meal' ? e.items : [e]))
  );
  const needsFiber =
    dayEntries.length > 0 &&
    dayEntries.some((e: any) =>
      e.type === 'meal'
        ? e.items.some((i: any) => i.fiber == null)
        : e.fiber == null
    );

  const addEntry = (entry: any) =>
    setLog((prev: any) => {
      const u = { ...prev, [activeDay]: [...(prev[activeDay] || []), entry] };
      lsSet('macro-log', u);
      return u;
    });
  const removeEntry = (day: string, id: number) =>
    setLog((prev: any) => {
      const u = { ...prev, [day]: prev[day].filter((e: any) => e.id !== id) };
      lsSet('macro-log', u);
      return u;
    });
  const saveGoals = (g: any) => {
    const merged = { ...DEFAULT_GOALS, ...g };
    setGoals(merged);
    lsSet('macro-goals', merged);
    setModal(null);
  };
  const saveRecipes = (r: any[]) => {
    setRecipes(r);
    lsSet('macro-recipes', r);
  };

  async function lookupSingle(desc: string) {
    const d = await callClaude({
      model: 'claude-haiku-4-5-20251001',
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: `Nutrition assistant. If restaurant/store menu item or composed dish, return JSON with items array. Otherwise single item. ONLY raw JSON.\nSingle: {"name":"","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0}\nComposed: {"mealName":"","items":[{"name":"","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0}]}`,
      messages: [{ role: 'user', content: `Macros for: ${desc}` }],
    });
    const text = d.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
    const m = parseJ(text);
    if (m.items) {
      m.items = m.items.map((i: any) => ({ ...i, fiber: i.fiber ?? 0 }));
      return m;
    }
    if (m.calories == null) throw new Error(`No data for "${desc}"`);
    m.fiber = m.fiber ?? 0;
    return m;
  }

  async function handleAdd() {
    if (!input.trim()) return;
    setLoading(true);
    setErr('');
    const ings = input
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    try {
      if (ings.length > 1) {
        const items: any[] = [];
        for (let i = 0; i < ings.length; i++) {
          setLoadMsg(`${i + 1}/${ings.length}: ${ings[i]}…`);
          const r = await lookupSingle(ings[i]);
          if (r.items) items.push(...r.items);
          else items.push(r);
        }
        const entry = {
          type: 'meal',
          id: Date.now(),
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          mealName: mealName.trim() || 'Meal',
          items,
        };
        addEntry(entry);
        setExpanded((x: any) => ({ ...x, [entry.id]: true }));
      } else {
        setLoadMsg('Looking up…');
        const r = await lookupSingle(ings[0]);
        if (r.items) {
          const entry = {
            type: 'meal',
            id: Date.now(),
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            mealName: mealName.trim() || r.mealName || ings[0],
            items: r.items,
          };
          addEntry(entry);
          setExpanded((x: any) => ({ ...x, [entry.id]: true }));
        } else
          addEntry({
            type: 'single',
            id: Date.now(),
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            ...r,
          });
      }
      setInput('');
      setMealName('');
    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
    setLoadMsg('');
  }

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      setPhotoP(ev.target?.result as string);
      setPhotoB((ev.target?.result as string).split(',')[1]);
      setPhotoRes(null);
      setPhotoErr('');
    };
    r.readAsDataURL(f);
  }

  async function analyzePhoto() {
    if (!photoB) return;
    setPhotoLoad(true);
    setPhotoErr('');
    setPhotoRes(null);
    try {
      const d = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        system: `Nutrition expert. Respond ONLY with raw JSON: {"name":"","description":"","serving":"","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"confidence":"low|medium|high"}`,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: photoB,
                },
              },
              { type: 'text', text: 'Identify and estimate macros.' },
            ],
          },
        ],
      });
      const p = parseJ(
        d.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('')
      );
      p.fiber = p.fiber ?? 0;
      setPhotoRes(p);
    } catch (e: any) {
      setPhotoErr(e.message);
    }
    setPhotoLoad(false);
  }

  function logPhoto() {
    if (!photoRes) return;
    addEntry({
      type: 'single',
      id: Date.now(),
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      name: mealName.trim() || photoRes.name,
      ...photoRes,
      photo: photoP,
    });
    setPhotoP(null);
    setPhotoB(null);
    setPhotoRes(null);
    setMealName('');
  }

  async function fixFiber() {
    const updated = JSON.parse(JSON.stringify(dayEntries));
    for (const e of updated) {
      for (const item of e.type === 'meal' ? e.items : [e]) {
        if (item.fiber == null) {
          try {
            const d = await callClaude({
              model: 'claude-haiku-4-5-20251001',
              system: `Return ONLY raw JSON: {"fiber":number}`,
              messages: [
                { role: 'user', content: `Fiber in grams for: ${item.name}` },
              ],
            });
            const p = parseJ(
              d.content
                .filter((b: any) => b.type === 'text')
                .map((b: any) => b.text)
                .join('')
            );
            item.fiber = p.fiber ?? 0;
          } catch {
            item.fiber = 0;
          }
        }
      }
    }
    setLog((prev: any) => {
      const u = { ...prev, [activeDay]: updated };
      lsSet('macro-log', u);
      return u;
    });
  }

  const cc = (c: string) =>
    ({ high: '#10b981', medium: '#f59e0b', low: '#ef4444' }[c] || '#6b7280');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9fafb',
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        paddingBottom: 80,
      }}
    >
      {modal === 'goals' && (
        <GoalModal
          goals={goals}
          onSave={saveGoals}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'cal' && (
        <CalModal
          activeDay={activeDay}
          log={log}
          onSelect={setActiveDay}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'rec' && (
        <RecommendModal
          goals={goals}
          totals={dayT}
          onClose={() => setModal(null)}
          onAdd={(r: any) => {
            addEntry({
              type: 'single',
              id: Date.now(),
              time: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              name: `${r.name} (${r.serving})`,
              ...r,
              fiber: r.fiber ?? 0,
            });
            setModal(null);
          }}
        />
      )}
      {modal === 'analyze' && (
        <AnalyzeModal
          goals={goals}
          totals={dayT}
          entries={dayEntries}
          activeDay={activeDay}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'recipe' && (
        <RecipeModal
          recipes={recipes}
          onLog={addEntry}
          onSave={(r: any) => saveRecipes([...recipes, r])}
          onUpdate={(r: any) =>
            saveRecipes(recipes.map((x: any) => (x.id === r.id ? r : x)))
          }
          onDelete={(id: number) =>
            saveRecipes(recipes.filter((x: any) => x.id !== id))
          }
          onClose={() => setModal(null)}
        />
      )}

      <div
        style={{
          background: '#111',
          color: '#fff',
          padding: '16px 18px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 560,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ cursor: 'pointer' }} onClick={() => setModal('cal')}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>
              Macro Tracker
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
              {isToday ? 'Today — ' : ''}
              {fmtDay(activeDay, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}{' '}
              <span
                style={{
                  fontSize: 10,
                  background: '#374151',
                  borderRadius: 4,
                  padding: '1px 5px',
                }}
              >
                📅
              </span>
            </div>
          </div>
          <button
            onClick={() => setModal('goals')}
            style={{
              background: '#fff',
              color: '#111',
              border: 'none',
              borderRadius: 8,
              padding: '6px 13px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Goals ⚙️
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 14px 0' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 14,
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#6b7280',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {isToday ? "Today's" : "Day's"} Progress
          </div>
          {(
            [
              ['Calories', dayT.calories, goals.calories, 'calories'],
              ['Protein', dayT.protein, goals.protein, 'protein'],
              ['Carbs', dayT.carbs, goals.carbs, 'carbs'],
              ['Fat', dayT.fat, goals.fat, 'fat'],
              ['Fiber', dayT.fiber, goals.fiber, 'fiber'],
            ] as [string, number, number, string][]
          ).map(([l, v, g, k]) => (
            <Bar key={k} label={l} value={v} goal={g} color={COLORS[k]} />
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5,1fr)',
            gap: 5,
            marginBottom: 14,
          }}
        >
          {(
            [
              ['🔥', 'Cals', dayT.calories, goals.calories, 'kcal'],
              ['💪', 'Pro', dayT.protein, goals.protein, 'g'],
              ['🌾', 'C', dayT.carbs, goals.carbs, 'g'],
              ['🥑', 'F', dayT.fat, goals.fat, 'g'],
              ['🥦', 'Fi', dayT.fiber, goals.fiber, 'g'],
            ] as [string, string, number, number, string][]
          ).map(([ic, l, v, g, u]) => (
            <div
              key={l}
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: '9px 4px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              }}
            >
              <div style={{ fontSize: 15 }}>{ic}</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 1 }}>
                {Math.round(v)}
              </div>
              <div style={{ fontSize: 9, color: '#9ca3af' }}>{l}</div>
              <div style={{ fontSize: 9, color: '#d1d5db' }}>
                {g - Math.round(v) > 0 ? `${g - Math.round(v)}${u}` : '✓'}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <button
            onClick={() => setModal('rec')}
            style={{
              padding: '12px 8px',
              borderRadius: 11,
              border: '1.5px solid #6366f1',
              background: '#eef2ff',
              color: '#4338ca',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✨ What to eat next?
          </button>
          <button
            onClick={() => setModal('analyze')}
            disabled={dayEntries.length === 0}
            style={{
              padding: '12px 8px',
              borderRadius: 11,
              border: `1.5px solid ${
                dayEntries.length === 0 ? '#e5e7eb' : '#10b981'
              }`,
              background: dayEntries.length === 0 ? '#f9fafb' : '#ecfdf5',
              color: dayEntries.length === 0 ? '#9ca3af' : '#047857',
              fontSize: 12,
              fontWeight: 700,
              cursor: dayEntries.length === 0 ? 'default' : 'pointer',
            }}
          >
            📊 Analyze this day
          </button>
        </div>

        {needsFiber && (
          <div
            style={{
              background: '#f5f3ff',
              border: '1.5px solid #ddd6fe',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9' }}>
              🥦 Some entries missing fiber
            </div>
            <button
              onClick={fixFiber}
              style={{
                padding: '5px 12px',
                borderRadius: 7,
                border: 'none',
                background: '#6d28d9',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Fix →
            </button>
          </div>
        )}

        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 14,
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Log Food
            </div>
            {!isToday && (
              <div
                style={{
                  fontSize: 10,
                  background: '#fef3c7',
                  color: '#92400e',
                  borderRadius: 5,
                  padding: '2px 7px',
                  fontWeight: 600,
                }}
              >
                Adding to{' '}
                {fmtDay(activeDay, { month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 6,
              }}
            >
              Type it in
            </div>
            <input
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="Meal name (optional)"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 9,
                border: '1.5px solid #e5e7eb',
                fontSize: 13,
                outline: 'none',
                marginBottom: 7,
                boxSizing: 'border-box',
              }}
              disabled={loading}
            />
            <div style={{ display: 'flex', gap: 7 }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !loading) {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder={
                  'Single: "2 eggs" or "Chipotle burrito bowl"\nMeal: "1 scoop protein, 200ml kefir"'
                }
                rows={3}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 9,
                  border: '1.5px solid #e5e7eb',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
                disabled={loading}
              />
              <button
                onClick={handleAdd}
                disabled={loading || !input.trim()}
                style={{
                  padding: '9px 14px',
                  borderRadius: 9,
                  border: 'none',
                  background: loading ? '#9ca3af' : '#111',
                  color: '#fff',
                  cursor: loading ? 'default' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  alignSelf: 'flex-end',
                }}
              >
                {loading ? '⏳' : 'Add'}
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
              Restaurant meals auto-expand into ingredients.
            </div>
            {err && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444' }}>
                {err}
              </div>
            )}
            {loading && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                🔍 {loadMsg}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
              OR
            </span>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
          </div>
          <button
            onClick={() => setModal('recipe')}
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 10,
              border: '1.5px solid #e5e7eb',
              background: '#fff',
              color: '#374151',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <span>
              🍲 Log from a recipe{' '}
              {recipes.length > 0 && (
                <span style={{ fontSize: 10, color: '#9ca3af' }}>
                  ({recipes.length} saved)
                </span>
              )}
            </span>
            <span style={{ color: '#9ca3af' }}>→</span>
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
              OR
            </span>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 4,
              }}
            >
              📷 Log from a photo
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
              Snap or upload a photo — we'll identify the dish and estimate
              macros.
            </div>
            <label style={{ display: 'block', cursor: 'pointer' }}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoFile}
                style={{ display: 'none' }}
              />
              {photoP ? (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <img
                    src={photoP}
                    alt="meal"
                    style={{
                      width: '100%',
                      borderRadius: 10,
                      maxHeight: 200,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      background: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      fontSize: 10,
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontWeight: 600,
                    }}
                  >
                    Tap to change
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: '2px dashed #e5e7eb',
                    borderRadius: 10,
                    padding: '20px 14px',
                    textAlign: 'center',
                    background: '#fafafa',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}
                  >
                    Take photo or upload
                  </div>
                </div>
              )}
            </label>
            {photoP && !photoRes && (
              <button
                onClick={analyzePhoto}
                disabled={photoLoad}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: 9,
                  border: 'none',
                  background: photoLoad ? '#9ca3af' : '#111',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: photoLoad ? 'default' : 'pointer',
                  marginBottom: 8,
                }}
              >
                {photoLoad ? '🔍 Analyzing…' : 'Estimate Macros ✨'}
              </button>
            )}
            {photoErr && (
              <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 6 }}>
                {photoErr}
              </div>
            )}
            {photoRes && (
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 5,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>
                      {photoRes.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {photoRes.serving}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      background: cc(photoRes.confidence) + '22',
                      color: cc(photoRes.confidence),
                      borderRadius: 99,
                      padding: '2px 8px',
                      fontWeight: 700,
                      textTransform: 'capitalize' as const,
                    }}
                  >
                    {photoRes.confidence}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#6b7280',
                    marginBottom: 8,
                    fontStyle: 'italic',
                  }}
                >
                  {photoRes.description}
                </div>
                <Pills item={photoRes} sm />
                <input
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder={`Name (default: "${photoRes.name}")`}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 7,
                    border: '1.5px solid #e5e7eb',
                    fontSize: 11,
                    outline: 'none',
                    marginTop: 8,
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 7,
                    marginTop: 8,
                  }}
                >
                  <button
                    onClick={() => {
                      setPhotoRes(null);
                      setPhotoP(null);
                      setPhotoB(null);
                    }}
                    style={{
                      padding: '8px 0',
                      borderRadius: 8,
                      border: '1.5px solid #e5e7eb',
                      background: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Retake
                  </button>
                  <button
                    onClick={logPhoto}
                    style={{
                      padding: '8px 0',
                      borderRadius: 8,
                      border: 'none',
                      background: '#111',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Log it ✓
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {dayEntries.length > 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 14,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#6b7280',
                marginBottom: 10,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Log
            </div>
            {dayEntries.map((entry: any) => {
              if (entry.type === 'meal') {
                const mt = sumM(entry.items),
                  op = expanded[entry.id];
                return (
                  <div
                    key={entry.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      paddingBottom: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() =>
                          setExpanded((x: any) => ({
                            ...x,
                            [entry.id]: !x[entry.id],
                          }))
                        }
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 700 }}>
                            {entry.mealName}
                          </span>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>
                            {entry.items.length} items · {entry.time}{' '}
                            {op ? '▲' : '▼'}
                          </span>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Pills item={mt} sm />
                        </div>
                      </div>
                      <button
                        onClick={() => removeEntry(activeDay, entry.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#d1d5db',
                          fontSize: 15,
                          padding: '0 3px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    {op && (
                      <div
                        style={{
                          marginTop: 8,
                          paddingLeft: 10,
                          borderLeft: '2px solid #f3f4f6',
                        }}
                      >
                        {entry.items.map((item: any, i: number) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '5px 0',
                              borderBottom:
                                i < entry.items.length - 1
                                  ? '1px solid #f9fafb'
                                  : 'none',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: '#374151',
                                flex: 1,
                                marginRight: 6,
                              }}
                            >
                              {item.name}
                            </span>
                            <Pills item={item} sm />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              const op = expanded[entry.id];
              return (
                <div
                  key={entry.id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    paddingBottom: 8,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        cursor: entry.photo ? 'pointer' : 'default',
                      }}
                      onClick={() =>
                        entry.photo &&
                        setExpanded((x: any) => ({
                          ...x,
                          [entry.id]: !x[entry.id],
                        }))
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        {entry.photo && (
                          <span style={{ fontSize: 10 }}>📷</span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {entry.name}
                        </span>
                        {entry.photo && (
                          <span style={{ color: '#d1d5db', fontSize: 11 }}>
                            {op ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                      <div
                        style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}
                      >
                        {entry.time}
                        {entry.confidence && (
                          <span
                            style={{
                              marginLeft: 5,
                              color: cc(entry.confidence),
                              fontWeight: 600,
                              textTransform: 'capitalize' as const,
                            }}
                          >
                            {' '}
                            · {entry.confidence}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ marginRight: 8 }}>
                      <Pills item={entry} sm />
                    </div>
                    <button
                      onClick={() => removeEntry(activeDay, entry.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#d1d5db',
                        fontSize: 15,
                        padding: '0 3px',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  {op && entry.photo && (
                    <div
                      style={{
                        marginTop: 8,
                        paddingLeft: 10,
                        borderLeft: '2px solid #f3f4f6',
                      }}
                    >
                      <img
                        src={entry.photo}
                        alt={entry.name}
                        style={{
                          width: '100%',
                          borderRadius: 8,
                          maxHeight: 160,
                          objectFit: 'cover',
                          marginBottom: 6,
                        }}
                      />
                      {entry.description && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#6b7280',
                            fontStyle: 'italic',
                          }}
                        >
                          {entry.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {dayEntries.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '28px 0',
              color: '#9ca3af',
              fontSize: 13,
            }}
          >
            {isToday ? 'Nothing logged yet.' : 'No entries for this day.'}
          </div>
        )}
      </div>
    </div>
  );
}
