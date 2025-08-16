import PanelCard from "./PanelCard";
const readImg = "/panels/read.png";
const buyImg = "/panels/buy.png";
const worldImg = "/panels/world.png";
const teamImg = "/panels/team.png";
const contactImg = "/panels/contact.png";

export default function PanelGrid() {
  return (
    <div className="grid grid-rows-3 gap-4 w-full h-full">
      <div className="grid h-full grid-cols-1 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={readImg || undefined}
          label="READ"
          to="/read"
        />
      </div>
      <div className="grid h-full grid-cols-2 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={buyImg || undefined}
          label="BUY"
          to="/buy"
        />
        <PanelCard
          className="bg-white h-full"
          imageSrc={worldImg || undefined}
          label="WORLD"
          to="/world"
        />
      </div>
      <div className="grid h-full grid-cols-2 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={teamImg || undefined}
          label="TEAM"
          to="/team"
        />
        <PanelCard
          className="bg-white h-full"
          imageSrc={contactImg || undefined}
          label="CONTACT"
          to="/contact"
        />
      </div>
    </div>
  );
}
