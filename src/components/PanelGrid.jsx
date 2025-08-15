import PanelCard from "./PanelCard";
export default function PanelGrid() {
  return (
    <div className="grid grid-cols-2 grid-rows-3 gap-2 w-full h-full sm:grid-cols-1 sm:grid-rows-6">
      <PanelCard
        className="bg-faded-rust col-span-2"
        imageSrc="https://via.placeholder.com/300x150?text=Panel+1"
        label="Panel 1"
        onClick={() => {
          console.log("Panel 1 clicked");
          // TODO: Route to Panel 1 subpage
        }}
      />
      <PanelCard
        className="bg-sepia-smoke"
        imageSrc="https://via.placeholder.com/150?text=Panel+2"
        label="Panel 2"
        onClick={() => {
          console.log("Panel 2 clicked");
          // TODO: Route to Panel 2 subpage
        }}
      />
      <PanelCard
        className="bg-midnight-teal row-span-2"
        imageSrc="https://via.placeholder.com/150?text=Panel+3"
        label="Panel 3"
        onClick={() => {
          console.log("Panel 3 clicked");
          // TODO: Route to Panel 3 subpage
        }}
      />
      <PanelCard
        className="bg-aged-brass text-coal-black"
        imageSrc="https://via.placeholder.com/150?text=Panel+4"
        label="Panel 4"
        onClick={() => {
          console.log("Panel 4 clicked");
          // TODO: Route to Panel 4 subpage
        }}
      />
      <PanelCard
        className="bg-faded-rust col-span-2"
        imageSrc="https://via.placeholder.com/300x150?text=Panel+5"
        label="Panel 5"
        onClick={() => {
          console.log("Panel 5 clicked");
          // TODO: Route to Panel 5 subpage
        }}
      />
      <PanelCard
        className="bg-sepia-smoke"
        imageSrc="https://via.placeholder.com/150?text=Panel+6"
        label="Panel 6"
        onClick={() => {
          console.log("Panel 6 clicked");
          // TODO: Route to Panel 6 subpage
        }}
      />
    </div>
  );
}
