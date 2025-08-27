import PanelCard from "./PanelCard";
import useSupabaseHomePanels from "../hooks/useSupabaseHomePanels";

export default function PanelGrid() {
  const { panels } = useSupabaseHomePanels();
  const images = {
    EXPLORE:
      typeof panels["EXPLORE"]?.image === "string"
        ? panels["EXPLORE"].image
        : "/panels/world.jpg",
    BUY:
      typeof panels["BUY"]?.image === "string"
        ? panels["BUY"].image
        : "/panels/buy.jpg",
    READ:
      typeof panels["READ"]?.image === "string"
        ? panels["READ"].image
        : "/panels/read.jpg",
    MEET:
      typeof panels["MEET"]?.image === "string"
        ? panels["MEET"].image
        : "/panels/meet.jpg",
    CONNECT:
      typeof panels["CONNECT"]?.image === "string"
        ? panels["CONNECT"].image
        : "/panels/connect.jpg",
  };
  return (
    <div className="relative grid grid-rows-3 gap-4 w-full h-full">
      <div className="grid h-full grid-cols-1 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={images.EXPLORE || undefined}
          label="EXPLORE"
          to="/world"
        />
      </div>
      <div className="grid h-full grid-cols-2 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={images.BUY || undefined}
          label="BUY"
          to="/buy"
        />
        <PanelCard
          className="bg-white h-full"
          imageSrc={images.READ || undefined}
          label="READ"
          to="/read"
        />
      </div>
      <div className="grid h-full grid-cols-2 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={images.MEET || undefined}
          label="MEET"
          to="/meet"
        />
        <PanelCard
          className="bg-white h-full"
          imageSrc={images.CONNECT || undefined}
          label="CONNECT"
          to="/connect"
        />
      </div>
    </div>
  );
}
