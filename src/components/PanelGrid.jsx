import PanelCard from "./PanelCard";
export default function PanelGrid() {
  return (
    <div className="grid grid-cols-2 grid-rows-3 gap-2 w-full h-full">
      <PanelCard
        className="bg-faded-rust col-span-2"
        imageSrc="https://via.placeholder.com/300x150?text=Panel+1"
        label="Panel 1"
        onClick={() => {}}
      />
      <PanelCard
        className="bg-sepia-smoke"
        imageSrc="https://via.placeholder.com/150?text=Panel+2"
        label="Panel 2"
        onClick={() => {}}
      />
      <PanelCard
        className="bg-midnight-teal row-span-2"
        imageSrc="https://via.placeholder.com/150?text=Panel+3"
        label="Panel 3"
        onClick={() => {}}
      />
      <PanelCard
        className="bg-aged-brass text-coal-black"
        imageSrc="https://via.placeholder.com/150?text=Panel+4"
        label="Panel 4"
        onClick={() => {}}
      />
      <PanelCard
        className="bg-faded-rust col-span-2"
        imageSrc="https://via.placeholder.com/300x150?text=Panel+5"
        label="Panel 5"
        onClick={() => {}}
      />
      <PanelCard
        className="bg-sepia-smoke"
        imageSrc="https://via.placeholder.com/150?text=Panel+6"
        label="Panel 6"
        onClick={() => {}}
      />
    </div>
  );
}
