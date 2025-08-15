import PanelCard from "./PanelCard";

export default function PanelGrid() {
  return (
    <div className="grid grid-rows-3 gap-4 w-full h-full">
      <div className="grid h-full grid-cols-1 gap-4">
        <PanelCard
          imageSrc="https://via.placeholder.com/600x300?text=Read"
          label="READ"
          to="/read"
        />
      </div>
      <div className="grid h-full grid-cols-2 gap-4">
        <PanelCard
          imageSrc="https://via.placeholder.com/300x200?text=Buy"
          label="BUY"
          to="/buy"
        />
        <PanelCard
          imageSrc="https://via.placeholder.com/300x200?text=World"
          label="WORLD"
          to="/world"
        />
      </div>
      <div className="grid h-full grid-cols-3 gap-4">
        <PanelCard
          className="col-span-1"
          imageSrc="https://via.placeholder.com/200x133?text=Team"
          label="TEAM"
          to="/team"
        />
        <PanelCard
          className="col-span-2"
          imageSrc="https://via.placeholder.com/400x267?text=Contact"
          label="CONTACT"
          to="/contact"
        />
      </div>
    </div>
  );
}
