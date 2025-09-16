import Panel from "../components/Panel";
import PanelLabel from "../components/PanelLabel";
import IssueCarousel from "../components/IssueCarousel";
import content from "../../content/read.json";

export default function Read() {
  const {
    panel,
    hero: { heading, subtitle },
    issues = [],
  } = content;

  return (
    <Panel id={panel.main.name} centerChildren={false}>
      <div className="flex flex-col items-center w-full">
        <PanelLabel
          id={panel.main.name}
          as="h1"
          className={`${heading.className} ${heading.size} mb-2 text-center`}
        >
          {heading.text}
        </PanelLabel>
        {subtitle?.text && (
          <p className={`${subtitle.className} ${subtitle.size}`}>
            {subtitle.text}
          </p>
        )}
        {issues.length > 0 && <IssueCarousel issues={issues} />}
      </div>
    </Panel>
  );
}
