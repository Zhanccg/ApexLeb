import { useState } from 'react';
import type { Experiment, Hypothesis, VariableDef } from '@/data/schema';
import { DIRECTION_LABEL } from '@/data/schema';
import { useLabStore } from '@/data/store';
import { validateVariableRoles } from '@/pedagogy';
import { CORNERING_DEPENDENT_KEY, CORNERING_PARAM_KEYS, type CorneringParamKey } from '@/data/variables';
import { Button } from '@/components/ui';

const PARAM_META: Record<CorneringParamKey, { name: string; symbol: string; unit: string }> = {
  speedKmh: { name: '车速', symbol: 'v', unit: 'km/h' },
  radiusM: { name: '弯道半径', symbol: 'R', unit: 'm' },
  mu: { name: '路面附着系数', symbol: 'μ', unit: '—' },
};

type Roles = Record<CorneringParamKey, 'independent' | 'controlled'>;

function rolesOf(exp: Experiment): Roles {
  const roles: Roles = { speedKmh: 'controlled', radiusM: 'controlled', mu: 'controlled' };
  for (const v of exp.variables ?? []) {
    if ((CORNERING_PARAM_KEYS as readonly string[]).includes(v.id) && (v.role === 'independent' || v.role === 'controlled')) {
      roles[v.id as CorneringParamKey] = v.role;
    }
  }
  if (!Object.values(roles).includes('independent')) roles.speedKmh = 'independent';
  return roles;
}

export default function MethodEditor({
  exp,
  onClose,
}: {
  exp: Experiment;
  onClose: (saved: boolean, notice?: string) => void;
}) {
  const updateMethod = useLabStore((s) => s.updateMethod);
  const [statement, setStatement] = useState(exp.hypothesis?.statement ?? '');
  const [rationale, setRationale] = useState(exp.hypothesis?.rationale ?? '');
  const [direction, setDirection] = useState<Hypothesis['expectedDirection']>(
    exp.hypothesis?.expectedDirection ?? 'nonlinear',
  );
  const [roles, setRoles] = useState<Roles>(() => rolesOf(exp));
  const [error, setError] = useState<string | null>(null);

  const draftVariables: VariableDef[] = [
    ...CORNERING_PARAM_KEYS.map((k) => ({
      id: k,
      name: PARAM_META[k].name,
      symbol: PARAM_META[k].symbol,
      unit: PARAM_META[k].unit,
      role: roles[k],
      min: 0,
      max: 1,
      step: 1,
      defaultValue: 0,
      hint: '',
    })),
    {
      id: CORNERING_DEPENDENT_KEY,
      name: '侧向加速度',
      symbol: 'ay',
      unit: 'm/s²',
      role: 'dependent',
      min: 0,
      max: 1,
      step: 1,
      defaultValue: 0,
      hint: '',
    },
  ];
  const issues = validateVariableRoles({ ...exp, variables: draftVariables });
  const textOk = statement.trim().length >= 8 && rationale.trim().length > 0;
  const canSave = issues.length === 0 && textOk;

  const setRole = (key: CorneringParamKey, role: 'independent' | 'controlled') => {
    setRoles((prev) => {
      const next = { ...prev, [key]: role };
      // 切换自变量时，车速 / 半径中的另一项自动转为控制变量
      if (role === 'independent' && key !== 'mu') {
        const other: CorneringParamKey = key === 'speedKmh' ? 'radiusM' : 'speedKmh';
        next[other] = 'controlled';
      }
      return next;
    });
    setError(null);
  };

  const onSave = () => {
    const res = updateMethod(exp.id, { statement, rationale, expectedDirection: direction, roles });
    if (!res.ok) {
      setError(res.reason ?? '保存失败');
      return;
    }
    onClose(true, res.notice);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="panel-title">研究假设（可被证伪的预测）</span>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={3}
            placeholder="例如：侧向加速度 ay 随车速 v 增大而增大，且与 v² 成正比。"
            className="mt-1.5 w-full rounded border border-line bg-carbon-950 p-3 text-sm leading-relaxed text-mist-100 placeholder:text-mist-600 focus:border-tele-500/60 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="panel-title">假设依据（物理原理）</span>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            placeholder="例如：ay = v²/R，R 与 μ 固定时车速翻倍则 ay 变为 4 倍。"
            className="mt-1.5 w-full rounded border border-line bg-carbon-950 p-3 text-sm leading-relaxed text-mist-100 placeholder:text-mist-600 focus:border-tele-500/60 focus:outline-none"
          />
        </label>
      </div>

      <label className="block max-w-xs">
        <span className="panel-title">预期变化方向</span>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as Hypothesis['expectedDirection'])}
          className="mt-1.5 w-full cursor-pointer rounded border border-line bg-carbon-950 px-3 py-2 text-sm text-mist-300 focus:border-tele-500/60 focus:outline-none"
        >
          {(Object.keys(DIRECTION_LABEL) as Array<Hypothesis['expectedDirection']>).map((d) => (
            <option key={d} value={d}>{DIRECTION_LABEL[d]}</option>
          ))}
        </select>
      </label>

      <div>
        <p className="panel-title mb-2">变量角色（切换自变量时另一项自动转为控制变量）</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CORNERING_PARAM_KEYS.map((k) => (
            <div key={k} className={`rounded-lg border p-3 ${roles[k] === 'independent' ? 'border-race-500/50 bg-race-500/8' : 'border-line bg-carbon-900/70'}`}>
              <p className="flex items-baseline justify-between text-xs font-bold text-mist-100">
                {PARAM_META[k].name}
                <span className="num text-tele-300">{PARAM_META[k].symbol}</span>
              </p>
              <select
                value={roles[k]}
                onChange={(e) => setRole(k, e.target.value as 'independent' | 'controlled')}
                aria-label={`${PARAM_META[k].name}的角色`}
                className="mt-2 w-full cursor-pointer rounded border border-line bg-carbon-950 px-2 py-1.5 text-xs font-semibold text-mist-300 focus:border-tele-500/60 focus:outline-none"
              >
                <option value="independent">自变量（逐次改变）</option>
                <option value="controlled">控制变量（保持恒定）</option>
              </select>
              <p className="num mt-1 text-[10px] text-mist-600">{PARAM_META[k].unit}</p>
            </div>
          ))}
          <div className="rounded-lg border border-tele-500/40 bg-tele-500/8 p-3">
            <p className="flex items-baseline justify-between text-xs font-bold text-mist-100">
              侧向加速度<span className="num text-tele-300">ay</span>
            </p>
            <p className="mt-2 rounded border border-tele-500/40 bg-carbon-950 px-2 py-1.5 text-xs font-semibold text-tele-300">
              因变量（本版本固定）
            </p>
            <p className="num mt-1 text-[10px] text-mist-600">m/s² · ay = v²/R</p>
          </div>
        </div>
      </div>

      {issues.length > 0 && (
        <ul role="alert" className="space-y-1 rounded border border-danger-500/50 bg-danger-500/10 p-3">
          {issues.map((i, n) => (
            <li key={n} className="text-xs font-semibold leading-relaxed text-danger-400">✕ {i}</li>
          ))}
        </ul>
      )}
      {!textOk && (
        <p className="text-xs text-signal-amber">假设陈述至少 8 个字，且必须填写物理依据后才能保存。</p>
      )}
      {error && <p role="alert" className="text-xs font-semibold text-danger-400">✕ {error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={!canSave}>保存方法设置</Button>
        <Button variant="ghost" onClick={() => onClose(false)}>取消</Button>
        <p className="text-[11px] text-mist-500">保存后全部历史试跑的对照资格将按新方案重新计算，并给出明确提示。</p>
      </div>
    </div>
  );
}