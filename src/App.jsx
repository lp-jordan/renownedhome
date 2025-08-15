import PanelGrid from "./components/PanelGrid";
import BackButton from "./components/BackButton";
import DarkModeToggle from "./components/DarkModeToggle";

export default function App() {
  return (
    <div
      className="relative w-screen h-screen border-4"
      style={{ borderColor: "var(--border)" }}
    >
      <PanelGrid />
      <BackButton />
      <DarkModeToggle />
    </div>
  );
}
