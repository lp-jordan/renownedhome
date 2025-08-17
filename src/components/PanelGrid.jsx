import PanelCard from "./PanelCard";
const readImg = "/panels/read.jpg";
const buyImg = "/panels/buy.jpg";
const worldImg = "/panels/world.jpg";
const meetImg = "/panels/meet.jpg";
const reachImg = "/panels/reach.jpg";

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
      <div className="grid h-full grid-cols-3 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={meetImg || undefined}
          label="MEET"
          to="/meet"
        />
        <PanelCard
          className="bg-white h-full"
          imageSrc={reachImg || undefined}
          label="REACH"
          to="/reach"
        />
        <div
          className="relative w-full h-full border bg-white flex items-center justify-center"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="font-bold text-black uppercase text-center text-[clamp(2rem,5vw,6rem)]">
            WELCOME
          </span>
        </div>
      </div>
    </div>
  );
}
