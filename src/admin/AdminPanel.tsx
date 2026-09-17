import { useState, useRef, useEffect } from 'react';
import type {
  SiteData,
  Profile,
  Contact,
  Social,
  Project,
  TimelineItem,
  SkillGroup,
  Post,
} from '../types';
import { autoExcerpt, slugify } from '../markdown';
import { hashPass, logout } from '../auth';
import MarkdownEditor from './MarkdownEditor';
import { loadSite, saveSite, resetSite, exportSite, importSite, newId, pushToCloud } from '../store';

/* ---------- 可复用子组件 ---------- */

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-mono tracking-wider text-slate-300 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-void/60 border border-line px-3 py-2 text-slate-100 text-sm focus:border-cyan focus:outline-none focus:shadow-neon transition-all"
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-mono tracking-wider text-slate-300 mb-1">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-void/60 border border-line px-3 py-2 text-slate-100 text-sm focus:border-cyan focus:outline-none focus:shadow-neon transition-all resize-y"
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-mono tracking-wider text-slate-300 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-void/60 border border-line px-3 py-2 text-slate-100 text-sm focus:border-cyan focus:outline-none focus:shadow-neon transition-all"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-mono tracking-wider text-slate-300 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-full bg-void/60 border border-line px-3 py-2 text-slate-100 text-sm focus:border-cyan focus:outline-none focus:shadow-neon transition-all"
      />
    </div>
  );
}

function StringListEditor({
  id,
  label,
  items,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (!v) return;
    onChange([...items, v]);
    setInput('');
  };

  const remove = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-mono tracking-wider text-slate-300 mb-1">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
        {items.map((it, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-cyan/10 border border-cyan/40 px-2 py-1 text-xs text-cyan font-mono"
          >
            {it}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-magenta hover:text-cyan ml-0.5"
              aria-label={`移除 ${it}`}
            >
              ✕
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-muted">暂无</span>}
      </div>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1 bg-void/60 border border-line px-3 py-2 text-slate-100 text-sm focus:border-cyan focus:outline-none focus:shadow-neon transition-all"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all"
        >
          添加
        </button>
      </div>
    </div>
  );
}

/* ---------- 主组件 ---------- */

type TabKey = 'profile' | 'posts' | 'projects' | 'timeline' | 'skills' | 'settings' | 'data';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'posts', label: '博客' },
  { key: 'profile', label: '基本资料' },
  { key: 'projects', label: '项目' },
  { key: 'timeline', label: '历程' },
  { key: 'skills', label: '技能' },
  { key: 'settings', label: '设置' },
  { key: 'data', label: '数据' },
];

/* ---------- 趋势折线图（SVG 手绘，无依赖） ---------- */
function TrendChart({ daily, range }: { daily: { day: string; views: number; uv: number }[]; range: 7 | 30 }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 200;
  const padL = 36;
  const padB = 26;
  const padT = 12;
  const padR = 12;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const days = Math.min(range, daily.length);
  const series = daily.slice(0, days).reverse(); // 按时间正序
  // 两条线共用同一 Y 轴，否则各自按自身峰值归一化会让数值不可比，
  // 视觉上出现「真实人数线高于总访问线」的错觉（实则 uv ≤ views 恒成立）。
  const maxAll = Math.max(1, ...series.map((d) => d.views), ...series.map((d) => d.uv));

  const x = (i: number) => padL + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const yV = (v: number) => padT + plotH - (v / maxAll) * plotH;
  const yUv = (v: number) => padT + plotH - (v / maxAll) * plotH;

  const line = (key: 'views' | 'uv', yfn: (v: number) => number) =>
    series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yfn(d[key]).toFixed(1)}`).join(' ');
  const area = (yfn: (v: number) => number) =>
    `${line('views', yfn)} L ${x(series.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxAll * f));
  const labelEvery = series.length > 15 ? 5 : series.length > 10 ? 3 : 1;

  const hd = hover != null ? series[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="每日访问趋势折线图"
        onMouseLeave={() => setHover(null)}
      >
        {/* 网格 + Y 轴刻度 */}
        {[0, 0.5, 1].map((f, i) => {
          const yy = padT + plotH - f * plotH;
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#232342" strokeWidth={1} />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize={9} fill="#7a7a9a" fontFamily="monospace">
                {yTicks[i]}
              </text>
            </g>
          );
        })}
        {/* 面积 */}
        <path d={area(yV)} fill="rgba(0,240,255,0.12)" />
        {/* 真实人数线（magenta） */}
        <path d={line('uv', yUv)} fill="none" stroke="#ff00a0" strokeWidth={1.6} />
        {/* 总访问线（cyan） */}
        <path d={line('views', yV)} fill="none" stroke="#00f0ff" strokeWidth={1.8} />
        {/* 透明粗线用于 hover 命中 */}
        <path
          d={line('views', yV)}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGPathElement).getBoundingClientRect();
            const rel = (e.clientX - rect.left) / rect.width;
            const idx = Math.round(rel * (series.length - 1));
            setHover(Math.max(0, Math.min(series.length - 1, idx)));
          }}
        />
        {/* X 轴日期 */}
        {series.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.day}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={8}
              fill="#7a7a9a"
              fontFamily="monospace"
            >
              {d.day.slice(5)}
            </text>
          ) : null,
        )}
        {/* 端点 + hover 高亮 */}
        {series.map((d, i) => (
          <circle
            key={d.day}
            cx={x(i)}
            cy={yV(d.views)}
            r={hover === i ? 3.4 : 1.8}
            fill={hover === i ? '#fff' : '#00f0ff'}
          />
        ))}
      </svg>
      {hd && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-line bg-void/95 px-2 py-1 font-mono text-[10px] leading-tight text-slate-200 shadow-neon"
          style={{
            left: `${((hover! / Math.max(1, series.length - 1)) * 100).toFixed(1)}%`,
            top: 4,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-muted">{hd.day}</div>
          <div className="text-cyan">访问 {hd.views} 次</div>
          <div className="text-magenta">人数 {hd.uv} 人</div>
        </div>
      )}
      <div className="flex gap-4 mt-1 text-[10px] font-mono">
        <span className="flex items-center gap-1 text-cyan">
          <span className="inline-block w-3 h-0.5 bg-cyan" /> 总访问次数
        </span>
        <span className="flex items-center gap-1 text-magenta">
          <span className="inline-block w-3 h-0.5 bg-magenta" /> 真实访问人数
        </span>
      </div>
    </div>
  );
}

/* ---------- 国家占比甜甜圈（SVG） ---------- */
const DONUT_COLORS = ['#00f0ff', '#ff00a0', '#a3e635', '#f59e0b', '#8b5cf6', '#ef4444', '#22d3ee'];
function CountryDonut({ rows, total }: { rows: { country: string; c: number }[]; total: number }) {
  const R = 60;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0" role="img" aria-label="国家占比饼图">
        <circle cx={80} cy={80} r={R} fill="none" stroke="#232342" strokeWidth={18} />
        {rows.map((r, i) => {
          const frac = r.c / total;
          const dash = frac * C;
          const seg = (
            <circle
              key={r.country}
              cx={80}
              cy={80}
              r={R}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth={18}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-acc * C}
              transform="rotate(-90 80 80)"
            >
              <title>{`${r.country === 'XX' ? '未知' : r.country}: ${(frac * 100).toFixed(1)}%`}</title>
            </circle>
          );
          acc += frac;
          return seg;
        })}
        <text x={80} y={76} textAnchor="middle" fontSize={13} fill="#e2e8f0" fontFamily="monospace">
          {total}
        </text>
        <text x={80} y={92} textAnchor="middle" fontSize={8} fill="#7a7a9a" fontFamily="monospace">
          总访问
        </text>
      </svg>
      <ul className="space-y-1 text-xs">
        {rows.slice(0, 8).map((r, i) => (
          <li key={r.country} className="flex items-center gap-2 font-mono">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="text-slate-200">{r.country === 'XX' ? '未知' : r.country}</span>
            <span className="text-cyan">{((r.c / total) * 100).toFixed(1)}%</span>
            <span className="text-line">({r.c})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- 访问统计面板 ---------- */
type StatData = {
  totalViews: number;
  uniqueVisitors: number;
  perPost: { slug: string; views: number; reads: number; avg_duration: number }[];
  byCountry: { country: string; c: number }[];
  daily: { day: string; views: number; uv: number; reads: number }[];
};

function StatsPanel() {
  const [data, setData] = useState<StatData | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const [range, setRange] = useState<7 | 30>(7);

  async function load(sinceDays?: number) {
    setLoading(true);
    setErr('');
    try {
      const site = loadSite();
      const hash = site.settings?.adminPassHash || '';
      const since =
        sinceDays != null
          ? new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10)
          : '';
      const url = since ? `/api/track?since=${since}` : '/api/track';
      const r = await fetch(url, { headers: { 'x-admin-hash': hash } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || '加载失败');
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
  }, [range]);

  const [expanded, setExpanded] = useState(false);

  const maxViews = Math.max(1, ...(data?.perPost.map((p) => p.views) || []));
  const totalCountry = data?.byCountry.reduce((s, c) => s + c.c, 0) || 1;
  const titleOf = (slug: string) => {
    if (slug.startsWith('page:')) {
      const map: Record<string, string> = {
        home: '🏠 首页',
        blog: '📝 博客列表',
        about: '👤 关于',
        projects: '💼 作品',
        timeline: '📈 历程',
        skills: '🛠 技能',
        contact: '📮 联系',
      };
      return map[slug.slice(5)] || slug;
    }
    const p = loadSite().posts.find((x) => x.slug === slug);
    return p?.title || slug;
  };

  return (
    <section className="cyber-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-label">访问统计（D1 实时）</h2>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="px-3 py-1 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all disabled:opacity-50"
        >
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {err && <p className="text-magenta text-xs mt-3">{err}</p>}

      {data && (
        <div className="mt-4 space-y-6">
          {/* 总览 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="border border-line p-3">
              <div className="font-display text-2xl text-cyan">{data.totalViews}</div>
              <div className="text-xs text-muted mt-1">总访问次数</div>
              <div className="text-[10px] text-line mt-0.5 leading-tight">所有页面+文章的浏览量总和（同一人反复看会重复计）</div>
            </div>
            <div className="border border-line p-3">
              <div className="font-display text-2xl text-cyan">{data.uniqueVisitors}</div>
              <div className="text-xs text-muted mt-1">真实访问人数</div>
              <div className="text-[10px] text-line mt-0.5 leading-tight">按 IP 去重后的独立访客数（同一人只算 1 个）</div>
            </div>
            <div className="border border-line p-3">
              <div className="font-display text-2xl text-cyan">{data.perPost.length}</div>
              <div className="text-xs text-muted mt-1">有数据的页面</div>
              <div className="text-[10px] text-line mt-0.5 leading-tight">被访问过的页面/文章数量（不含无人看的）</div>
            </div>
            <div className="border border-line p-3">
              <div className="font-display text-2xl text-cyan">
                {data.byCountry.length}
              </div>
              <div className="text-xs text-muted mt-1">国家/地区数</div>
              <div className="text-[10px] text-line mt-0.5 leading-tight">访客来源的国家分布（仅国家级，无省份）</div>
            </div>
            <div className="border border-line p-3">
              <div className="font-display text-2xl text-cyan">
                {data.daily.length ? data.daily[data.daily.length - 1].views : 0}
              </div>
              <div className="text-xs text-muted mt-1">今日访问</div>
              <div className="text-[10px] text-line mt-0.5 leading-tight">当天（按 UTC）产生的访问次数</div>
            </div>
          </div>

          {/* 每篇文章阅读数（折叠前25） */}
          <div>
            <h3 className="text-xs font-mono text-muted mb-2">
              各文章阅读次数 / 平均时长（已隐藏已删除文章）
            </h3>
            {(() => {
              const visible = data.perPost.filter((p) => titleOf(p.slug) !== p.slug);
              const shown = expanded ? visible : visible.slice(0, 25);
              return (
                <div className="space-y-2">
                  {shown.map((p) => (
                    <div key={p.slug} className="flex items-center gap-3">
                      <div className="w-48 shrink-0 truncate text-sm text-slate-200" title={titleOf(p.slug)}>
                        {titleOf(p.slug)}
                      </div>
                      <div className="h-2 flex-1 bg-void/60">
                        <div
                          className="h-full bg-cyan"
                          style={{ width: `${(p.views / maxViews) * 100}%` }}
                        />
                      </div>
                      <div className="w-16 shrink-0 text-right font-mono text-xs text-muted">
                        {p.views} 次
                      </div>
                      <div className="w-20 shrink-0 text-right font-mono text-xs text-muted">
                        {Math.round(p.avg_duration)}s 均
                      </div>
                    </div>
                  ))}
                  {visible.length === 0 && (
                    <p className="text-xs text-muted">暂无数据，访问文章后自动累计</p>
                  )}
                  {visible.length > 25 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => !e)}
                      className="text-xs text-cyan hover:text-magenta"
                    >
                      {expanded ? '收起' : `展开全部 ${visible.length} 条`}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 国家占比（显示具体数量） */}
          <div>
            <h3 className="text-xs font-mono text-muted mb-2">国家 / 地区占比</h3>
            <div className="flex flex-wrap gap-2">
              {data.byCountry.map((c) => (
                <span
                  key={c.country}
                  className="border border-line px-2 py-1 font-mono text-xs text-slate-200"
                  title={`${c.country === 'XX' ? '未知' : c.country}：${c.c} 次访问`}
                >
                  {c.country === 'XX' ? '未知' : c.country} ·{' '}
                  <span className="text-cyan">{c.c} 次</span> ·{' '}
                  <span className="text-muted">
                    {((c.c / totalCountry) * 100).toFixed(1)}%
                  </span>
                </span>
              ))}
              {data.byCountry.length === 0 && (
                <p className="text-xs text-muted">暂无数据</p>
              )}
            </div>
          </div>

          {/* 趋势折线图（7/30 天切换） */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-mono text-muted">每日访问趋势</h3>
              <div className="flex gap-1">
                {([7, 30] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-2 py-0.5 font-mono text-xs border transition-all ${
                      range === r
                        ? 'border-cyan text-cyan shadow-neon'
                        : 'border-line text-muted hover:text-slate-300'
                    }`}
                  >
                    {r}天
                  </button>
                ))}
              </div>
            </div>

            {data.daily.length === 0 ? (
              <p className="text-xs text-muted py-8 text-center">近 {range} 天暂无访问数据</p>
            ) : (
              <TrendChart daily={data.daily} range={range} />
            )}
          </div>

          {/* 国家占比甜甜圈 */}
          <div>
            <h3 className="text-xs font-mono text-muted mb-2">国家 / 地区占比</h3>
            {data.byCountry.length === 0 ? (
              <p className="text-xs text-muted">暂无数据</p>
            ) : (
              <CountryDonut rows={data.byCountry} total={totalCountry} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminPanel() {
  const [state, setState] = useState<SiteData>(() => loadSite());
  const [activeTab, setActiveTab] = useState<TabKey>('posts');
  const [showSaved, setShowSaved] = useState(false);
  const [coverErrors, setCoverErrors] = useState<Record<string, string>>({});
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [saveError, setSaveError] = useState('');
  /** 当前展开编辑的文章 id；null 表示都折叠 */
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [passMsg, setPassMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [tgText, setTgText] = useState('');
  const [tgStatus, setTgStatus] = useState<{ kind: 'ok' | 'err' | 'sending'; text: string } | null>(null);

  /* ---------- AI 模型拉取与多选 ---------- */
  const [aiAvailableModels, setAiAvailableModels] = useState<string[]>([]);
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [aiModelsError, setAiModelsError] = useState('');

  /* ---------- MCP API Key 管理 ---------- */
  const [mcpKeyName, setMcpKeyName] = useState('');
  const [mcpNewKey, setMcpNewKey] = useState<string | null>(null);
  const [mcpMsg, setMcpMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const mcpKeys = state.settings.mcpKeys || [];

  async function fetchAiModels() {
    setAiModelsLoading(true);
    setAiModelsError('');
    try {
      const site = loadSite();
      const hash = site.settings?.adminPassHash || '';
      const r = await fetch('/api/models', { headers: { 'x-admin-hash': hash } });
      const j = await r.json();
      if (j.ok && Array.isArray(j.models)) {
        setAiAvailableModels(j.models);
      } else {
        setAiModelsError(j.error || '拉取失败');
      }
    } catch (e) {
      setAiModelsError(String(e));
    } finally {
      setAiModelsLoading(false);
    }
  }

  /** 当前已选模型列表（从 settings.aiModels 解析） */
  const selectedAiModels = (state.settings.aiModels ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  function toggleAiModel(model: string) {
    const next = selectedAiModels.includes(model)
      ? selectedAiModels.filter((m) => m !== model)
      : [...selectedAiModels, model];
    updateSettings({ aiModels: next.join(',') });
  }

  /** 把拉取到的可用模型按当前未选顺序追加到列表末尾（保留已选顺序） */
  function addAllAiModels() {
    const existing = new Set(selectedAiModels);
    const toAdd = aiAvailableModels.filter((m) => !existing.has(m));
    if (toAdd.length === 0) return;
    updateSettings({ aiModels: [...selectedAiModels, ...toAdd].join(',') });
  }

  async function sendToTelegram(textOverride?: string, photo = false) {
    const text = (textOverride ?? tgText).trim();
    if (!text) { setTgStatus({ kind: 'err', text: '请输入要推送的内容' }); return; }
    const site = loadSite();
    const hash = site.settings?.adminPassHash || '';
    setTgStatus({ kind: 'sending', text: '发送中…' });
    try {
      const r = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-hash': hash },
        body: JSON.stringify({ text, photo }),
      });
      const j = await r.json();
      if (j.ok) setTgStatus({ kind: 'ok', text: '已推送到群和频道 ✅' });
      else setTgStatus({ kind: 'err', text: j.error || '发送失败' });
    } catch (e) {
      setTgStatus({ kind: 'err', text: String(e) });
    }
  }

  const savedRef = useRef<string>(JSON.stringify(state));
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = JSON.stringify(state) !== savedRef.current;

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  // 有未保存修改时，拦截关闭/刷新与返回前台，避免内容丢失
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onHashChange = () => {
      if (window.location.pathname.startsWith('/admin')) return;
      if (!window.confirm('有未保存的修改，确定离开后台？修改将丢失。')) {
        window.history.pushState({}, '', '/admin');
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [dirty]);

  /* ----- 保存 / 数据操作 ----- */

  const handleSave = () => {
    try {
      saveSite(state);
      savedRef.current = JSON.stringify(state);
      setSaveError('');
      setShowSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setShowSaved(false), 2000);
      // 同步到云端（D1）。失败不影响本地保存。
      pushToCloud(state, state.settings.adminPassHash).then((ok) => {
        if (ok) console.info('[portfolio] 已同步到云端');
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存失败');
      setShowSaved(false);
    }
  };

  const handleImport = () => {
    try {
      const data = importSite(importText);
      setState(data);
      setImportError('');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '导入失败：JSON 格式错误');
    }
  };

  const handleReset = () => {
    if (!window.confirm('确定恢复默认内容？当前所有修改将丢失。')) return;
    resetSite();
    const fresh = loadSite();
    setState(fresh);
    savedRef.current = JSON.stringify(fresh);
  };

  /* ----- Profile / Contacts / Socials ----- */

  const updateProfile = (patch: Partial<Profile>) =>
    setState((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));

  const updateContact = (index: number, patch: Partial<Contact>) =>
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        contacts: prev.profile.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
      },
    }));

  const removeContact = (index: number) =>
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        contacts: prev.profile.contacts.filter((_, i) => i !== index),
      },
    }));

  const addContact = () =>
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        contacts: [...prev.profile.contacts, { label: '', value: '', href: '' }],
      },
    }));

  const updateSocial = (index: number, patch: Partial<Social>) =>
    setState((prev) => ({
      ...prev,
      socials: prev.socials.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));

  const removeSocial = (index: number) =>
    setState((prev) => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index),
    }));

  const addSocial = () =>
    setState((prev) => ({
      ...prev,
      socials: [...prev.socials, { name: '', handle: '', href: '', icon: '' }],
    }));

  /* ----- Projects ----- */

  const updateProject = (id: string, patch: Partial<Project>) =>
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const removeProject = (id: string) => {
    const target = state.projects.find((p) => p.id === id);
    if (!window.confirm(`确定删除项目「${target?.name || '未命名'}」？此操作不可撤销。`)) return;
    setState((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
    }));
  };

  const addProject = () =>
    setState((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        {
          id: newId(),
          name: '',
          subtitle: '',
          desc: '',
          tags: [],
          highlights: [],
          status: '开发中',
          accent: 'cyan',
        },
      ],
    }));

  const handleCoverUpload = (projectId: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > 400 * 1024) {
      setCoverErrors((prev) => ({ ...prev, [projectId]: '文件过大（超过 400KB），请使用更小的图片' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === projectId ? { ...p, cover: result } : p)),
      }));
      setCoverErrors((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const removeCover = (projectId: string) =>
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === projectId ? { ...p, cover: undefined } : p)),
    }));

  /* ----- Timeline ----- */

  const updateTimeline = (id: string, patch: Partial<TimelineItem>) =>
    setState((prev) => ({
      ...prev,
      timeline: prev.timeline.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));

  const removeTimeline = (id: string) => {
    const target = state.timeline.find((t) => t.id === id);
    if (!window.confirm(`确定删除历程「${target?.title || '未命名'}」？此操作不可撤销。`)) return;
    setState((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((t) => t.id !== id),
    }));
  };

  const addTimeline = () =>
    setState((prev) => ({
      ...prev,
      timeline: [
        ...prev.timeline,
        { id: newId(), period: '', title: '', desc: '', tags: [], current: false },
      ],
    }));

  const handleCurrentChange = (id: string, checked: boolean) =>
    setState((prev) => ({
      ...prev,
      timeline: prev.timeline.map((t) => {
        if (t.id === id) return { ...t, current: checked };
        if (checked) return { ...t, current: false };
        return t;
      }),
    }));

  /* ----- Skills ----- */

  const updateSkill = (id: string, patch: Partial<SkillGroup>) =>
    setState((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  const removeSkill = (id: string) => {
    const target = state.skills.find((s) => s.id === id);
    if (!window.confirm(`确定删除技能分组「${target?.group || '未命名'}」？此操作不可撤销。`)) return;
    setState((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s.id !== id),
    }));
  };

  const addSkill = () =>
    setState((prev) => ({
      ...prev,
      skills: [...prev.skills, { id: newId(), group: '', items: [] }],
    }));

  /* ----- 博客文章 ----- */

  const updatePost = (id: string, patch: Partial<Post>) =>
    setState((prev) => ({
      ...prev,
      posts: prev.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const removePost = (id: string) => {
    const target = state.posts.find((p) => p.id === id);
    if (!window.confirm(`确定删除文章「${target?.title || '未命名'}」？此操作不可撤销。`)) return;
    setState((prev) => ({ ...prev, posts: prev.posts.filter((p) => p.id !== id) }));
  };

  const addPost = () => {
    const today = new Date().toISOString().slice(0, 10);
    const fresh: Post = {
      id: newId(),
      slug: 'post-' + Date.now().toString(36),
      title: '',
      excerpt: '',
      body: '',
      tags: [],
      date: today,
      published: false,
    };
    setState((prev) => ({ ...prev, posts: [fresh, ...prev.posts] }));
    setExpandedPost(fresh.id);
  };

  /** 由标题生成 slug，并保证站内唯一 */
  const regenSlug = (id: string) => {
    const post = state.posts.find((p) => p.id === id);
    if (!post || !post.title.trim()) return;
    let base = slugify(post.title);
    const taken = new Set(state.posts.filter((p) => p.id !== id).map((p) => p.slug));
    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) candidate = `${base}-${n++}`;
    updatePost(id, { slug: candidate });
  };

  const fillExcerpt = (id: string) => {
    const post = state.posts.find((p) => p.id === id);
    if (!post) return;
    updatePost(id, { excerpt: autoExcerpt(post.body, 120) });
  };

  const handlePostCover = (postId: string, file: File | null) => {
    if (!file) return;
    if (file.size > 400 * 1024) {
      setCoverErrors((prev) => ({
        ...prev,
        ['post-' + postId]: '文件过大（超过 400KB），请使用更小的图片',
      }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      updatePost(postId, { cover: result });
      setCoverErrors((prev) => {
        const next = { ...prev };
        delete next['post-' + postId];
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  /* ----- 设置 ----- */

  const updateSettings = (patch: Partial<SiteData['settings']>) =>
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

  const handleChangePass = async () => {
    if (newPass.length < 6) {
      setPassMsg({ kind: 'err', text: '口令至少 6 位' });
      return;
    }
    if (newPass !== newPass2) {
      setPassMsg({ kind: 'err', text: '两次输入不一致' });
      return;
    }
    try {
      const hash = await hashPass(newPass);
      const next = { ...state, settings: { ...state.settings, adminPassHash: hash } };
      setState(next);
      saveSite(next);
      savedRef.current = JSON.stringify(next);
      // 立即同步到云端 D1（旧代码漏了这一步，导致刷新/换设备后旧密码生效）
      pushToCloud(next, hash).then((ok) => {
        setPassMsg({
          kind: ok ? 'ok' : 'ok',
          text: ok ? '口令已更新并同步到云端' : '口令已更新（本地已保存，云端同步失败，请稍后点保存重试）',
        });
      });
      setNewPass('');
      setNewPass2('');
    } catch (e) {
      setPassMsg({ kind: 'err', text: e instanceof Error ? e.message : '更新失败' });
    }
  };

  const handleClearPass = () => {
    if (!window.confirm('清除口令后，任何人都能进入后台修改内容。确定继续？')) return;
    const next = { ...state, settings: { ...state.settings, adminPassHash: '' } };
    setState(next);
    saveSite(next);
    savedRef.current = JSON.stringify(next);
    setPassMsg({ kind: 'ok', text: '口令已清除' });
  };

  /* ----- 渲染 ----- */

  return (
    <div className="min-h-screen bg-void">
      {/* 顶部栏 + 标签栏 */}
      <header className="sticky top-0 z-20 bg-void/95 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <h1 className="font-display font-bold text-lg text-cyan neon-text tracking-wider">
            内容管理后台
          </h1>
          <div className="flex-1" />
          {dirty && (
            <span className="text-magenta text-xs font-mono">● 有未保存修改</span>
          )}
          {showSaved && (
            <span className="text-lime text-xs font-mono">✓ 已保存</span>
          )}
          <button type="button" onClick={handleSave} className="btn-neon">
            保存
          </button>
          <a
            href="/"
            className="text-slate-300 hover:text-cyan text-xs font-mono border border-line px-3 py-2 transition-all"
          >
            返回前台
          </a>
        </div>
        {saveError && (
          <div className="border-t border-magenta/40 bg-magenta/10 px-4 py-2" role="alert">
            <p className="mx-auto max-w-6xl font-mono text-xs text-magenta">⚠ {saveError}</p>
          </div>
        )}
        <nav className="border-t border-line">
          <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-3 font-mono text-xs tracking-wider uppercase transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'text-cyan neon-text'
                    : 'text-muted hover:text-slate-300'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-cyan shadow-neon" />
                )}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* ===== 基本资料 ===== */}
        {activeTab === 'posts' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-label">
                文章管理（共 {state.posts.length} 篇 ·{' '}
                {state.posts.filter((p) => p.published).length} 篇已发布）
              </h2>
              <button type="button" onClick={addPost} className="btn-neon">
                + 写新文章
              </button>
            </div>

            {state.posts.length === 0 && (
              <p className="cyber-card p-8 text-center font-mono text-sm text-muted">
                还没有文章，点击右上角开始写
              </p>
            )}

            {state.posts.map((post) => {
              const open = expandedPost === post.id;
              return (
                <article key={post.id} className="cyber-card p-5">
                  {/* 折叠头部 */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedPost(open ? null : post.id)}
                      className="flex flex-1 items-center gap-3 text-left"
                      aria-expanded={open}
                    >
                      <span className="font-mono text-xs text-cyan">{open ? '▾' : '▸'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display font-bold text-slate-100">
                          {post.title || '（未命名文章）'}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-muted">
                          {post.date} · {post.slug}
                        </span>
                      </span>
                    </button>

                    <span
                      className={
                        post.published
                          ? 'border border-lime/50 px-2 py-0.5 font-mono text-[10px] text-lime'
                          : 'border border-line px-2 py-0.5 font-mono text-[10px] text-muted'
                      }
                    >
                      {post.published ? '已发布' : '草稿'}
                    </span>

                    <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-muted">
                      <input
                        type="checkbox"
                        checked={post.published}
                        onChange={(e) => updatePost(post.id, { published: e.target.checked })}
                        className="accent-cyan"
                      />
                      发布
                    </label>

                    <label className="flex items-center gap-2 font-mono text-xs text-muted">
                      作者
                      <select
                        value={post.author ?? 'hermes'}
                        onChange={(e) =>
                          updatePost(post.id, {
                            author: e.target.value as 'hermes' | 'ots',
                          })
                        }
                        className="border border-line bg-transparent px-2 py-1 font-mono text-xs text-slate-200"
                      >
                        <option value="hermes">Hermes 协作</option>
                        <option value="ots">我的文章</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => removePost(post.id)}
                      className="border border-magenta/50 px-2.5 py-1 font-mono text-[10px] text-magenta transition-colors hover:bg-magenta/10"
                    >
                      删除
                    </button>
                  </div>

                  {/* 展开的编辑区 */}
                  {open && (
                    <div className="mt-5 space-y-4 border-t border-line pt-5">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <TextField
                          id={`post-title-${post.id}`}
                          label="标题"
                          value={post.title}
                          onChange={(v) => updatePost(post.id, { title: v })}
                        />
                        <TextField
                          id={`post-date-${post.id}`}
                          label="日期（YYYY-MM-DD）"
                          value={post.date}
                          onChange={(v) => updatePost(post.id, { date: v })}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`post-slug-${post.id}`}
                          className="mb-1.5 block font-mono text-xs tracking-wider text-muted"
                        >
                          短链（文章地址 #/blog/…）
                        </label>
                        <div className="flex gap-2">
                          <input
                            id={`post-slug-${post.id}`}
                            value={post.slug}
                            onChange={(e) => updatePost(post.id, { slug: e.target.value })}
                            className="flex-1 border border-line bg-void/60 px-3 py-2 font-mono text-sm text-slate-100 transition-all focus:border-cyan focus:shadow-neon focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => regenSlug(post.id)}
                            className="whitespace-nowrap border border-line px-3 py-2 font-mono text-xs text-muted transition-colors hover:border-cyan hover:text-cyan"
                          >
                            由标题生成
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label
                            htmlFor={`post-excerpt-${post.id}`}
                            className="font-mono text-xs tracking-wider text-muted"
                          >
                            摘要（留空则自动截取正文）
                          </label>
                          <button
                            type="button"
                            onClick={() => fillExcerpt(post.id)}
                            className="font-mono text-[10px] text-cyan hover:text-magenta"
                          >
                            从正文生成
                          </button>
                        </div>
                        <textarea
                          id={`post-excerpt-${post.id}`}
                          rows={2}
                          value={post.excerpt}
                          onChange={(e) => updatePost(post.id, { excerpt: e.target.value })}
                          className="w-full resize-y border border-line bg-void/60 px-3 py-2 text-sm text-slate-100 transition-all focus:border-cyan focus:shadow-neon focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`post-body-${post.id}`}
                          className="mb-1.5 block font-mono text-xs tracking-wider text-muted"
                        >
                          正文（Markdown，支持插入图片 / 加粗 / 标题 / 代码 / 列表 / 引用）
                        </label>
                        <MarkdownEditor
                          id={`post-body-${post.id}`}
                          value={post.body}
                          onChange={(v) => updatePost(post.id, { body: v })}
                        />
                      </div>

                      <StringListEditor
                        id={`post-tags-${post.id}`}
                        label="标签"
                        items={post.tags}
                        onChange={(v) => updatePost(post.id, { tags: v })}
                        placeholder="输入标签后回车"
                      />

                      {/* 封面图 */}
                      <div>
                        <span className="mb-1.5 block font-mono text-xs tracking-wider text-muted">
                          封面图（可选，需小于 400KB）
                        </span>
                        {post.cover && (
                          <div className="mb-2 flex items-center gap-3">
                            <img
                              src={post.cover}
                              alt="封面预览"
                              className="h-16 w-24 border border-line object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => updatePost(post.id, { cover: undefined })}
                              className="border border-magenta/50 px-2.5 py-1 font-mono text-[10px] text-magenta transition-colors hover:bg-magenta/10"
                            >
                              移除封面
                            </button>
                          </div>
                        )}
                        <input
                          id={`post-cover-${post.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePostCover(post.id, e.target.files?.[0] ?? null)}
                          className="block w-full font-mono text-xs text-muted file:mr-3 file:border file:border-line file:bg-void/60 file:px-3 file:py-1.5 file:font-mono file:text-xs file:text-cyan hover:file:border-cyan"
                        />
                        {coverErrors['post-' + post.id] && (
                          <p role="alert" className="mt-1.5 font-mono text-xs text-magenta">
                            ⚠ {coverErrors['post-' + post.id]}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-cyan hover:text-magenta"
                        >
                          ↗ 新标签预览（需先保存）
                        </a>
                      </div>

                      {/* Telegram 一键推送（写文章界面） */}
                      <div className="rounded border border-cyan/30 bg-cyan/5 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-xs tracking-wider text-cyan">
                            📨 推送到 Telegram（群 + 频道）
                          </span>
                          {tgStatus && (
                            <span
                              className={
                                tgStatus.kind === 'ok'
                                  ? 'text-xs text-cyan'
                                  : tgStatus.kind === 'err'
                                    ? 'text-xs text-magenta'
                                    : 'text-xs text-muted'
                              }
                            >
                              {tgStatus.text}
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          value={tgText}
                          onChange={(e) => setTgText(e.target.value)}
                          placeholder="可选：自定义推送文字（留空则自动用「标题 + 摘要 + 链接」格式发送本文）"
                          className="mb-3 w-full resize-y border border-line bg-void/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan focus:outline-none focus:shadow-neon transition-all"
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              sendToTelegram(
                                `📝 新文章：<b>${post.title || '无标题'}</b>\n${(post.excerpt || '').slice(0, 120)}\nhttps://www.otscup.com/blog/${post.slug}`,
                              )
                            }
                            disabled={tgStatus?.kind === 'sending'}
                            className="px-4 py-2 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all disabled:opacity-50"
                          >
                            发送此文
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              sendToTelegram(
                                `📝 新文章：<b>${post.title || '无标题'}</b>\n${(post.excerpt || '').slice(0, 120)}\nhttps://www.otscup.com/blog/${post.slug}`,
                                true,
                              )
                            }
                            disabled={tgStatus?.kind === 'sending'}
                            className="px-4 py-2 text-xs text-slate-300 border border-line hover:border-cyan hover:text-cyan transition-all disabled:opacity-50"
                          >
                            发送此文（带封面）
                          </button>
                          <button
                            type="button"
                            onClick={() => sendToTelegram()}
                            disabled={tgStatus?.kind === 'sending'}
                            className="px-4 py-2 text-xs text-slate-300 border border-line hover:border-cyan hover:text-cyan transition-all disabled:opacity-50"
                          >
                            发送自定义文字
                          </button>
                          <button
                            type="button"
                            onClick={() => sendToTelegram(undefined, true)}
                            disabled={tgStatus?.kind === 'sending'}
                            className="px-4 py-2 text-xs text-slate-300 border border-line hover:border-cyan hover:text-cyan transition-all disabled:opacity-50"
                          >
                            发送自定义（带封面）
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            <section className="cyber-card p-5">
              <h2 className="section-label">站点信息</h2>
              <div className="space-y-4">
                <TextField
                  id="site-title"
                  label="浏览器标签标题"
                  value={state.settings.siteTitle}
                  onChange={(v) => updateSettings({ siteTitle: v })}
                />
                <TextAreaField
                  id="site-desc"
                  label="站点描述（用于搜索引擎与分享卡片）"
                  value={state.settings.siteDescription}
                  onChange={(v) => updateSettings({ siteDescription: v })}
                  rows={3}
                />
              </div>
            </section>

            <section className="cyber-card p-5">
              <h2 className="section-label">评论与真人验证</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="comments-enabled" className="block text-xs font-mono tracking-wider text-slate-300">
                      开启评论（自建 D1 评论系统）
                    </label>
                    <p className="mt-1 font-body text-xs text-muted">
                      关闭后所有文章底部评论区隐藏，已发表评论保留。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSettings({ commentsEnabled: !state.settings.commentsEnabled })}
                    className={`relative h-6 w-12 shrink-0 rounded-full border transition-colors ${
                      state.settings.commentsEnabled ? 'border-cyan bg-cyan/30' : 'border-line bg-void/60'
                    }`}
                    aria-pressed={state.settings.commentsEnabled}
                    aria-label="开启评论"
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
                        state.settings.commentsEnabled ? 'left-7 bg-cyan' : 'left-0.5 bg-muted'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <NumberField
                    id="max-comments"
                    label="单篇文章最大评论数（0=不限制）"
                    value={state.settings.maxCommentsPerPost ?? 0}
                    onChange={(v) => updateSettings({ maxCommentsPerPost: v })}
                  />
                  <NumberField
                    id="max-images"
                    label="单条评论最大图片数（0=不限制）"
                    value={state.settings.maxImagesPerComment ?? 0}
                    onChange={(v) => updateSettings({ maxImagesPerComment: v })}
                  />
                  <NumberField
                    id="max-img-size"
                    label="单张图片建议大小上限（KB，前端软提示）"
                    value={state.settings.maxImageSizeKB ?? 0}
                    onChange={(v) => updateSettings({ maxImageSizeKB: v })}
                  />
                </div>

                <p className="font-body text-xs text-muted">
                  限制均在服务端强制（图片数/评论数/开关）；图片大小因评论仅存图片链接、服务端无法校验远程体积，
                  仅作为前端软提示。数据存于 D1，避免滥用请配合图形验证码（已启用）。
                </p>

                <div className="mt-5 space-y-4 border-t border-line pt-5">
                  <p className="section-label">Giscus 配置（可选，填了即用 Giscus，否则用上面的自建评论）</p>
                  <p className="font-body text-xs text-muted">
                    仓库须为公开、已安装 Giscus App 并开启 Discussions。仓库 ID 与分类 ID 在
                    <a href="https://giscus.app" target="_blank" rel="noreferrer" className="text-cyan hover:underline"> giscus.app</a>
                    配置页底部获取。三项（仓库 / 仓库ID / 分类ID）都填才生效，否则自动回退到自建评论。
                  </p>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <TextField
                      id="giscus-repo"
                      label="仓库 owner/repo"
                      value={state.settings.commentsRepo ?? ''}
                      onChange={(v) => updateSettings({ commentsRepo: v || undefined })}
                      placeholder="otscup/comments"
                    />
                    <TextField
                      id="giscus-repoid"
                      label="仓库 ID（repo-id）"
                      value={state.settings.giscusRepoId ?? ''}
                      onChange={(v) => updateSettings({ giscusRepoId: v || undefined })}
                      placeholder="例如 R_kgDOxxxxxx"
                    />
                    <TextField
                      id="giscus-category"
                      label="分类名"
                      value={state.settings.giscusCategory ?? ''}
                      onChange={(v) => updateSettings({ giscusCategory: v || undefined })}
                      placeholder="Announcements"
                    />
                    <TextField
                      id="giscus-catid"
                      label="分类 ID（category-id）"
                      value={state.settings.giscusCategoryId ?? ''}
                      onChange={(v) => updateSettings({ giscusCategoryId: v || undefined })}
                      placeholder="例如 DIC_xxxxxxx"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="cyber-card p-5">
              <h2 className="section-label">新评论通知</h2>
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="comment-notify" className="block text-xs font-mono tracking-wider text-slate-300">
                    新评论 Telegram 通知
                  </label>
                  <p className="mt-1 font-body text-xs text-muted">
                    开启后，每有新评论即推送到下方 Telegram 群组配置（Bot Token + Chat ID）。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSettings({ commentNotifyEnabled: !state.settings.commentNotifyEnabled })}
                  className={`relative h-6 w-12 shrink-0 rounded-full border transition-colors ${
                    state.settings.commentNotifyEnabled ? 'border-cyan bg-cyan/30' : 'border-line bg-void/60'
                  }`}
                  aria-pressed={state.settings.commentNotifyEnabled}
                  aria-label="新评论通知"
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
                      state.settings.commentNotifyEnabled ? 'left-7 bg-cyan' : 'left-0.5 bg-muted'
                    }`}
                  />
                </button>
              </div>

              <div className="mt-5 space-y-4 border-t border-line pt-5">
                <p className="section-label">Telegram 群组配置（通知 + 发文推送共用）</p>
                <p className="font-body text-xs text-muted">
                  Bot Token 在 Telegram @BotFather 创建机器人获取；Chat ID 通过 @getidsbot 或群 @group 获取。
                  多个 Chat ID 请用逗号分隔，会逐个推送。
                </p>
                <TextField
                  id="tg-bot-token"
                  label="Bot Token"
                  value={state.settings.tgBotToken ?? ''}
                  onChange={(v) => updateSettings({ tgBotToken: v || undefined })}
                  placeholder="123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <TextField
                  id="tg-chat-ids"
                  label="Chat ID 列表（逗号分隔）"
                  value={(state.settings.tgChatIds ?? []).join(', ')}
                  onChange={(v) =>
                    updateSettings({
                      tgChatIds: v
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="-100xxxxxxxxxxxxx, -100yyyyyyyyyyyyy"
                />
              </div>
            </section>

            <section className="cyber-card p-5">
              <h2 className="section-label">AI 助手</h2>
              <p className="mb-4 font-body text-sm text-muted">
                前台右下角 AI 助手（🤖）依赖 OpenAI 兼容 API。填入 API Key 后访客即可提问部署/复现问题；
                留空则助手返回「AI 后端未配置」。
              </p>
              <div className="space-y-4">
                <TextField
                  id="aihub-key"
                  label="API Key"
                  value={state.settings.aihubKey ?? ''}
                  onChange={(v) => updateSettings({ aihubKey: v || undefined })}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxx"
                />
                <TextField
                  id="ai-base-url"
                  label="API 基础地址"
                  value={state.settings.aiBaseUrl ?? ''}
                  onChange={(v) => updateSettings({ aiBaseUrl: v || undefined })}
                  placeholder="https://aihub.071129.xyz/v1"
                />
                <div className="border-t border-line pt-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-mono tracking-wider text-slate-300">
                      模型列表（按顺序 failover）
                    </label>
                    <button
                      type="button"
                      onClick={() => void fetchAiModels()}
                      disabled={aiModelsLoading}
                      className="border border-cyan/50 px-3 py-1.5 font-mono text-xs text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
                    >
                      {aiModelsLoading ? '拉取中…' : '📡 拉取可用模型'}
                    </button>
                  </div>
                  <p className="mt-1 font-body text-xs text-muted">
                    任一模型可用即应答，全部失败才报「AI 暂时不可用」。
                  </p>

                  {/* 手动输入（逗号分隔） */}
                  <TextAreaField
                    id="ai-models"
                    label="手动输入（逗号分隔，保留顺序作为 failover 优先级）"
                    value={state.settings.aiModels ?? ''}
                    onChange={(v) => updateSettings({ aiModels: v || undefined })}
                    rows={2}
                    placeholder="tencent/hy3:free,inclusionai/ling-3.0-flash:free"
                  />

                  {aiModelsError && (
                    <p className="font-mono text-xs text-magenta">⚠ {aiModelsError}</p>
                  )}

                  {aiAvailableModels.length > 0 && (
                    <div className="mt-2">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-mono text-xs text-muted">
                          可用模型（点击勾选，已选加入列表）：
                        </span>
                        <button
                          type="button"
                          onClick={addAllAiModels}
                          className="border border-cyan/40 px-2 py-0.5 font-mono text-[10px] text-cyan hover:bg-cyan/10"
                        >
                          全选
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {aiAvailableModels.map((m) => {
                          const checked = selectedAiModels.includes(m);
                          return (
                            <label
                              key={m}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                                checked
                                  ? 'border-cyan/60 bg-cyan/10'
                                  : 'border-line bg-void/40 hover:border-cyan/40'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleAiModel(m)}
                                className="h-3.5 w-3.5 accent-cyan"
                              />
                              <span className="font-mono text-[11px] leading-tight text-slate-300 break-all">
                                {m}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="cyber-card p-5">
              <h2 className="section-label">后台访问口令</h2>
              <p className="mb-4 font-body text-sm text-muted">
                {state.settings.adminPassHash
                  ? '已设置口令。进入后台需要验证。'
                  : '尚未设置口令，任何人都能打开后台修改内容，建议立即设置。'}
              </p>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label
                    htmlFor="new-pass"
                    className="mb-1.5 block font-mono text-xs tracking-wider text-muted"
                  >
                    新口令（至少 6 位）
                  </label>
                  <input
                    id="new-pass"
                    type="password"
                    autoComplete="new-password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full border border-line bg-void/60 px-3 py-2 text-slate-100 transition-all focus:border-cyan focus:shadow-neon focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-pass2"
                    className="mb-1.5 block font-mono text-xs tracking-wider text-muted"
                  >
                    再次输入
                  </label>
                  <input
                    id="new-pass2"
                    type="password"
                    autoComplete="new-password"
                    value={newPass2}
                    onChange={(e) => setNewPass2(e.target.value)}
                    className="w-full border border-line bg-void/60 px-3 py-2 text-slate-100 transition-all focus:border-cyan focus:shadow-neon focus:outline-none"
                  />
                </div>
              </div>

              {passMsg && (
                <p
                  role="alert"
                  className={
                    passMsg.kind === 'ok'
                      ? 'mt-3 font-mono text-xs text-lime'
                      : 'mt-3 font-mono text-xs text-magenta'
                  }
                >
                  {passMsg.kind === 'ok' ? '✓ ' : '⚠ '}
                  {passMsg.text}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleChangePass()}
                  className="btn-neon"
                >
                  {state.settings.adminPassHash ? '更新口令' : '设置口令'}
                </button>
                {state.settings.adminPassHash && (
                  <button
                    type="button"
                    onClick={handleClearPass}
                    className="border border-magenta/50 px-4 py-2 font-mono text-xs text-magenta transition-colors hover:bg-magenta/10"
                  >
                    清除口令
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    window.location.assign('/');
                  }}
                  className="border border-line px-4 py-2 font-mono text-xs text-muted transition-colors hover:border-cyan hover:text-cyan"
                >
                  退出登录
                </button>
              </div>

              <p className="mt-4 border-t border-line pt-4 font-mono text-[10px] leading-relaxed text-line">
                说明：本地阶段口令校验在浏览器完成，可防止随手改动，但技术上可绕过。
                部署到 Cloudflare 后将改由服务端校验，那时前端绕过也无法写入数据。
              </p>
            </section>

            {/* MCP API Key 管理 */}
            <section className="cyber-card p-5">
              <h2 className="section-label">MCP API Key 管理</h2>
              <p className="mb-4 font-body text-sm text-muted">
                为每个客户端生成独立 API Key，用于连接 MCP 服务端（<code className="font-mono text-cyan">https://www.otscup.com/api/mcp</code>）。
                每个 key 可独立吊销，互不影响。
              </p>

              {/* 创建新 Key */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <label
                    htmlFor="mcp-key-name"
                    className="mb-1.5 block font-mono text-xs tracking-wider text-muted"
                  >
                    客户端名称（如：Cursor、Claude Desktop）
                  </label>
                  <input
                    id="mcp-key-name"
                    type="text"
                    placeholder="例如：我的 Cursor"
                    value={mcpKeyName}
                    onChange={(e) => setMcpKeyName(e.target.value)}
                    className="w-full border border-line bg-void/60 px-3 py-2 text-slate-100 transition-all focus:border-cyan focus:shadow-neon focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!mcpKeyName.trim()) {
                        setMcpMsg({ kind: 'err', text: '请先填写客户端名称' });
                        return;
                      }
                      const key = 'mcp_' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
                      const newKeyEntry = {
                        id: `k_${Date.now()}`,
                        name: mcpKeyName.trim(),
                        key,
                        createdAt: Date.now(),
                      };
                      const updated = [...mcpKeys, newKeyEntry];
                      const nextState = { ...state, settings: { ...state.settings, mcpKeys: updated } };
                      setState(nextState);
                      saveSite(nextState);
                      pushToCloud(nextState, state.settings.adminPassHash || '').then((ok) => {
                        setMcpMsg({
                          kind: 'ok',
                          text: ok ? 'Key 已创建并同步到云端' : 'Key 已创建（本地已保存，云端同步失败）',
                        });
                      });
                      setMcpNewKey(key);
                      setMcpKeyName('');
                    }}
                    className="btn-neon w-full"
                  >
                    生成新 Key
                  </button>
                </div>
              </div>

              {/* 新生成的 Key 展示 */}
              {mcpNewKey && (
                <div className="mt-4 border border-lime/50 bg-lime/10 p-4">
                  <p className="mb-2 font-mono text-xs text-lime">✓ 新 Key 已生成，请立即复制保存（关闭后将无法再查看完整 key）：</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all border border-line bg-void/80 p-2 font-mono text-xs text-slate-100">
                      {mcpNewKey}
                    </code>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(mcpNewKey!); setMcpMsg({ kind: 'ok', text: '已复制到剪贴板' }); }}
                      className="border border-lime/50 px-3 py-1 font-mono text-xs text-lime transition-colors hover:bg-lime/20"
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      onClick={() => setMcpNewKey(null)}
                      className="border border-line px-3 py-1 font-mono text-xs text-muted transition-colors hover:border-cyan"
                    >
                      关闭
                    </button>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-muted">
                    配置到客户端：headers 设置 <code className="text-cyan">x-mcp-key: {mcpNewKey.slice(0, 12)}...</code>
                  </p>
                </div>
              )}

              {/* 现有 Key 列表 */}
              {mcpKeys.length > 0 && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 font-mono text-xs text-muted">已创建的 Key（{mcpKeys.length} 个）：</p>
                  <div className="space-y-2">
                    {mcpKeys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between border border-line bg-void/40 px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-slate-100">{k.name}</span>
                          <code className="font-mono text-[10px] text-muted">{k.key.slice(0, 12)}...</code>
                          <span className="font-mono text-[10px] text-line">
                            {new Date(k.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`确认删除「${k.name}」的 Key？该客户端将无法再写入。`)) return;
                            const updated = mcpKeys.filter((x) => x.id !== k.id);
                            const nextState = { ...state, settings: { ...state.settings, mcpKeys: updated } };
                            setState(nextState);
                            saveSite(nextState);
                            pushToCloud(nextState, state.settings.adminPassHash || '').then(() => {
                              setMcpMsg({ kind: 'ok', text: `已删除「${k.name}」的 Key` });
                            });
                          }}
                          className="border border-magenta/50 px-2 py-1 font-mono text-[10px] text-magenta transition-colors hover:bg-magenta/10"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mcpMsg && (
                <p
                  role="alert"
                  className={
                    mcpMsg.kind === 'ok'
                      ? 'mt-3 font-mono text-xs text-lime'
                      : 'mt-3 font-mono text-xs text-magenta'
                  }
                >
                  {mcpMsg.kind === 'ok' ? '✓ ' : '⚠ '}
                  {mcpMsg.text}
                </p>
              )}
            </section>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8">
            <section className="cyber-card p-5">
              <h2 className="section-label">个人资料</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TextField
                  id="profile-name"
                  label="姓名"
                  value={state.profile.name}
                  onChange={(v) => updateProfile({ name: v })}
                />
                <TextField
                  id="profile-title"
                  label="头衔"
                  value={state.profile.title}
                  onChange={(v) => updateProfile({ title: v })}
                />
                <TextField
                  id="profile-tagline"
                  label="标语"
                  value={state.profile.tagline}
                  onChange={(v) => updateProfile({ tagline: v })}
                />
                <div className="lg:col-span-2">
                  <TextAreaField
                    id="profile-intro"
                    label="简介"
                    rows={4}
                    value={state.profile.intro}
                    onChange={(v) => updateProfile({ intro: v })}
                  />
                </div>
              </div>
            </section>

            <section className="cyber-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-label mb-0">联系方式</h2>
                <button
                  type="button"
                  onClick={addContact}
                  className="px-3 py-1 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all"
                >
                  + 新增行
                </button>
              </div>
              <div className="space-y-3">
                {state.profile.contacts.map((c, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"
                  >
                    <TextField
                      id={`contact-label-${i}`}
                      label="标签"
                      value={c.label}
                      onChange={(v) => updateContact(i, { label: v })}
                    />
                    <TextField
                      id={`contact-value-${i}`}
                      label="值"
                      value={c.value}
                      onChange={(v) => updateContact(i, { value: v })}
                    />
                    <TextField
                      id={`contact-href-${i}`}
                      label="链接"
                      value={c.href}
                      onChange={(v) => updateContact(i, { href: v })}
                    />
                    <button
                      type="button"
                      onClick={() => removeContact(i)}
                      className="px-3 py-2 text-xs text-magenta border border-magenta/40 hover:bg-magenta hover:text-void transition-all h-[38px]"
                    >
                      删除
                    </button>
                  </div>
                ))}
                {state.profile.contacts.length === 0 && (
                  <p className="text-muted text-sm">暂无联系方式</p>
                )}
              </div>
            </section>

            <section className="cyber-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-label mb-0">社交账号</h2>
                <button
                  type="button"
                  onClick={addSocial}
                  className="px-3 py-1 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all"
                >
                  + 新增
                </button>
              </div>
              <p className="text-muted text-xs mb-3">
                提示：href 为空时该社交账号不会在前台显示
              </p>
              <div className="space-y-3">
                {state.socials.map((s, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                    <TextField
                      id={`social-name-${i}`}
                      label="名称"
                      value={s.name}
                      onChange={(v) => updateSocial(i, { name: v })}
                    />
                    <TextField
                      id={`social-handle-${i}`}
                      label="用户名"
                      value={s.handle}
                      onChange={(v) => updateSocial(i, { handle: v })}
                    />
                    <TextField
                      id={`social-href-${i}`}
                      label="链接（留空则隐藏）"
                      value={s.href}
                      onChange={(v) => updateSocial(i, { href: v })}
                    />
                    <TextField
                      id={`social-icon-${i}`}
                      label="图标 SVG path"
                      value={s.icon}
                      onChange={(v) => updateSocial(i, { icon: v })}
                    />
                    <button
                      type="button"
                      onClick={() => removeSocial(i)}
                      className="px-3 py-2 text-xs text-magenta border border-magenta/40 hover:bg-magenta hover:text-void transition-all h-[38px] sm:col-span-2"
                    >
                      删除
                    </button>
                  </div>
                ))}
                {state.socials.length === 0 && (
                  <p className="text-muted text-sm">暂无社交账号</p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ===== 项目 ===== */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="section-label mb-0">项目管理</h2>
              <button
                type="button"
                onClick={addProject}
                className="px-3 py-1 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all"
              >
                + 新增项目
              </button>
            </div>
            {state.projects.map((p) => (
              <section key={p.id} className="cyber-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-cyan text-sm tracking-wider">
                    {p.name || '（未命名项目）'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeProject(p.id)}
                    className="px-3 py-1 text-xs text-magenta border border-magenta/40 hover:bg-magenta hover:text-void transition-all"
                  >
                    删除项目
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <TextField
                    id={`project-name-${p.id}`}
                    label="名称"
                    value={p.name}
                    onChange={(v) => updateProject(p.id, { name: v })}
                  />
                  <TextField
                    id={`project-subtitle-${p.id}`}
                    label="副标题"
                    value={p.subtitle}
                    onChange={(v) => updateProject(p.id, { subtitle: v })}
                  />
                  <SelectField
                    id={`project-status-${p.id}`}
                    label="状态"
                    value={p.status}
                    onChange={(v) => updateProject(p.id, { status: v as Project['status'] })}
                    options={[
                      { value: '已上线', label: '已上线' },
                      { value: '开发中', label: '开发中' },
                    ]}
                  />
                  <SelectField
                    id={`project-accent-${p.id}`}
                    label="强调色"
                    value={p.accent}
                    onChange={(v) => updateProject(p.id, { accent: v as Project['accent'] })}
                    options={[
                      { value: 'cyan', label: '青色' },
                      { value: 'magenta', label: '品红' },
                      { value: 'lime', label: '黄绿' },
                    ]}
                  />
                  <div className="flex items-center gap-2 lg:col-span-2">
                    <input
                      type="checkbox"
                      id={`project-featured-${p.id}`}
                      checked={!!p.featured}
                      onChange={(e) => updateProject(p.id, { featured: e.target.checked })}
                      className="h-4 w-4 accent-cyan"
                    />
                    <label htmlFor={`project-featured-${p.id}`} className="font-mono text-xs text-slate-200">
                      在前台「作品精选」区展示（勾选几个展示几个）
                    </label>
                  </div>
                  <div className="lg:col-span-2">
                    <TextField
                      id={`project-link-${p.id}`}
                      label="链接（可选）"
                      value={p.link ?? ''}
                      onChange={(v) => updateProject(p.id, { link: v })}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <TextField
                      id={`project-slug-${p.id}`}
                      label="详情页路由 slug（可选，留空用 id）"
                      value={p.slug ?? ''}
                      onChange={(v) => updateProject(p.id, { slug: v })}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <TextAreaField
                      id={`project-desc-${p.id}`}
                      label="描述"
                      rows={4}
                      value={p.desc}
                      onChange={(v) => updateProject(p.id, { desc: v })}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <StringListEditor
                      id={`project-tags-${p.id}`}
                      label="标签"
                      items={p.tags}
                      onChange={(v) => updateProject(p.id, { tags: v })}
                      placeholder="输入标签后回车"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <StringListEditor
                      id={`project-highlights-${p.id}`}
                      label="亮点"
                      items={p.highlights}
                      onChange={(v) => updateProject(p.id, { highlights: v })}
                      placeholder="输入亮点后回车"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label
                      htmlFor={`project-cover-${p.id}`}
                      className="block text-xs font-mono tracking-wider text-slate-300 mb-1"
                    >
                      封面图片
                    </label>
                    <div className="flex items-center gap-3 flex-wrap">
                      {p.cover && (
                        <div className="relative shrink-0">
                          <img
                            src={p.cover}
                            alt="封面预览"
                            className="w-16 h-16 object-cover border border-cyan/40"
                          />
                          <button
                            type="button"
                            onClick={() => removeCover(p.id)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-magenta text-void flex items-center justify-center text-xs leading-none"
                            aria-label="移除封面"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      <input
                        id={`project-cover-${p.id}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          handleCoverUpload(p.id, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                        className="text-xs text-slate-300 file:mr-3 file:px-3 file:py-1 file:border file:border-cyan/40 file:bg-cyan/5 file:text-cyan file:text-xs file:cursor-pointer"
                      />
                    </div>
                    {coverErrors[p.id] && (
                      <p className="text-magenta text-xs mt-1">{coverErrors[p.id]}</p>
                    )}
                    <p className="text-muted text-xs mt-1">
                      图片需小于 400KB（localStorage 限制约 5MB）
                    </p>
                  </div>

                  {/* 成品截图 / 多图 gallery */}
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-mono tracking-wider text-slate-300 mb-1">
                      成品截图 / 效果展示（多图，R2 存储）
                    </label>
                    <div className="flex items-center gap-3 flex-wrap">
                      {(p.gallery ?? []).map((src, i) => (
                        <div key={i} className="relative shrink-0">
                          <img
                            src={src}
                            alt={`截图 ${i + 1}`}
                            className="w-16 h-16 object-cover border border-cyan/40"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateProject(p.id, {
                                gallery: (p.gallery ?? []).filter((_, j) => j !== i),
                              })
                            }
                            className="absolute -top-2 -right-2 w-5 h-5 bg-magenta text-void flex items-center justify-center text-xs leading-none"
                            aria-label="移除截图"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <input
                        id={`project-gallery-${p.id}`}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files ?? []);
                          for (const f of files) {
                            try {
                              const fd = new FormData();
                              fd.append('file', f);
                              const r = await fetch('/api/upload', {
                                method: 'POST',
                                headers: { 'x-admin-hash': (loadSite().settings?.adminPassHash || '') },
                                body: fd,
                              });
                              const j = await r.json();
                              if (j.ok) {
                                updateProject(p.id, {
                                  gallery: [...(p.gallery ?? []), j.url],
                                });
                              }
                            } catch {
                              /* 忽略单张失败 */
                            }
                          }
                          e.target.value = '';
                        }}
                        className="text-xs text-slate-300 file:mr-3 file:px-3 file:py-1 file:border file:border-cyan/40 file:bg-cyan/5 file:text-cyan file:text-xs file:cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* 部署信息 */}
                  <div className="lg:col-span-2">
                    <p className="text-xs font-mono tracking-wider text-slate-300 mb-2">部署信息（可选）</p>
                    <div className="space-y-3">
                      <TextField
                        id={`project-cf-${p.id}`}
                        label="Cloudflare 一键部署链接（可选）"
                        value={p.deploy?.cloudflareUrl ?? ''}
                        onChange={(v) =>
                          updateProject(p.id, {
                            deploy: { ...(p.deploy ?? {}), cloudflareUrl: v },
                          })
                        }
                      />
                      <TextAreaField
                        id={`project-agent-${p.id}`}
                        label="AI 部署指令（自然语言，访客复制后交给本地 AI）"
                        rows={4}
                        value={p.deploy?.agentPrompt ?? ''}
                        onChange={(v) =>
                          updateProject(p.id, {
                            deploy: { ...(p.deploy ?? {}), agentPrompt: v },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </section>
            ))}
            {state.projects.length === 0 && (
              <p className="text-muted text-sm text-center py-8">暂无项目，点击右上角新增</p>
            )}
          </div>
        )}

        {/* ===== 历程 ===== */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="section-label mb-0">时间线管理</h2>
              <button
                type="button"
                onClick={addTimeline}
                className="px-3 py-1 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all"
              >
                + 新增节点
              </button>
            </div>
            {state.timeline.map((t) => (
              <section key={t.id} className="cyber-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-cyan text-sm tracking-wider">
                    {t.title || '（未命名节点）'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeTimeline(t.id)}
                    className="px-3 py-1 text-xs text-magenta border border-magenta/40 hover:bg-magenta hover:text-void transition-all"
                  >
                    删除节点
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <TextField
                    id={`timeline-period-${t.id}`}
                    label="时间段"
                    value={t.period}
                    onChange={(v) => updateTimeline(t.id, { period: v })}
                  />
                  <TextField
                    id={`timeline-title-${t.id}`}
                    label="标题"
                    value={t.title}
                    onChange={(v) => updateTimeline(t.id, { title: v })}
                  />
                  <div className="lg:col-span-2">
                    <TextAreaField
                      id={`timeline-desc-${t.id}`}
                      label="描述"
                      rows={3}
                      value={t.desc}
                      onChange={(v) => updateTimeline(t.id, { desc: v })}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <StringListEditor
                      id={`timeline-tags-${t.id}`}
                      label="标签"
                      items={t.tags}
                      onChange={(v) => updateTimeline(t.id, { tags: v })}
                      placeholder="输入标签后回车"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="inline-flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!t.current}
                        onChange={(e) => handleCurrentChange(t.id, e.target.checked)}
                        className="w-4 h-4 accent-cyan"
                      />
                      当前进行中（仅可有一项勾选）
                    </label>
                  </div>
                </div>
              </section>
            ))}
            {state.timeline.length === 0 && (
              <p className="text-muted text-sm text-center py-8">暂无节点，点击右上角新增</p>
            )}
          </div>
        )}

        {/* ===== 技能 ===== */}
        {activeTab === 'skills' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="section-label mb-0">技能管理</h2>
              <button
                type="button"
                onClick={addSkill}
                className="px-3 py-1 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all"
              >
                + 新增分组
              </button>
            </div>
            {state.skills.map((s) => (
              <section key={s.id} className="cyber-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-cyan text-sm tracking-wider">
                    {s.group || '（未命名分组）'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeSkill(s.id)}
                    className="px-3 py-1 text-xs text-magenta border border-magenta/40 hover:bg-magenta hover:text-void transition-all"
                  >
                    删除分组
                  </button>
                </div>
                <div className="space-y-4">
                  <TextField
                    id={`skill-group-${s.id}`}
                    label="分组名称"
                    value={s.group}
                    onChange={(v) => updateSkill(s.id, { group: v })}
                  />
                  <StringListEditor
                    id={`skill-items-${s.id}`}
                    label="技能项"
                    items={s.items}
                    onChange={(v) => updateSkill(s.id, { items: v })}
                    placeholder="输入技能后回车"
                  />
                </div>
              </section>
            ))}
            {state.skills.length === 0 && (
              <p className="text-muted text-sm text-center py-8">暂无分组，点击右上角新增</p>
            )}
          </div>
        )}

        {/* ===== 数据 ===== */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            {/* 访问统计面板 */}
            <StatsPanel />

            <section className="cyber-card p-5">
              <label htmlFor="export-text" className="section-label block">
                导出数据
              </label>
              <p className="text-muted text-xs mb-2">复制以下 JSON 内容以备份当前数据</p>
              <textarea
                id="export-text"
                readOnly
                rows={10}
                value={exportSite(state)}
                className="w-full bg-void/60 border border-line px-3 py-2 text-slate-100 text-xs font-mono focus:border-cyan focus:outline-none focus:shadow-neon transition-all resize-y"
              />
            </section>

            <section className="cyber-card p-5">
              <label htmlFor="import-text" className="section-label block">
                导入数据
              </label>
              <p className="text-muted text-xs mb-2">粘贴 JSON 内容后点击导入</p>
              <textarea
                id="import-text"
                rows={6}
                value={importText}
                placeholder='{"version":1,"profile":{...}, ...}'
                onChange={(e) => setImportText(e.target.value)}
                className="w-full bg-void/60 border border-line px-3 py-2 text-slate-100 text-xs font-mono focus:border-cyan focus:outline-none focus:shadow-neon transition-all resize-y mb-3"
              />
              {importError && (
                <p className="text-magenta text-xs mb-3">{importError}</p>
              )}
              <button
                type="button"
                onClick={handleImport}
                className="px-4 py-2 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all"
              >
                导入
              </button>
            </section>

            <section className="cyber-card p-5">
              <h2 className="section-label">恢复默认</h2>
              <p className="text-muted text-xs mb-3">
                清除所有自定义内容，恢复到默认数据。此操作不可撤销。
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs text-magenta border border-magenta/40 hover:bg-magenta hover:text-void transition-all"
              >
                恢复默认内容
              </button>
            </section>

            <section className="cyber-card p-5">
              <h2 className="section-label">Telegram 推送</h2>
              <p className="text-muted text-xs mb-2">
                手动推送消息到 Telegram 群与频道（自动随每日博客一起发送）。支持 <b>加粗</b> 与换行。
              </p>
              <textarea
                rows={4}
                value={tgText}
                onChange={(e) => setTgText(e.target.value)}
                placeholder="输入要推送的文字，例如：📢 新教程已发布：..."
                className="w-full bg-void/60 border border-line px-3 py-2 text-slate-100 text-sm font-mono focus:border-cyan focus:outline-none focus:shadow-neon transition-all resize-y mb-3"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => sendToTelegram()}
                  disabled={tgStatus?.kind === 'sending'}
                  className="px-4 py-2 text-xs text-cyan border border-cyan/40 hover:bg-cyan hover:text-void transition-all disabled:opacity-50"
                >
                  {tgStatus?.kind === 'sending' ? '发送中…' : '推送到群和频道'}
                </button>
                <button
                  type="button"
                  onClick={() => sendToTelegram(undefined, true)}
                  disabled={tgStatus?.kind === 'sending'}
                  className="px-4 py-2 text-xs text-slate-300 border border-line hover:border-cyan hover:text-cyan transition-all disabled:opacity-50"
                >
                  带封面推送
                </button>
                {tgStatus && (
                  <span
                    className={
                      tgStatus.kind === 'ok'
                        ? 'text-xs text-cyan'
                        : tgStatus.kind === 'err'
                          ? 'text-xs text-magenta'
                          : 'text-xs text-muted'
                    }
                  >
                    {tgStatus.text}
                  </span>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
