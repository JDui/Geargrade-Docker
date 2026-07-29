import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { fetchAppSettings, updateAppSettings, type AppSettingsApi } from "../../api/settings";

export type MotionMode = "system" | "on" | "reduced";
export type ContentWidth = "compact" | "default" | "wide";
export type DensityMode = "comfortable" | "compact";
export type DefaultIconSize = "small" | "medium";

export interface AppSettings {
  simplifiedMode: boolean;
  motionMode: MotionMode;
  contentWidth: ContentWidth;
  density: DensityMode;
  showBackgroundGrid: boolean;
  defaultIconSize: DefaultIconSize;
}

interface AppSettingsContextValue {
  settings: AppSettings;
  simplifiedMode: boolean;
  reduceMotion: boolean;
  motionMode: MotionMode;
  contentWidth: ContentWidth;
  density: DensityMode;
  showBackgroundGrid: boolean;
  defaultIconSize: DefaultIconSize;
  setSimplifiedMode: (enabled: boolean) => void;
  setMotionMode: (mode: MotionMode) => void;
  setContentWidth: (width: ContentWidth) => void;
  setDensity: (density: DensityMode) => void;
  setShowBackgroundGrid: (enabled: boolean) => void;
  setDefaultIconSize: (size: DefaultIconSize) => void;
  updateSetting: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);
const SETTINGS_STORAGE_KEY = "geargrade-app-settings-v1";
const LEGACY_SIMPLIFIED_MODE_KEY = "geargrade-simplified-mode";

const DEFAULT_SETTINGS: AppSettings = {
  simplifiedMode: true,
  motionMode: "system",
  contentWidth: "default",
  density: "comfortable",
  showBackgroundGrid: true,
  defaultIconSize: "small"
};

function isMotionMode(value: unknown): value is MotionMode {
  return value === "system" || value === "on" || value === "reduced";
}

function isContentWidth(value: unknown): value is ContentWidth {
  return value === "compact" || value === "default" || value === "wide";
}

function isDensityMode(value: unknown): value is DensityMode {
  return value === "comfortable" || value === "compact";
}

function isDefaultIconSize(value: unknown): value is DefaultIconSize {
  return value === "small" || value === "medium";
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS;
  }

  const parsed = value as Partial<AppSettings>;
  return {
    simplifiedMode: typeof parsed.simplifiedMode === "boolean" ? parsed.simplifiedMode : DEFAULT_SETTINGS.simplifiedMode,
    motionMode: isMotionMode(parsed.motionMode) ? parsed.motionMode : DEFAULT_SETTINGS.motionMode,
    contentWidth: isContentWidth(parsed.contentWidth) ? parsed.contentWidth : DEFAULT_SETTINGS.contentWidth,
    density: isDensityMode(parsed.density) ? parsed.density : DEFAULT_SETTINGS.density,
    showBackgroundGrid: typeof parsed.showBackgroundGrid === "boolean" ? parsed.showBackgroundGrid : DEFAULT_SETTINGS.showBackgroundGrid,
    defaultIconSize: isDefaultIconSize(parsed.defaultIconSize) ? parsed.defaultIconSize : DEFAULT_SETTINGS.defaultIconSize
  };
}

function readInitialSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (stored) {
    try {
      return normalizeSettings(JSON.parse(stored));
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  const legacySimplifiedMode = window.localStorage.getItem(LEGACY_SIMPLIFIED_MODE_KEY);
  if (legacySimplifiedMode == null) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    simplifiedMode: legacySimplifiedMode !== "false"
  };
}

function hasCachedSettings(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    window.localStorage.getItem(SETTINGS_STORAGE_KEY) || window.localStorage.getItem(LEGACY_SIMPLIFIED_MODE_KEY)
  );
}

function readPrefersReducedMotion() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function fromApiSettings(value: AppSettingsApi): AppSettings {
  return normalizeSettings({
    simplifiedMode: value.simplified_mode,
    motionMode: value.motion_mode,
    contentWidth: value.content_width,
    density: value.density,
    showBackgroundGrid: value.show_background_grid,
    defaultIconSize: value.default_icon_size
  });
}

function toApiSettings(value: AppSettings): AppSettingsApi {
  return {
    simplified_mode: value.simplifiedMode,
    motion_mode: value.motionMode,
    content_width: value.contentWidth,
    density: value.density,
    show_background_grid: value.showBackgroundGrid,
    default_icon_size: value.defaultIconSize
  };
}

export function AppSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState(readInitialSettings);
  const [settingsReady, setSettingsReady] = useState(false);
  const settingsChangedBeforeLoad = useRef(false);
  const hasCachedSettingsRef = useRef(hasCachedSettings());
  const settingsWriteQueue = useRef(Promise.resolve());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPrefersReducedMotion);
  const reduceMotion = settings.motionMode === "reduced" || (settings.motionMode === "system" && prefersReducedMotion);

  function updateSetting<Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) {
    settingsChangedBeforeLoad.current = true;
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  useEffect(() => {
    let active = true;

    fetchAppSettings()
      .then((remoteSettings) => {
        if (active && !settingsChangedBeforeLoad.current && !hasCachedSettingsRef.current) {
          setSettings(fromApiSettings(remoteSettings));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setSettingsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.localStorage.setItem(LEGACY_SIMPLIFIED_MODE_KEY, settings.simplifiedMode ? "true" : "false");
    if (settingsReady) {
      settingsWriteQueue.current = settingsWriteQueue.current
        .catch(() => undefined)
        .then(() => updateAppSettings(toApiSettings(settings)))
        .then(() => undefined);
    }
  }, [settings, settingsReady]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = settings.motionMode;
    root.dataset.effectiveMotion = reduceMotion ? "reduced" : "on";
    root.dataset.contentWidth = settings.contentWidth;
    root.dataset.density = settings.density;
    root.dataset.backgroundGrid = settings.showBackgroundGrid ? "on" : "off";
    root.dataset.defaultIconSize = settings.defaultIconSize;
  }, [reduceMotion, settings]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      settings,
      simplifiedMode: settings.simplifiedMode,
      reduceMotion,
      motionMode: settings.motionMode,
      contentWidth: settings.contentWidth,
      density: settings.density,
      showBackgroundGrid: settings.showBackgroundGrid,
      defaultIconSize: settings.defaultIconSize,
      setSimplifiedMode: (enabled) => updateSetting("simplifiedMode", enabled),
      setMotionMode: (mode) => updateSetting("motionMode", mode),
      setContentWidth: (width) => updateSetting("contentWidth", width),
      setDensity: (density) => updateSetting("density", density),
      setShowBackgroundGrid: (enabled) => updateSetting("showBackgroundGrid", enabled),
      setDefaultIconSize: (size) => updateSetting("defaultIconSize", size),
      updateSetting
    }),
    [reduceMotion, settings]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider.");
  }
  return context;
}
