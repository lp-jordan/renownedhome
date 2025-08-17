import PanelCard from "./PanelCard";
const readImg = "/panels/read.jpg";
const buyImg = "/panels/buy.jpg";
const worldImg = "/panels/world.jpg";
const meetImg = "/panels/meet.jpg";
const contactImg = "/panels/contact.jpg";

export default function PanelGrid() {
  return (
    <div className="grid grid-rows-3 gap-4 w-full h-full">
      <div className="grid h-full grid-cols-1 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={worldImg || undefined}
          label="EXPLORE"
          to="/world"
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
          imageSrc={readImg || undefined}
          label="READ"
          to="/read"
        />
      </div>
      <div className="grid h-full grid-cols-2 gap-4">
          <PanelCard
            className="bg-white h-full"
            imageSrc={meetImg || undefined}
            label="MEET"
            to="/meet"
          />
        <PanelCard
          className="bg-white h-full"
          imageSrc={contactImg || undefined}
          label="REACH"
          to="/contact"
        />
      </div>
    </div>
  );
}
