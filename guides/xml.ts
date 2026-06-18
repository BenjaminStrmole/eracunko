import type { GuideDefinition } from "./types";

export const xmlGuide: GuideDefinition = {
  id: "xml",
  title: "Preverjanje eSLOG XML",
  description: "Razumi validacijo, predogled in oddajo XML-ja.",
  route: "/invoices/xml",
  steps: [
    {
      element: "[data-tour='xml-header']",
      popover: {
        title: "eSLOG XML pregled",
        description: "Tu vidiš XML, ki ga bo eRačunko poslal v bizBox, skupaj z rezultatom eSLOG validacije.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='xml-validation']",
      popover: {
        title: "Najprej odpravi napake",
        description: "Rdeče napake blokirajo pošiljanje. Rumena opozorila preveri, vendar niso vedno blokirna.",
        side: "right",
      },
    },
    {
      element: "[data-tour='xml-preview']",
      popover: {
        title: "Preglej generirani XML",
        description: "Pred oddajo lahko preveriš ključne segmente, partnerje, postavke, DDV in zneske.",
        side: "top",
      },
    },
    {
      element: "[data-tour='xml-actions']",
      popover: {
        title: "Prenos ali pošiljanje",
        description: "XML lahko preneseš ali ga po uspešni validaciji pošlješ neposredno v bizBox DEMO.",
        side: "top",
        align: "end",
      },
    },
  ],
};
