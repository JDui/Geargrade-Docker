import { useEffect, useState } from "react";

import {
  fetchFinanceLeaderboard,
  fetchHoldingDurationLeaderboard,
  fetchScoreLeaderboard
} from "../api/leaderboards";
import {
  type FinanceLeaderboardItem,
  type HoldingDurationItem,
  type LeaderboardTab,
  type ScoreLeaderboardItem,
  type SortOrder
} from "../types/device";
import { formatCurrency, formatDate, formatDurationDays } from "../utils/format";
import { isFeelingScore, ratingLabelText } from "../utils/device";

type RankedEntry = {
  rank: number;
  deviceId: number;
  name: string;
  brand: string;
  headline: string;
  meta: string;
};

function tabLabel(tab: LeaderboardTab) {
  return {
    "holding-duration": "持有时间榜",
    score: "评分榜",
    finance: "理财榜"
  }[tab];
}

function normalizeEntries(
  tab: LeaderboardTab,
  items: HoldingDurationItem[] | ScoreLeaderboardItem[] | FinanceLeaderboardItem[]
): RankedEntry[] {
  if (tab === "holding-duration") {
    return (items as HoldingDurationItem[]).map((item) => ({
      rank: item.rank,
      deviceId: item.device_id,
      name: item.name,
      brand: item.brand,
      headline: formatDurationDays(item.duration_days),
      meta: `${formatDate(item.purchase_date)} 至 ${item.sale_date ? formatDate(item.sale_date) : "现在"}`
    }));
  }

  if (tab === "finance") {
    return (items as FinanceLeaderboardItem[]).map((item) => ({
      rank: item.rank,
      deviceId: item.device_id,
      name: item.name,
      brand: item.brand,
      headline: `${item.profit_value >= 0 ? "+" : ""}${formatCurrency(item.profit_value)}`,
      meta: `买入 ${formatCurrency(item.purchase_price)} / 卖出 ${formatCurrency(item.sale_price)}`
    }));
  }

  return (items as ScoreLeaderboardItem[]).map((item) => ({
    rank: item.rank,
    deviceId: item.device_id,
    name: item.name,
    brand: item.brand,
    headline: `${item.score}`,
    meta: isFeelingScore(item.score) ? "正在感受" : ratingLabelText(item.rating_label)
  }));
}

function podiumClasses(rank: number) {
  if (rank === 1) {
    return {
      outer:
        "min-h-[320px] border-warning/40 bg-[radial-gradient(circle_at_top,_rgba(247,201,95,0.28),_transparent_60%),linear-gradient(180deg,rgba(247,201,95,0.15),rgba(7,13,23,0.92))] shadow-[0_18px_60px_rgba(247,201,95,0.22)]",
      badge: "bg-warning/15 text-warning",
      value: "text-warning",
      number: "text-[5rem]"
    };
  }
  if (rank === 2) {
    return {
      outer:
        "min-h-[272px] border-accent/35 bg-[radial-gradient(circle_at_top,_rgba(92,200,255,0.22),_transparent_58%),linear-gradient(180deg,rgba(92,200,255,0.12),rgba(7,13,23,0.92))] shadow-[0_16px_52px_rgba(92,200,255,0.18)]",
      badge: "bg-accent/15 text-accent",
      value: "text-accent",
      number: "text-[4.25rem]"
    };
  }
  return {
    outer:
      "min-h-[236px] border-[#f5a76b]/30 bg-[radial-gradient(circle_at_top,_rgba(245,167,107,0.22),_transparent_58%),linear-gradient(180deg,rgba(245,167,107,0.12),rgba(7,13,23,0.92))] shadow-[0_12px_44px_rgba(245,167,107,0.18)]",
    badge: "bg-[#f5a76b]/15 text-[#f5a76b]",
    value: "text-[#f5a76b]",
    number: "text-[3.75rem]"
  };
}

function PodiumCard({ entry }: { entry: RankedEntry }) {
  const palette = podiumClasses(entry.rank);

  return (
    <article
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] border p-5 transition-transform duration-200 hover:-translate-y-1 ${palette.outer}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.16em] ${palette.badge}`}>
          RANK #{entry.rank}
        </span>
        <div className={`font-black leading-none text-white/10 ${palette.number}`}>{entry.rank}</div>
      </div>

      <div className="mt-10">
        <div className="text-2xl font-semibold text-textPrimary">{entry.name}</div>
        <div className="mt-1 text-sm text-textSecondary">{entry.brand}</div>
      </div>

      <div className="mt-8">
        <div className={`text-3xl font-black ${palette.value}`}>{entry.headline}</div>
        <div className="mt-2 text-sm leading-6 text-textSecondary">{entry.meta}</div>
      </div>
    </article>
  );
}

function LeaderboardList({ entries }: { entries: RankedEntry[] }) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.deviceId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panelAlt/70 px-4 py-4"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-panelAlt px-3 text-sm font-semibold text-textPrimary">
              #{entry.rank}
            </span>
            <div>
              <div className="font-medium text-textPrimary">{entry.name}</div>
              <div className="text-sm text-textSecondary">{entry.brand}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-textPrimary">{entry.headline}</div>
            <div className="text-sm text-textSecondary">{entry.meta}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardsPage() {
  const [tab, setTab] = useState<LeaderboardTab>("score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [holdingItems, setHoldingItems] = useState<HoldingDurationItem[]>([]);
  const [scoreItems, setScoreItems] = useState<ScoreLeaderboardItem[]>([]);
  const [financeItems, setFinanceItems] = useState<FinanceLeaderboardItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const loader =
      tab === "holding-duration"
        ? fetchHoldingDurationLeaderboard(sortOrder).then((result) => setHoldingItems(result.items))
        : tab === "score"
          ? fetchScoreLeaderboard(sortOrder).then((result) => setScoreItems(result.items))
          : fetchFinanceLeaderboard(sortOrder).then((result) => setFinanceItems(result.items));

    loader.catch((err: Error) => setError(err.message));
  }, [tab, sortOrder]);

  const activeItems =
    tab === "holding-duration"
      ? holdingItems
      : tab === "score"
        ? scoreItems
        : financeItems;

  const entries = normalizeEntries(tab, activeItems);
  const podiumEntries = [entries[2], entries[1], entries[0]].filter(
    (entry): entry is RankedEntry => Boolean(entry)
  );
  const restEntries = entries.slice(3);

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden p-6">
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-40 rounded-[32px] bg-[radial-gradient(circle_at_top,_rgba(92,200,255,0.12),_transparent_55%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-accent/80">Leaderboards</div>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-textPrimary">
                游戏天梯榜
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-textSecondary">
                用更直观的排名视角看你的器材偏好、持有时间和买卖结果。
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-line bg-panelAlt/70 p-1">
              <button
                className={sortOrder === "desc" ? "button-primary" : "button-secondary"}
                type="button"
                onClick={() => setSortOrder("desc")}
              >
                降序
              </button>
              <button
                className={sortOrder === "asc" ? "button-primary" : "button-secondary"}
                type="button"
                onClick={() => setSortOrder("asc")}
              >
                升序
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(["holding-duration", "score", "finance"] as LeaderboardTab[]).map((candidate) => (
              <button
                key={candidate}
                className={tab === candidate ? "button-primary" : "button-secondary"}
                type="button"
                onClick={() => setTab(candidate)}
              >
                {tabLabel(candidate)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">
          {error}
        </div>
      ) : null}

      <section className="panel p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-accent/80">
              {tabLabel(tab)}
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-textPrimary">
              Top 3 天梯席位
            </h2>
          </div>
          <div className="text-sm text-textSecondary">
            当前按{sortOrder === "desc" ? "降序" : "升序"}展示
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr,1fr,1.12fr] lg:items-end">
          {podiumEntries.length ? (
            podiumEntries.map((entry) => <PodiumCard key={entry.deviceId} entry={entry} />)
          ) : (
            <div className="col-span-full rounded-2xl border border-line bg-panelAlt/70 p-6 text-textSecondary">
              暂无榜单数据。
            </div>
          )}
        </div>
      </section>

      {restEntries.length ? (
        <section className="panel p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">
            Extended Ladder
          </div>
          <h3 className="mt-1 text-2xl font-semibold text-textPrimary">完整排名</h3>
          <div className="mt-5">
            <LeaderboardList entries={restEntries} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
