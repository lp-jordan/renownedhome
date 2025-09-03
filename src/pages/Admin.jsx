import { useState } from "react";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "admin";
const PAGES = [
  { path: "/read", name: "Read" },
  { path: "/buy", name: "Buy" },
  { path: "/meet", name: "Meet" },
  { path: "/connect", name: "Connect" },
];

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(
    () => localStorage.getItem("adminAuthed") === "true"
  );

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

  return (
    <div className="w-full h-full border border-black rounded-lg overflow-hidden">
      <div className="h-full overflow-y-auto flex flex-col px-6 pt-10 pb-6">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <ul className="space-y-4">
          {PAGES.map((page) => (
            <li key={page.path} className="border p-4 rounded">
              {page.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

