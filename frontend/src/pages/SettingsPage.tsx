import type { ReactNode } from "react";

import {
  type ContentWidth,
  type DefaultIconSize,
  type DensityMode,
  type MotionMode,
  useAppSettings
} from "../components/layout/AppSettingsProvider";

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  stateInAccessibleName = true
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  stateInAccessibleName?: boolean;
}) {
  return (
    <div className="settings-row">
      <div className="min-w-0">
        <h3 className="settings-row-title">{title}</h3>
        <p className="settings-row-copy">{description}</p>
      </div>
      <label className="settings-switch">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#5cc8ff]"
          aria-label={stateInAccessibleName ? undefined : title}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        {checked ? "已开启" : "已关闭"}
      </label>
    </div>
  );
}

function SegmentedRow<Value extends string>({
  title,
  description,
  value,
  options,
  onChange
}: {
  title: string;
  description: string;
  value: Value;
  options: Array<{ value: Value; label: string }>;
  onChange: (value: Value) => void;
}) {
  return (
    <div className="settings-row">
      <div className="min-w-0">
        <h3 className="settings-row-title">{title}</h3>
        <p className="settings-row-copy">{description}</p>
      </div>
      <div className="settings-segmented" role="group" aria-label={title}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "button-primary px-3 py-1.5 text-xs" : "button-secondary px-3 py-1.5 text-xs"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel settings-group">
      <div className="dashboard-kicker">{title}</div>
      <div className="mt-4 divide-y divide-line/70">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const {
    simplifiedMode,
    setSimplifiedMode,
    motionMode,
    setMotionMode,
    contentWidth,
    setContentWidth,
    density,
    setDensity,
    showBackgroundGrid,
    setShowBackgroundGrid,
    defaultIconSize,
    setDefaultIconSize
  } = useAppSettings();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="panel p-6">
        <div className="text-xs uppercase tracking-[0.22em] text-accent/80">Settings</div>
        <h1 className="mt-2 text-3xl font-semibold text-textPrimary">设置</h1>
      </section>

      <SettingsGroup title="录入">
        <ToggleRow
          title="简化模式"
          description="日期只填写到月份，新增设备不要求图片，缺图时使用类别默认图标。"
          checked={simplifiedMode}
          onChange={setSimplifiedMode}
        />
      </SettingsGroup>

      <SettingsGroup title="界面">
        <SegmentedRow<MotionMode>
          title="动画效果"
          description="自动跟随系统减少动态效果设置，也可以强制开启或减少。"
          value={motionMode}
          onChange={setMotionMode}
          options={[
            { value: "system", label: "自动" },
            { value: "on", label: "开启" },
            { value: "reduced", label: "减少" }
          ]}
        />
        <SegmentedRow<ContentWidth>
          title="页面宽度"
          description="控制主内容最大宽度，适配小屏专注或宽屏浏览。"
          value={contentWidth}
          onChange={setContentWidth}
          options={[
            { value: "compact", label: "紧凑" },
            { value: "default", label: "默认" },
            { value: "wide", label: "宽屏" }
          ]}
        />
        <SegmentedRow<DensityMode>
          title="信息密度"
          description="紧凑模式会收紧面板、列表和抽屉间距，但不隐藏字段。"
          value={density}
          onChange={setDensity}
          options={[
            { value: "comfortable", label: "舒适" },
            { value: "compact", label: "紧凑" }
          ]}
        />
      </SettingsGroup>

      <SettingsGroup title="视觉">
        <ToggleRow
          title="背景网格"
          description="关闭后移除页面背景网格，界面更安静。"
          checked={showBackgroundGrid}
          onChange={setShowBackgroundGrid}
          stateInAccessibleName={false}
        />
        <SegmentedRow<DefaultIconSize>
          title="默认图标大小"
          description="控制缺图设备的类别图标尺寸，简化模式默认更小。"
          value={defaultIconSize}
          onChange={setDefaultIconSize}
          options={[
            { value: "small", label: "小" },
            { value: "medium", label: "中" }
          ]}
        />
      </SettingsGroup>
    </div>
  );
}
