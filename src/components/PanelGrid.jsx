import PanelCard from "./PanelCard";
import { getPreviousPathname } from "../utils/navigation";
import read from "../../content/read.json";
import buy from "../../content/buy.json";
import meet from "../../content/meet.json";
import connect from "../../content/connect.json";

const panels = [
  {
    label: "READ",
    to: "/read",
    image: read.panel?.image,
  },
  {
    label: "BUY",
    to: "/buy",
    image: buy.panel?.image,
  },
  {
    label: "MEET",
    to: "/meet",
    image: meet.panel?.image,
  },
  {
    label: "CONNECT",
    to: "/connect",
    image: connect.panel?.image,
  },
];

export default function PanelGrid() {
  const prevPath = getPreviousPathname();
  const fromPanel = prevPath && prevPath !== "/" ? prevPath.slice(1).toUpperCase() : null;

  return (
    <div className="h-full flex flex-col px-6 pt-10 pb-6">
      <div className="flex-1 grid w-full grid-cols-2 grid-rows-2 gap-4">
        {panels.map((panel) => {
          const fadeProps =
            fromPanel && panel.label !== fromPanel
              ? {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { duration: 0.4 },
                }
              : {};

          return (
            <PanelCard
              key={panel.label}
              className="w-full h-full"
              imageSrc={panel.image}
              label={panel.label}
              to={panel.to}
              {...fadeProps}
            />
          );
        })}
      </div>
    </div>
  );
}
