import { useState } from "react";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "admin";
const PAGES = [
  { id: "splash", name: "Splash Screen" },
  { id: "read", name: "Read" },
  { id: "buy", name: "Buy" },
  { id: "meet", name: "Meet" },
  { id: "connect", name: "Connect" },
];

const SIZE_OPTIONS = [
  { value: "text-xs", label: "Extra Small" },
  { value: "text-sm", label: "Small" },
  { value: "text-base", label: "Base" },
  { value: "text-lg", label: "Large" },
  { value: "text-xl", label: "Extra Large" },
  { value: "text-2xl", label: "2XL" },
  { value: "text-3xl", label: "3XL" },
  { value: "text-4xl", label: "4XL" },
  { value: "text-5xl", label: "5XL" },
  { value: "text-6xl", label: "6XL" },
  { value: "text-7xl", label: "7XL" },
  { value: "text-8xl", label: "8XL" },
  { value: "text-9xl", label: "9XL" },
  { value: "text-[clamp(3rem,8vw,10rem)]", label: "Responsive Hero" },
];

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(
    () => localStorage.getItem("adminAuthed") === "true"
  );
  const [selectedPage, setSelectedPage] = useState(null);
  const [formData, setFormData] = useState(null);
  const [defaultData, setDefaultData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthorized(true);
      localStorage.setItem("adminAuthed", "true");
    }
  };

  if (!authorized) {
    return (
      <div className="w-full h-full border border-black rounded-lg overflow-hidden">
        <div className="h-full flex items-center justify-center p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border px-3 py-2 rounded"
              placeholder="Password"
            />
            <button
              type="submit"
              className="bg-black text-white px-4 py-2 rounded"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  const loadPage = async (page) => {
    setSelectedPage(page);
    setFormData(null);
    setDefaultData(null);
    try {
      const res = await fetch(`/api/pages/${page.id}`);
      if (!res.ok) {
        setError('Failed to load page');
        return;
      }
      const data = await res.json();
      setFormData(data);
      setDefaultData(structuredClone(data));
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load page');
    }
  };

  const updateField = (path, value) => {
    setFormData((prev) => {
      const updated = structuredClone(prev);
      let obj = updated;
      for (let i = 0; i < path.length - 1; i += 1) {
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = value;
      return updated;
    });
  };

  const getValueAtPath = (obj, path) => {
    let val = obj;
    for (const key of path) {
      val = val[key];
    }
    return val;
  };

  const resetField = (path) => {
    setFormData((prev) => {
      const updated = structuredClone(prev);
      let obj = updated;
      for (let i = 0; i < path.length - 1; i += 1) {
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = getValueAtPath(defaultData, path);
      return updated;
    });
  };

  const handleImageUpload = async (file, path) => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      console.log('Uploading image:', file.name);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        console.error('Upload failed:', res.status, await res.text());
        setError('Failed to upload image');
        return;
      }
      const data = await res.json();
      console.log('Upload succeeded:', data.path);
      updateField(path, data.path);
    } catch (err) {
      console.error(err);
    }
  };

  const renderFields = (data, path = []) =>
    Object.entries(data).map(([key, value]) => {
      const fieldPath = [...path, key];
      if (key === "className") {
        return null;
      }
      if (path[0] === "hero" && path.length === 1 && key === "image") {
        return null;
      }
      if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          return (
            <div key={fieldPath.join('.')} className="space-y-2">
              <div className="font-semibold">{key}</div>
              {value.map((item, idx) => (
                <div key={idx} className="pl-4 border-l">
                  {typeof item === "object"
                    ? renderFields(item, [...fieldPath, idx])
                    : renderInput(`${key}[${idx}]`, item, [...fieldPath, idx])}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addArrayItem(fieldPath)}
                className="px-2 py-1 text-sm border rounded"
              >
                Add
              </button>
            </div>
          );
        }
        return (
          <fieldset key={fieldPath.join('.')} className="border p-2">
            <legend className="font-semibold">{key}</legend>
            {renderFields(value, fieldPath)}
          </fieldset>
        );
      }
      return renderInput(key, value, fieldPath);
    });

  const getPlaceholder = (path, length) => {
    const joined = path.join('.');
    if (joined === 'issues') {
      return {
        order: length + 1,
        releaseDate: 'date',
        title: 'title',
        subtitle: 'subtitle',
        description: 'description',
        writer: 'writer',
        artist: 'artist',
        colorist: 'colorist',
        heroImage: '/uploads/placeholder.png',
        thumbnail: '/uploads/placeholder.png',
      };
    }
    if (joined === 'bios') {
      return {
        name: 'Name',
        image: '/uploads/placeholder.png',
        biography: 'Biography',
        works: 'Work 1, Work 2',
      };
    }
    return '';
  };

  const addArrayItem = (path) => {
    setFormData((prev) => {
      const updated = structuredClone(prev);
      let arr = updated;
      for (let i = 0; i < path.length; i += 1) {
        arr = arr[path[i]];
      }
      arr.push(getPlaceholder(path, arr.length));
      return updated;
    });
  };

  const renderInput = (label, value, path) => {
    const name = path.join('.');
    const displayLabel =
      name === 'panel.image'
        ? 'Panel Image'
        : name === 'panel.main.name'
        ? 'Panel Name'
        : path[path.length - 1] === 'size'
        ? 'Text Size'
        : label;
    const handleChange = (e) => {
      let val;
      if (typeof value === 'number') {
        val = Number(e.target.value);
      } else if (typeof value === 'boolean') {
        val = e.target.checked;
      } else {
        val = e.target.value;
      }
      updateField(path, val);
    };

    if (typeof value === 'string') {
      const isDate = !Number.isNaN(Date.parse(value)) && /\d{4}-\d{2}-\d{2}/.test(value);
      const isImageField =
        label.toLowerCase().includes('image') ||
        label.toLowerCase().includes('thumbnail') ||
        /\.(png|jpe?g|gif|webp|svg)$/i.test(value);
      if (isImageField) {
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="font-medium">{displayLabel}</label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleImageUpload(e.dataTransfer.files[0], path);
              }}
              onClick={() =>
                document.getElementById(`${name}-file`).click()
              }
              className="w-32 h-32 border rounded overflow-hidden flex items-center justify-center cursor-pointer"
            >
              {value ? (
                <img
                  src={value}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm text-gray-500 text-center p-2">
                  Drop image or click to upload
                </span>
              )}
            </div>
            <input
              id={`${name}-file`}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e.target.files[0], path)}
              className="hidden"
            />
          </div>
        );
      }
      if (path[path.length - 1] === 'size') {
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="font-medium">{displayLabel}</label>
            <div className="flex items-center gap-2">
              <select
                value={value}
                onChange={handleChange}
                className="border px-2 py-1 rounded"
              >
                {SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => resetField(path)}
                className="p-1 border rounded-full"
              >
                ↺
              </button>
            </div>
          </div>
        );
      }
      if (path[path.length - 1] === 'subtitle') {
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="font-medium">{displayLabel}</label>
            <div className="flex items-center gap-2">
              <textarea
                value={value}
                onChange={handleChange}
                className="border px-2 py-1 rounded flex-1"
                rows={3}
              />
              <button
                type="button"
                onClick={() => resetField(path)}
                className="p-1 border rounded-full"
              >
                ↺
              </button>
            </div>
          </div>
        );
      }
      if (isDate) {
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="font-medium">{displayLabel}</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={value.slice(0, 10)}
                onChange={handleChange}
                className="border px-2 py-1 rounded"
              />
              <button
                type="button"
                onClick={() => resetField(path)}
                className="p-1 border rounded-full"
              >
                ↺
              </button>
            </div>
          </div>
        );
      }
      if (value.length > 60 || value.includes('\n')) {
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="font-medium">{displayLabel}</label>
            <div className="flex items-center gap-2">
              <textarea
                value={value}
                onChange={handleChange}
                className="border px-2 py-1 rounded flex-1"
              />
              <button
                type="button"
                onClick={() => resetField(path)}
                className="p-1 border rounded-full"
              >
                ↺
              </button>
            </div>
          </div>
        );
      }
      return (
        <div key={name} className="flex flex-col gap-1">
          <label className="font-medium">{displayLabel}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={handleChange}
              className="border px-2 py-1 rounded"
            />
            <button
              type="button"
              onClick={() => resetField(path)}
              className="p-1 border rounded-full"
            >
              ↺
            </button>
          </div>
        </div>
      );
    }
    if (typeof value === 'number') {
      return (
        <div key={name} className="flex flex-col gap-1">
          <label className="font-medium">{displayLabel}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={value}
              onChange={handleChange}
              className="border px-2 py-1 rounded"
            />
            <button
              type="button"
              onClick={() => resetField(path)}
              className="p-1 border rounded-full"
            >
              ↺
            </button>
          </div>
        </div>
      );
    }
    if (typeof value === 'boolean') {
      return (
        <div key={name} className="flex items-center gap-2">
          <input type="checkbox" checked={value} onChange={handleChange} />
          <label className="font-medium flex-1">{displayLabel}</label>
          <button
            type="button"
            onClick={() => resetField(path)}
            className="p-1 border rounded-full"
          >
            ↺
          </button>
        </div>
      );
    }
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/pages/${selectedPage.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData, null, 2),
      });
      setSelectedPage(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (selectedPage && formData) {
    return (
      <div className="w-full h-full border border-black rounded-lg overflow-hidden">
        <div className="h-full overflow-y-auto flex flex-col px-6 pt-10 pb-6 gap-4">
          <h1 className="text-2xl font-bold mb-2">Edit {selectedPage.name}</h1>
          {error && <div className="text-red-500">{error}</div>}
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {renderFields(formData)}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-black text-white px-4 py-2 rounded"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPage(null)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full border border-black rounded-lg overflow-hidden">
      <div className="h-full overflow-y-auto flex flex-col px-6 pt-10 pb-6">
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <ul className="space-y-4">
          {PAGES.map((page) => (
            <li
              key={page.id}
              className="border p-4 rounded cursor-pointer hover:bg-gray-50"
              onClick={() => loadPage(page)}
            >
              {page.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
