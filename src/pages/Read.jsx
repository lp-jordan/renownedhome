import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PanelContent from "../components/PanelContent";
import IssueCarousel from "../components/IssueCarousel";
import IssueInfoPanel from "../components/IssueInfoPanel";
import heroImage from "../assets/read/hero.jpg";

const issues = [
  {
    id: 1,
    cover: "https://via.placeholder.com/400x600?text=Issue+1",
    title: "Issue 1",
    subtitle: "The Beginning",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.",
    credits: "Written by The Team",
    link: "#",
  },
  {
    id: 2,
    cover: "https://via.placeholder.com/400x600?text=Issue+2",
    title: "Issue 2",
    subtitle: "The Sequel",
    description:
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.",
    credits: "Written by The Team",
    link: "#",
  },
  {
    id: 3,
    cover: "https://via.placeholder.com/400x600?text=Issue+3",
    title: "Issue 3",
    subtitle: "The Finale",
    description:
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
    credits: "Written by The Team",
    link: "#",
  },
];

export default function Read() {
  const [selectedIssue, setSelectedIssue] = useState(null);

  const handleSelect = (issue) => {
    setSelectedIssue((prev) => (prev?.id === issue.id ? null : issue));
  };

  return (
    <PanelContent>
      {/* Hero Section */}
      <motion.section
        layoutId="READ"
        className="relative w-full h-[75vh] md:h-screen"
      >
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
        <div className="relative flex flex-col items-center justify-center w-full h-full p-4 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-bold uppercase">Read</h1>
          <p className="mt-4 text-lg md:text-2xl max-w-xl">
            Explore the latest issue of Renowned Home.
          </p>
          <a
            href="https://flipbook.example.com/full-issue"
            className="mt-8 px-6 py-3 text-base font-semibold bg-blue-600 hover:bg-blue-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read Now
          </a>
        </div>
      </motion.section>

      {/* Carousel + Info Section */}
      <div className="flex flex-col items-center justify-center w-full px-4 py-12 space-y-8">
        <IssueCarousel />
        <div className="flex w-full gap-4 overflow-x-auto pb-4 justify-center">
          {issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => handleSelect(issue)}
              className="flex-shrink-0 focus:outline-none"
            >
              <img
                src={issue.cover}
                alt={issue.title}
                className={`h-40 w-28 object-cover border rounded ${
                  selectedIssue?.id === issue.id
                    ? "border-blue-500"
                    : "border-transparent"
                }`}
              />
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {selectedIssue && (
            <IssueInfoPanel issue={selectedIssue} key={selectedIssue.id} />
          )}
        </AnimatePresence>
      </div>
    </PanelContent>
  );
}
