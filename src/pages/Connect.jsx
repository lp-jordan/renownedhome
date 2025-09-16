import { useEffect } from "react";
import Panel from "../components/Panel";
import PanelLabel from "../components/PanelLabel";
import content from "../../content/connect.json";

export default function Connect() {
  const {
    panel,
    hero: { heading, subtitle },
    icons = [],
  } = content;

  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://js.supascribe.com/v1/loader/UYDe8qNPyae2C6ieNTAhY74Cmw82.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <Panel id={panel.main.name}>
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
        <div
          data-supascribe-embed-id="478951807419"
          data-supascribe-subscribe=""
          className="mt-4"
        ></div>
        {icons.length > 0 && (
          <div className="flex gap-4 mt-8">
            {icons.map((icon) => (
              <a
                key={icon.id}
                href={icon.link || "#"}
                className="w-24 h-24 rounded-full overflow-hidden transition-transform duration-200 hover:scale-105"
              >
                <img
                  src={icon.image}
                  alt={`icon-${icon.id}`}
                  className="w-full h-full object-cover rounded-full"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
