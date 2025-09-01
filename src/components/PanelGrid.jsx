import PanelCard from "./PanelCard";
import { getPreviousPathname } from "../utils/navigation";

const panels = [
  {
    label: "READ",
    to: "/read",
    image: "https://source.unsplash.com/random/800x1200?sig=1",
  },
  {
    label: "BUY",
    to: "/buy",
    image: "https://source.unsplash.com/random/800x1200?sig=2",
  },
  {
    label: "MEET",
    to: "/meet",
    image: "https://source.unsplash.com/random/800x1200?sig=3",
  },
  {
    label: "CONNECT",
    to: "/connect",
    image: "https://source.unsplash.com/random/800x1200?sig=4",
  },
];

export default function PanelGrid() {
  const prevPath = getPreviousPathname();
  const fromPanel = prevPath && prevPath !== "/" ? prevPath.slice(1).toUpperCase() : null;

  return (
    <div className="grid w-full h-full grid-cols-2 grid-rows-2 gap-4">
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
  );
}
