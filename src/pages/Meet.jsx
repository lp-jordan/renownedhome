import Panel from "../components/Panel";
import PanelLabel from "../components/PanelLabel";
import BioCarousel from "../components/BioCarousel";
import content from "../../content/meet.json";

export default function Meet() {
  const {
    panel,
    hero: { heading, subtitle },
    bios = [],
  } = content;

  return (
    <Panel id={panel.main.name} centerChildren={false}>
      <div className="flex flex-col items-center">
        <PanelLabel
          id={panel.main.name}
          as="h1"
          className={`${heading.className} ${heading.size} mb-2`}
        >
          {heading.text}
        </PanelLabel>
        {subtitle?.text && (
          <p className={`${subtitle.className} ${subtitle.size}`}>
            {subtitle.text}
          </p>
        )}
      </div>
      {bios.length > 0 && <BioCarousel bios={bios} />}
    </Panel>
  );
}
