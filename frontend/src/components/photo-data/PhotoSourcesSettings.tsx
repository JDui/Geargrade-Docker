import { useEffect, useState } from "react";
import {
  createPhotoSource, deletePhotoSource, getPhotoStatus, type PhotoSource
} from "../../api/photoData";

export function PhotoSourcesSettings() {
  const [items, setItems] = useState<PhotoSource[]>([]);
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const result = await getPhotoStatus();
      setItems(result.sources);
    } catch (error) {
      setMessage(String(error));
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function create() {
    setSaving(true);
    setMessage("");
    try {
      await createPhotoSource(name || rootPath,rootPath);
      setName(""); setRootPath("");
      await refresh();
      setMessage("目录已保存。只有在「拍摄数据」页面点击扫描更新时才会访问源目录。");
    } catch (error) { setMessage(String(error)); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("移除此扫描来源及其本地索引记录？原始照片不会被修改。")) return;
    try { await deletePhotoSource(id); await refresh(); }
    catch (error) { setMessage(String(error)); }
  }

  return (
    <section className="panel p-6 space-y-4">
      <div>
        <div className="dashboard-kicker">Photo Sources</div>
        <h2 className="mt-2 text-xl font-semibold text-textPrimary">拍摄数据源</h2>
        <p className="mt-2 text-sm leading-6 text-textSecondary">
          先在 Docker 以只读模式（:ro）挂载照片文件夹，并设置 PHOTO_DATA_ALLOWED_ROOTS。
          此处输入的是容器内部路径，不是浏览器所在电脑的文件夹路径。
          保存设置不会读取任何照片，扫描仅由拍摄数据页的按钮触发。
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input className="input min-w-0" aria-label="来源名称" placeholder="来源名称，例如 NAS 归档"
          value={name} onChange={(e)=>setName(e.target.value)} />
        <input className="input min-w-0" aria-label="容器内的扫描路径" placeholder="/mnt/photo-library"
          value={rootPath} onChange={(e)=>setRootPath(e.target.value)} />
        <button className="button-primary" type="button" onClick={()=>void create()} disabled={!rootPath.trim()||saving}>
          添加目录
        </button>
      </div>
      {message ? <p role="status" className="text-sm text-textSecondary">{message}</p>:null}
      <div className="space-y-2">
        {items.map(item=>(
          <div key={item.id} className="rounded-xl border border-line bg-panelAlt/70 px-4 py-3 flex gap-3 items-center justify-between">
            <div className="min-w-0">
              <div className="font-semibold text-textPrimary">{item.name}</div>
              <div className="text-xs break-all text-textSecondary">{item.root_path}</div>
              <div className="text-xs text-textSecondary mt-1">
                上次成功：{item.last_success?new Date(item.last_success).toLocaleString():"尚未扫描"}
              </div>
            </div>
            <button className="button-secondary shrink-0" type="button" onClick={()=>void remove(item.id)}>移除索引</button>
          </div>
        ))}
        {!items.length ? <p className="text-sm text-textSecondary">尚未配置目录。此模块不会自动搜索磁盘。</p>:null}
      </div>
    </section>
  );
}
