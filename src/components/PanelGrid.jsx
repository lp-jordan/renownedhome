import PanelCard from "./PanelCard";
import PanelContent from "./PanelContent";

export default function PanelGrid() {
  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
      <PanelCard className="bg-faded-rust">
        <PanelContent>Panel 1</PanelContent>
      </PanelCard>
      <PanelCard className="bg-sepia-smoke">
        <PanelContent>Panel 2</PanelContent>
      </PanelCard>
      <PanelCard className="bg-midnight-teal">
        <PanelContent>Panel 3</PanelContent>
      </PanelCard>
      <PanelCard className="bg-aged-brass text-coal-black">
        <PanelContent>Panel 4</PanelContent>
      </PanelCard>
    </div>
  );
}
