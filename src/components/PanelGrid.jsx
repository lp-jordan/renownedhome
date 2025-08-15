import PanelCard from "./PanelCard";

export default function PanelGrid() {
  return (
    <div className="grid grid-rows-3 gap-4 w-full h-full">
      <div className="grid h-full grid-cols-1 gap-4">
        <PanelCard
          className="bg-blue-900 h-full"
          imageSrc="https://via.placeholder.com/600x300?text=Panel+1"
          label="Panel 1"
          onClick={() => {
            console.log("Panel 1 clicked");
            // TODO: Route to Panel 1 subpage
          }}
        />
      </div>
      <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
        <PanelCard
          className="bg-blue-700 h-full"
          imageSrc="https://via.placeholder.com/300x200?text=Panel+2"
          label="Panel 2"
          onClick={() => {
            console.log("Panel 2 clicked");
            // TODO: Route to Panel 2 subpage
          }}
        />
        <PanelCard
          className="bg-blue-600 h-full"
          imageSrc="https://via.placeholder.com/300x200?text=Panel+3"
          label="Panel 3"
          onClick={() => {
            console.log("Panel 3 clicked");
            // TODO: Route to Panel 3 subpage
          }}
        />
      </div>
      <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-3">
        <PanelCard
          className="bg-blue-500 h-full col-span-1 sm:col-span-1"
          imageSrc="https://via.placeholder.com/200x133?text=Panel+4"
          label="Panel 4"
          onClick={() => {
            console.log("Panel 4 clicked");
            // TODO: Route to Panel 4 subpage
          }}
        />
        <PanelCard
          className="bg-blue-400 h-full col-span-1 sm:col-span-2"
          imageSrc="https://via.placeholder.com/400x267?text=Panel+5"
          label="Panel 5"
          onClick={() => {
            console.log("Panel 5 clicked");
            // TODO: Route to Panel 5 subpage
          }}
        />
      </div>
    </div>
  );
}
