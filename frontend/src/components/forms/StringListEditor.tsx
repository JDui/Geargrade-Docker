import { useState } from "react";

interface StringListEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}

export function StringListEditor({ value, onChange, placeholder }: StringListEditorProps) {
  const [draft, setDraft] = useState("");

  function addItem() {
    const normalized = draft.trim();
    if (!normalized) return;
    onChange([...value, normalized]);
    setDraft("");
  }

  function removeItem(item: string) {
    onChange(value.filter((entry) => entry !== item));
  }

  return (
    <div className="rounded-2xl border border-line bg-panelAlt px-3 py-3">
      <div className="flex flex-wrap gap-2">
        {value.length ? (
          value.map((item) => (
            <button
              key={`${item}-${value.indexOf(item)}`}
              type="button"
              className="rounded-full border border-line px-3 py-1 text-sm text-slate-200 hover:border-danger/40 hover:text-danger"
              onClick={() => removeItem(item)}
            >
              {item} ×
            </button>
          ))
        ) : (
          <span className="text-sm text-slate-500">暂无内容</span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="field"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
        />
        <button type="button" className="button-secondary shrink-0" onClick={addItem}>
          添加
        </button>
      </div>
    </div>
  );
}
