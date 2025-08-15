import PanelGrid from "./components/PanelGrid";
import BackButton from "./components/BackButton";

export default function App() {
  return (
    <div className="relative w-screen h-screen border-4 border-sepia-smoke">
      <PanelGrid />
      <BackButton />
    </div>
  );
}
