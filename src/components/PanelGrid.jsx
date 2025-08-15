import PanelCard from "./PanelCard";

export default function PanelGrid() {
  return (
    <div className="grid grid-cols-6 grid-rows-3 gap-2 w-full h-full sm:grid-cols-1 sm:grid-rows-5">
      <PanelCard
        className="bg-blue-900 col-span-6 sm:col-span-1"
        imageSrc="https://via.placeholder.com/600x300?text=Panel+1"
        label="Panel 1"
        onClick={() => {
          console.log("Panel 1 clicked");
          // TODO: Route to Panel 1 subpage
        }}
      />
      <PanelCard
        className="bg-blue-700 col-span-3 sm:col-span-1"
        imageSrc="https://via.placeholder.com/300x200?text=Panel+2"
        label="Panel 2"
        onClick={() => {
          console.log("Panel 2 clicked");
          // TODO: Route to Panel 2 subpage
        }}
      />
      <PanelCard
        className="bg-blue-600 col-span-3 sm:col-span-1"
        imageSrc="https://via.placeholder.com/300x200?text=Panel+3"
        label="Panel 3"
        onClick={() => {
          console.log("Panel 3 clicked");
          // TODO: Route to Panel 3 subpage
        }}
      />
      <PanelCard
        className="bg-blue-500 col-span-2 sm:col-span-1"
        imageSrc="https://via.placeholder.com/200x133?text=Panel+4"
        label="Panel 4"
        onClick={() => {
          console.log("Panel 4 clicked");
          // TODO: Route to Panel 4 subpage
        }}
      />
      <PanelCard
        className="bg-blue-400 col-span-4 sm:col-span-1"
        imageSrc="https://via.placeholder.com/400x267?text=Panel+5"
        label="Panel 5"
        onClick={() => {
          console.log("Panel 5 clicked");
          // TODO: Route to Panel 5 subpage
        }}
      />
    </div>
  );
}
