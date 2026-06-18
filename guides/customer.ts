import type { GuideDefinition } from "./types";

export const customerGuide: GuideDefinition = {
  id: "customer",
  title: "Dodajanje kupca",
  description: "Poišči podjetje v eImeniku in ga shrani v šifrant.",
  route: "/customers/new",
  steps: [
    {
      element: "[data-tour='customer-header']",
      popover: {
        title: "Nova stranka",
        description: "Kupca poiščeš v bizBox eImeniku in ga nato shraniš za hitrejše izdajanje računov.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='customer-search']",
      popover: {
        title: "Išči po nazivu ali davčni",
        description: "Vpiši vsaj tri znake naziva ali polno davčno številko s kodo države, na primer SI12345678.",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='customer-search-button']",
      popover: {
        title: "Preveri eImenik",
        description: "Izberi predlog ali klikni Išči. Ko se pokaže rezultat, ga lahko shraniš v šifrant ali med priljubljene.",
        side: "left",
      },
    },
  ],
};
