import PanelCard from "./PanelCard";

import readImg from "../assets/panels/read.jpg";
import buyImg from "../assets/panels/buy.jpg";
import worldImg from "../assets/panels/world.jpg";
import teamImg from "../assets/panels/team.jpg";
import contactImg from "../assets/panels/contact.jpg";

export default function PanelGrid() {
  return (
    <div className="grid grid-rows-3 gap-4 w-full h-full">
      <div className="grid h-full grid-cols-1 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={readImg}
          label="READ"
          to="/read"
        />
      </div>
      <div className="grid h-full grid-cols-2 gap-4">
        <PanelCard
          className="bg-white h-full"
          imageSrc={buyImg}
          label="BUY"
          to="/buy"
        />
        <PanelCard
          className="bg-white h-full"
          imageSrc={worldImg}
          label="WORLD"
          to="/world"
        />
      </div>
      <div className="grid h-full grid-cols-3 gap-4">
        <PanelCard
          className="bg-white h-full col-span-1"
          imageSrc={teamImg}
          label="TEAM"
          to="/team"
        />
        <PanelCard
          className="bg-white h-full col-span-2"
          imageSrc={contactImg}
          label="CONTACT"
          to="/contact"
        />
      </div>
    </div>
  );
