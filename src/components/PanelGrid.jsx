import PanelCard from "./PanelCard";
import { getPreviousPathname } from "../utils/navigation";
import read from "../../content/read.json";
import buy from "../../content/buy.json";
import meet from "../../content/meet.json";
import connect from "../../content/connect.json";
 
const placeholderImage = "/uploads/placeholder.png";

const panels = [
  {
    label: read.panel?.main?.name || "READ",
    to: "/read",
    image: read.panel?.image || placeholderImage,
  },
  {
    label: buy.panel?.main?.name || "BUY",
    to: "/buy",
    image: buy.panel?.image || placeholderImage,
  },
  {
    label: meet.panel?.main?.name || "MEET",
    to: "/meet",
    image: meet.panel?.image || placeholderImage,
  },
  {
    label: connect.panel?.main?.name || "CONNECT",
    to: "/connect",
    image: connect.panel?.image || placeholderImage,
  },
];

const TRANSFORM_DURATION = 0.4;

export default function PanelGrid() {
  const prevPath = getPreviousPathname();
  const fromPanel = prevPath && prevPath !== "/" ? prevPath.slice(1).toUpperCase() : null;

  return (
    <div className="h-full flex flex-col px-6 pt-10 pb-6">
      <div className="flex-1 grid w-full grid-cols-2 grid-rows-2 gap-4">
        {panels.map((panel) => {
          const isTransforming =
            fromPanel && panel.label.toUpperCase() === fromPanel;
          const fadeProps =
            fromPanel && panel.label.toUpperCase() !== fromPanel
              ? {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { delay: TRANSFORM_DURATION, duration: 0.4 },
                }
              : {};

          return (
            <PanelCard
              key={panel.label}
              className="w-full h-full"
              imageSrc={panel.image}
              label={panel.label}
              to={panel.to}
              isTransforming={isTransforming}
              fadeDelay={TRANSFORM_DURATION}
              {...fadeProps}
            />
          );
        })}
      </div>
    </div>
  );
}
