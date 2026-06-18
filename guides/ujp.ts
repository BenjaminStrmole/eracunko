import type { GuideDefinition } from "./types";

export const ujpGuide: GuideDefinition = {
  id: "ujp",
  title: "Pošiljanje računa na UJP",
  description: "Pravilna izbira profila, prejemnika in referenc.",
  route: "/invoices/new",
  mode: "field-wizard",
  flow: "ujp",
  steps: [
    {
      element: "[data-tour='profile-ujp']",
      popover: {
        title: "Izberi profil UJP",
        description: "Klikni UJP. Obstoječi podatki računa ostanejo ohranjeni, dodajo pa se UJP-specifična polja.",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='invoice-buyer']",
      popover: {
        title: "Preveri UJP prejemnika",
        description: "Izberi javnega prejemnika iz šifranta in preveri davčno številko ter eLokacijo.",
        side: "right",
      },
    },
    {
      element: "[data-tour='invoice-stepper']",
      popover: {
        title: "Reference so v koraku Račun",
        description: "V drugem koraku vnesi vsaj eno veljavno referenco: pogodbo, naročilnico ali dobavnico.",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='invoice-next']",
      popover: {
        title: "Validacija pred oddajo",
        description: "Nadaljuj do pregleda. UJP profil bo blokiral pripravo XML-ja, če zahtevana referenca manjka.",
        side: "top",
      },
    },
  ],
};
