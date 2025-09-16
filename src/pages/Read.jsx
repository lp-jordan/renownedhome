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
      <div className="flex h-full w-full flex-col">
        <div className="flex flex-col items-center text-center shrink-0">
          <PanelLabel
            id={panel.main.name}
            as="h1"
            className={`${heading.className} ${heading.size} mb-1 text-center`}
          >
            {heading.text}
          </PanelLabel>
          {subtitle?.text && (
            <p className={`${subtitle.className} ${subtitle.size}`}>
              {subtitle.text}
            </p>
          )}
        </div>
        {issues.length > 0 && (
          <section
            aria-label="Issue catalog"
            className="mt-6 w-full flex-1 overflow-y-auto min-h-0"
            role="region"
            tabIndex={0}
          >
            <IssueCarousel issues={issues} />
          </section>
        )}
      </div>
    </Panel>
  );
}
