import PanelCard from "./PanelCard";
import PanelContent from "./PanelContent";

export default function PanelGrid() {
  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
      <PanelCard className="bg-red-200">
        <PanelContent>Panel 1</PanelContent>
      </PanelCard>
      <PanelCard className="bg-blue-200">
        <PanelContent>Panel 2</PanelContent>
      </PanelCard>
      <PanelCard className="bg-green-200">
        <PanelContent>Panel 3</PanelContent>
      </PanelCard>
      <PanelCard className="bg-yellow-200">
        <PanelContent>Panel 4</PanelContent>
      </PanelCard>
    </div>
  );
}
