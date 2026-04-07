export const defaultSiteData = {
  users: [],
  siteSettings: {
    brandName: "Renowned",
    siteTitleSuffix: "Renowned",
    footer: {
      copyright: "© 2026 Storyhat. All rights reserved.",
      email: "renownedcomicbook@gmail.com",
    },
    defaultOgImage:
      "https://renownedcomic.com/wp-content/uploads/2025/09/logowhite_nodrop-small.png",
    nav: [
      { label: "Read", href: "/read" },
      { label: "Buy", href: "/buy" },
      { label: "Connect", href: "/connect" },
      { label: "Meet", href: "/meet" },
      { label: "Letters", href: "/letters" },
    ],
    homeSplash: {
      enabled: true,
      logoUrl:
        "https://renownedcomic.com/wp-content/uploads/2025/09/Jordan-Storyhat-25-Hat-invertedsmall.png",
      subtitle: "Just Good Story",
    },
    announcement: {
      enabled: false,
      label: "Issue #2 Kickstarter Live Now",
      ctaLabel: "Back The Book!",
      ctaUrl:
        "https://www.kickstarter.com/projects/jmintonjohnson/renowned-2-supernatural-detective-series",
    },
  },
  pages: [
    {
      id: "page-home",
      slug: "/",
      title: "Home",
      status: "published",
      pageType: "standard",
      seo: {
        title: "Renowned - Home",
        description:
          "A supernatural detective mystery set in 1920s Denver.",
        canonicalUrl: "https://renownedcomic.com/",
        noindex: false,
        ogImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/logowhite_nodrop-small.png",
      },
      hero: {
        title: "Renowned",
        subtitle: "A supernatural detective mystery set in 1920s Denver",
        backgroundImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/world.jpg",
        titleImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/logowhite_nodrop-small.png",
      },
      content: {
        panels: [
          {
            label: "Read",
            href: "/read",
            image:
              "https://renownedcomic.com/wp-content/uploads/2025/09/read.jpg",
            size: "wide",
          },
          {
            label: "Buy",
            href: "/buy",
            image:
              "https://renownedcomic.com/wp-content/uploads/2025/09/buy.jpg",
            size: "standard",
          },
          {
            label: "Connect",
            href: "/connect",
            image:
              "https://renownedcomic.com/wp-content/uploads/2025/09/team.jpg",
            size: "standard",
          },
          {
            label: "Meet",
            href: "/meet",
            image:
              "https://renownedcomic.com/wp-content/uploads/2025/09/contact.jpg",
            size: "wide-half",
          },
        ],
        testimonials: [],
      },
    },
    {
      id: "page-buy",
      slug: "/buy",
      title: "Buy",
      status: "published",
      pageType: "standard",
      seo: {
        title: "Renowned - Buy",
        description: "Follow the campaign and shop the Renowned series.",
        canonicalUrl: "https://renownedcomic.com/buy",
        noindex: false,
        ogImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/buy1.png",
      },
      hero: {
        title: "BUY",
        subtitle:
          "Pick an issue. Choose digital or physical.",
        backgroundImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/buy1.png",
        ctaLabel: "Follow Campaign",
        ctaUrl:
          "https://www.kickstarter.com/projects/jmintonjohnson/renowned-2-supernatural-detective-series",
      },
      content: {
        heading: "Shop the Series",
        footerNote: "Digital and physical checkout links can be added per issue as they go live.",
      },
    },
    {
      id: "page-connect",
      slug: "/connect",
      title: "Connect",
      status: "published",
      pageType: "standard",
      seo: {
        title: "Renowned - Connect",
        description:
          "Find the team on socials or subscribe to The Headlines.",
        canonicalUrl: "https://renownedcomic.com/connect",
        noindex: false,
        ogImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/team.jpg",
      },
      hero: {
        title: "CONNECT",
        subtitle: "Find the team on socials or join The Headlines.",
        backgroundImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/team.jpg",
        ctaLabel: "Go to The Headlines",
        ctaUrl: "#headlines",
      },
      content: {
        socialsHeading: "Socials",
        newsletterHeading: "The Headlines",
        newsletterSubtitle:
          "A semi-sometimes newsletter about Renowned, writing, comic craft, and the overall creative collaborative process.",
        newsletterCardEyebrow: "The Headlines",
        newsletterCardTitle: "Subscribe on Substack",
        newsletterCtaLabel: "Read The Headlines",
        newsletterCtaUrl: "https://substack.com",
        feedHeading: "Latest from The Headlines",
        feedItems: [
          "A new update from the studio will appear here once your newsletter feed is wired in.",
        ],
      },
    },
    {
      id: "page-meet",
      slug: "/meet",
      title: "Meet",
      status: "published",
      pageType: "standard",
      seo: {
        title: "Renowned - Meet",
        description: "Meet the creative team behind the book.",
        canonicalUrl: "https://renownedcomic.com/meet",
        noindex: false,
        ogImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/contact.jpg",
      },
      hero: {
        title: "MEET",
        subtitle: "Meet the creative team behind the book.",
        backgroundImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/contact.jpg",
      },
      content: {
        heading: "Creative Team",
      },
    },
    {
      id: "page-read",
      slug: "/read",
      title: "Read",
      status: "published",
      pageType: "collection",
      seo: {
        title: "Renowned - Read",
        description:
          "Preview upcoming issues and the one-shot set in the world of Renowned.",
        canonicalUrl: "https://renownedcomic.com/read",
        noindex: false,
        ogImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/read.jpg",
      },
      hero: {
        title: "READ",
        subtitle: "Preview upcoming issues!",
        backgroundImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/read.jpg",
      },
      content: {
        heading: "The Story",
        intro:
          "Renowned is a supernatural detective mystery set in 1920s America, following legendary detective and beloved author Abraham Bone as he navigates the strange, the unknown, and the impossible.",
      },
    },
    {
      id: "page-letters",
      slug: "/letters",
      title: "Letters",
      status: "published",
      pageType: "letters",
      seo: {
        title: "Renowned - Letters",
        description:
          "Thoughts, questions, reactions, and responses from readers.",
        canonicalUrl: "https://renownedcomic.com/letters",
        noindex: false,
        ogImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/world.jpg",
      },
      hero: {
        title: "Letters",
        kicker: "Renowned Correspondence",
        subtitle:
          "Thoughts, questions, reactions, and responses from readers.",
        intro:
          "This is not a review wall. It's an ongoing conversation about the books, the story, and whatever stayed with you after the last page.",
        backgroundImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/world.jpg",
      },
      content: {
        noteHeading: "A Running Conversation",
        noteCopy:
          "If you've got a question, a reaction, a theory, or just something the book made you feel, leave a letter. Selected submissions will appear below as part of the public conversation.",
        submitHeading: "Leave a Letter",
        submitKicker: "Write In",
        submitLede:
          "Keep it honest. Keep it specific. A few sentences is fine. A few paragraphs is fine too.",
        submitSmallprint:
          "Not every submission will be published. The public section below is curated so the page stays readable, thoughtful, and free of junk.",
        featuredHeading: "Featured Letters",
        featuredKicker: "Selected Correspondence",
        archiveHeading: "Recent Letters",
        archiveKicker: "The Ongoing Conversation",
      },
    },
  ],
  issues: [
    {
      id: "issue-one-shot",
      slug: "/one-shot",
      title: "3:10 to Nowhere",
      shortLabel: "3:10 to Nowhere",
      type: "one-shot",
      status: "published",
      sortOrder: 1,
      seo: {
        title: "3:10 to Nowhere - Storyhat Comics",
        description:
          "A one-shot supernatural mystery featuring Abraham Bone in 1923.",
        canonicalUrl: "https://renownedcomic.com/one-shot",
        noindex: false,
        ogImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/oneshotcover.png",
      },
      coverImage:
        "https://renownedcomic.com/wp-content/uploads/2025/09/oneshotcover.png",
      featuredImage:
        "https://renownedcomic.com/wp-content/uploads/2025/09/oneshotcover.png",
      previewLabel: "PREVIEW",
      previewUrl: "https://bindings.app/read/LuIWDiMt",
      readerLabel: "Read preview",
      readerPdfUrl: "",
      releaseDate: "September 2024",
      writer: "Jordan Johnson",
      artist: "Azrael Aguiar",
      colorist: "Maja Opacic",
      description:
        "IN 1923, TIME STOOD STILL.\n\nWorld-famous author and supernatural detective Abraham Bone has spent a lifetime unraveling impossible mysteries. Now, it's time to step away from it all.\n\nBut while waiting at a desolate train station in middle-of-nowhere Colorado, Bone and a group of strangers all bound for Denver find themselves in an unsettling limbo; the train isn't coming, the clocks aren't ticking, and the snow isn't falling... they're stuck.\n\nAs the temperature drops and threats close in, Bone must investigate the strange circumstances that have them trapped, and contend with each of his fellow travelers who, for better or worse, know he's likely their only hope.\n\nBut time waits for no man... especially in a race to restart the clock.",
      heroAssets: [
        "https://renownedcomic.com/wp-content/uploads/2025/09/walking.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/train.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/station.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/horse.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/convo1.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/blam1.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/bronco.png",
      ],
      readerImages: [],
    },
    {
      id: "issue-1",
      slug: "/issue-1",
      title: "Issue 1",
      shortLabel: "Chapter 1",
      type: "issue",
      status: "published",
      sortOrder: 2,
      seo: {
        title: "Issue 1 - Storyhat Comics",
        description:
          "Abraham Bone arrives in Denver and steps into one of the defining cases of his career.",
        canonicalUrl: "https://renownedcomic.com/issue-1",
        noindex: false,
        ogImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/1cover.png",
      },
      coverImage:
        "https://renownedcomic.com/wp-content/uploads/2025/09/1cover.png",
      featuredImage:
        "https://renownedcomic.com/wp-content/uploads/2025/09/1cover.png",
      previewLabel: "FOLLOW",
      previewUrl:
        "https://www.kickstarter.com/projects/jmintonjohnson/renowned-2-supernatural-detective-series",
      readerLabel: "Read preview",
      readerPdfUrl: "",
      releaseDate: "June 2025",
      writer: "Jordan Johnson",
      artist: "Azrael Aguiar",
      colorist: "Maja Opacic",
      description:
        "Denver. 1923. Abraham Bone arrives in town for a gala to be thrown in his honor and finds himself the focus of both peers and strangers alike.\n\nRenowned issue #1 sets in motion one of the most important cases of the legendary detective's career that will take him from underground speakeasies to Rocky Mountain mining camps.\n\nIn a town that's seen just as much growth and change as he has, Bone must face the twilight of his career, an elusive killer, and something much scarier... a family looking to him for protection.",
      heroAssets: [
        "https://renownedcomic.com/wp-content/uploads/2025/09/knock.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/speakeasy.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/car.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/gatling.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/eyes.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/people.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/family.png",
      ],
      readerImages: [],
    },
    {
      id: "issue-2",
      slug: "/issue-2",
      title: "Issue 2",
      shortLabel: "Chapter 2",
      type: "issue",
      status: "published",
      sortOrder: 3,
      seo: {
        title: "Issue 2 - Storyhat Comics",
        description:
          "Bone follows the trail into Denver's Five Points and deeper into the mystery.",
        canonicalUrl: "https://renownedcomic.com/issue-2",
        noindex: false,
        ogImage:
          "https://renownedcomic.com/wp-content/uploads/2025/09/read.jpg",
      },
      coverImage:
        "https://renownedcomic.com/wp-content/uploads/2025/09/read.jpg",
      featuredImage:
        "https://renownedcomic.com/wp-content/uploads/2025/09/read.jpg",
      previewLabel: "SUPPORT",
      previewUrl:
        "https://www.kickstarter.com/projects/jmintonjohnson/renowned-2-supernatural-detective-series",
      readerLabel: "Read preview",
      readerPdfUrl: "",
      releaseDate: "December 2025",
      writer: "Jordan Johnson",
      artist: "Azrael Aguiar",
      colorist: "Maja Opacic",
      description:
        "Thomas Harding is dead. A tragedy that might have quietly faded instead pulls Bone deeper into the mystery and into the headlines, as the press seizes on the return of the famed detective.\n\nFollowing the trail to a neighborhood drugstore in Denver's Five Points, Bone discovers something even more startling than a lead: someone's beaten him to the punch...\n\nFollow the Kickstarter campaign and back Issue #2 now!",
      heroAssets: [
        "https://renownedcomic.com/wp-content/uploads/2025/09/world.jpg",
        "https://renownedcomic.com/wp-content/uploads/2025/09/read.jpg",
        "https://renownedcomic.com/wp-content/uploads/2025/09/buy.jpg",
        "https://renownedcomic.com/wp-content/uploads/2025/09/contact.jpg",
        "https://renownedcomic.com/wp-content/uploads/2025/09/team.jpg",
        "https://renownedcomic.com/wp-content/uploads/2025/09/1cover.png",
        "https://renownedcomic.com/wp-content/uploads/2025/09/oneshotcover.png",
      ],
      readerImages: [],
    },
    {
      id: "issue-3",
      slug: "/issue-3",
      title: "Issue 3",
      shortLabel: "Chapter 3",
      type: "issue",
      status: "draft",
      sortOrder: 4,
      seo: {
        title: "Issue 3 - Storyhat Comics",
        description: "Upcoming issue.",
        canonicalUrl: "https://renownedcomic.com/issue-3",
        noindex: true,
        ogImage: "",
      },
      coverImage: "",
      featuredImage: "",
      previewLabel: "Coming Soon",
      previewUrl: "",
      readerLabel: "Read preview",
      readerPdfUrl: "",
      releaseDate: "",
      writer: "Jordan Johnson",
      artist: "Azrael Aguiar",
      colorist: "Maja Opacic",
      description: "Issue #3 will follow the same story-page structure.",
      heroAssets: [],
      readerImages: [],
    },
  ],
  teamMembers: [
    {
      id: "team-jordan",
      name: "Jordan Johnson",
      role: "Writer / Creator",
      image:
        "https://renownedcomic.com/wp-content/uploads/2025/09/jordan.png",
      bio: "Jordan is a writer and filmmaker based in Duluth, GA, and the creator of the supernatural detective series Renowned. He's also directed two short films, including 2021's Blue Country. He's married to his best friend. They have two boys and a cat.",
      sortOrder: 1,
    },
    {
      id: "team-azrael",
      name: "Azrael Aguiar",
      role: "Artist",
      image:
        "https://renownedcomic.com/wp-content/uploads/2025/09/azreal2.png",
      bio: "Azrael is an independent illustrator and comic artist who's been working in the industry since 2017. Graduating in Comics from Quanta Academia de Arte in 2019, he's worked on the Periferia Cyberpunk anthology as well as the VHS Horror anthology. His current work includes projects with Mamakooosa Comics, Stroud Production Company, The Return of Camazotz, and Mauriax.",
      sortOrder: 2,
    },
    {
      id: "team-maja",
      name: "Maja Opacic",
      role: "Colorist",
      image: "https://renownedcomic.com/wp-content/uploads/2025/09/maja.jpg",
      bio: "Maja (pronounced Maya) received formal training at the Academy of Arts and Conservation in Belgrade. With a background in traditional art, she has returned to her passion for comics, working as a comic book colorist on various projects, including A Haunting on Mars and the comic adaptation of Primitive War.",
      sortOrder: 3,
    },
  ],
  socialLinks: [
    {
      id: "social-jordan-instagram",
      personName: "Jordan Johnson",
      label: "Instagram",
      url: "https://www.instagram.com/renownedcomic/",
      iconUrl:
        "https://renownedcomic.com/wp-content/uploads/2025/09/Instagram_icon-1.png",
      sortOrder: 1,
    },
    {
      id: "social-jordan-youtube",
      personName: "Jordan Johnson",
      label: "YouTube",
      url: "https://www.youtube.com/@jmintonjohnson",
      iconUrl:
        "https://renownedcomic.com/wp-content/uploads/2025/09/youtube.png",
      sortOrder: 2,
    },
    {
      id: "social-azrael-instagram",
      personName: "Azrael Aguiar",
      label: "Instagram",
      url: "https://www.instagram.com/azrael.maxim/",
      iconUrl:
        "https://renownedcomic.com/wp-content/uploads/2025/09/Instagram_icon-1.png",
      sortOrder: 3,
    },
    {
      id: "social-azrael-patreon",
      personName: "Azrael Aguiar",
      label: "Patreon",
      url: "https://www.patreon.com/AzraelMaxim",
      iconUrl:
        "https://renownedcomic.com/wp-content/uploads/2025/09/patreon.png",
      sortOrder: 4,
    },
    {
      id: "social-maja-instagram",
      personName: "Maja Opacic",
      label: "Instagram",
      url: "https://www.instagram.com/maja_colorist/",
      iconUrl:
        "https://renownedcomic.com/wp-content/uploads/2025/09/Instagram_icon-1.png",
      sortOrder: 5,
    },
    {
      id: "social-maja-website",
      personName: "Maja Opacic",
      label: "Website",
      url: "https://majaopacic.com/comic-coloring",
      iconUrl: "https://renownedcomic.com/wp-content/uploads/2025/09/web.jpg",
      sortOrder: 6,
    },
  ],
  redirects: [
    {
      id: "redirect-go",
      sourcePath: "/go",
      destination:
        "https://www.kickstarter.com/projects/jmintonjohnson/renowned-2-supernatural-detective-series",
      type: "302",
      active: true,
    },
    {
      id: "redirect-one-shot-alias",
      sourcePath: "/3-10-to-nowhere",
      destination: "/one-shot",
      type: "301",
      active: true,
    },
    {
      id: "redirect-issue1-legacy",
      sourcePath: "/issue1",
      destination: "/issue-1",
      type: "301",
      active: true,
    },
    {
      id: "redirect-issue2-legacy",
      sourcePath: "/issue2",
      destination: "/issue-2",
      type: "301",
      active: true,
    },
    {
      id: "redirect-one-shot-legacy",
      sourcePath: "/one-shot/",
      destination: "/one-shot",
      type: "301",
      active: true,
    },
  ],
  lettersSubmissions: [],
  assets: [],
};

export function cloneDefaultSiteData() {
  return JSON.parse(JSON.stringify(defaultSiteData));
}
