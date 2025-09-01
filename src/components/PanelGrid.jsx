import PanelCard from "./PanelCard";

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
  return (
    <div className="flex w-full h-full gap-4">
      {panels.map((panel) => (
        <PanelCard
          key={panel.label}
          className="flex-1 h-full"
          imageSrc={panel.image}
          label={panel.label}
          to={panel.to}
        />
      ))}
    </div>
  );
}
