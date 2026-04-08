import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteDevice, fetchDevice, updateDevice } from "../../api/devices";
import {
  CATEGORY_LABELS,
  RATING_LABELS,
  STATUS_LABELS,
  type DeviceDetail
} from "../../types/device";
import { formatCurrency, formatDate, formatDateTime } from "../../utils/format";

interface DeviceDetailDrawerProps {
  deviceId: string;
  onChanged: () => void;
}

export function DeviceDetailDrawer({ deviceId, onChanged }: DeviceDetailDrawerProps) {
  const navigate = useNavigate();
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchDevice(deviceId)
      .then((result) => {
        if (active) {
          setDevice(result);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [deviceId]);

  async function handleArchive() {
    if (!device) return;
    await updateDevice(deviceId, { status: "archived", is_currently_owned: false });
    const updated = await fetchDevice(deviceId);
    setDevice(updated);
    onChanged();
  }

  async function handleDelete() {
    if (!window.confirm("确认删除这个设备档案吗？")) {
      return;
    }
    await deleteDevice(deviceId);
    onChanged();
    navigate("/");
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
        onClick={() => navigate("/")}
        aria-label="关闭详情"
      />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-xl border-l border-line bg-surface/95 shadow-panel">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-accent/80">设备详情</div>
              <h2 className="mt-1 text-2xl font-semibold text-white">{device?.name ?? "加载中..."}</h2>
            </div>
            <button type="button" className="button-secondary" onClick={() => navigate("/")}>
              关闭
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading ? <div className="text-slate-300">正在加载设备详情...</div> : null}
            {error ? <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}

            {!loading && !error && device ? (
              <div className="space-y-6">
                <section className="panel p-4">
                  {device.image_url ? (
                    <img
                      src={device.image_url}
                      alt={device.name}
                      className="mb-4 h-52 w-full rounded-2xl border border-line object-cover"
                    />
                  ) : (
                    <div className="mb-4 flex h-52 items-center justify-center rounded-2xl border border-dashed border-line bg-panelAlt text-slate-500">
                      暂无设备图片
                    </div>
                  )}
                  <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                    <div>
                      <div className="text-slate-400">品牌</div>
                      <div>{device.brand}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">类别</div>
                      <div>{CATEGORY_LABELS[device.category]}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">状态</div>
                      <div>{STATUS_LABELS[device.status]}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">评价等级</div>
                      <div>{RATING_LABELS[device.rating]}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">系统 / 卡口</div>
                      <div>{device.mount_system || "未记录"}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">当前持有</div>
                      <div>{device.is_currently_owned ? "是" : "否"}</div>
                    </div>
                  </div>
                </section>

                <section className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">主观评价系统</div>
                  <div className="mt-4 rounded-2xl bg-panelAlt p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">一句话总结</div>
                    <p className="mt-2 text-sm leading-7 text-slate-100">{device.summary}</p>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-success/8 p-4">
                      <div className="text-sm font-medium text-success">优点</div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-200">
                        {device.pros.length ? device.pros.map((item) => <li key={item}>• {item}</li>) : <li>暂无</li>}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-danger/8 p-4">
                      <div className="text-sm font-medium text-danger">缺点</div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-200">
                        {device.cons.length ? device.cons.map((item) => <li key={item}>• {item}</li>) : <li>暂无</li>}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-sm font-medium text-slate-200">详细评价</div>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-300">{device.review_detail || "暂无详细评价"}</p>
                  </div>
                </section>

                <section className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">财务与时间记录</div>
                  <div className="mt-4 grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-slate-400">购入价格</div>
                      <div className="mt-1 text-lg text-white">{formatCurrency(device.purchase_price)}</div>
                    </div>
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-slate-400">售出价格</div>
                      <div className="mt-1 text-lg text-white">{formatCurrency(device.sale_price)}</div>
                    </div>
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-slate-400">购入日期</div>
                      <div className="mt-1 text-white">{formatDate(device.purchase_date)}</div>
                    </div>
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-slate-400">售出日期</div>
                      <div className="mt-1 text-white">{formatDate(device.sale_date)}</div>
                    </div>
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-slate-400">创建时间</div>
                      <div className="mt-1 text-white">{formatDateTime(device.created_at)}</div>
                    </div>
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-slate-400">更新时间</div>
                      <div className="mt-1 text-white">{formatDateTime(device.updated_at)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/devices/${device.id}/edit`} className="button-primary">
                      编辑设备
                    </Link>
                    <button type="button" className="button-secondary" onClick={handleArchive}>
                      归档设备
                    </button>
                    <button type="button" className="button-danger" onClick={handleDelete}>
                      删除设备
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
