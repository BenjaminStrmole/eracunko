import type { GuideDefinition } from "./types";

export const invoiceGuide: GuideDefinition = {
  id: "invoice",
  title: "Kreiranje prvega računa",
  description: "Od izbire kupca do pregleda in priprave računa.",
  route: "/invoices/new",
  steps: [
    {
      element: "[data-tour='invoice-header']",
      popover: {
        title: "Nov e-račun",
        description: "Voden vnos te pelje skozi prejemnika, podatke računa, postavke, pregled in pošiljanje.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='invoice-stepper']",
      popover: {
        title: "Pet jasnih korakov",
        description: "Med koraki se lahko kadarkoli vrneš. Vneseni podatki ostanejo ohranjeni.",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='invoice-profile']",
      popover: {
        title: "Izberi profil",
        description: "Za običajen slovenski račun izberi Standard. Posebna polja se prikažejo samo pri UJP, banki ali Hrvaški.",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='invoice-buyer']",
      popover: {
        title: "Dodaj prejemnika",
        description: "Izberi shranjeno stranko ali ročno vnesi kupca. eLokacija je pomembna za elektronsko dostavo.",
        side: "right",
      },
    },
    {
      element: "[data-tour='invoice-next']",
      popover: {
        title: "Nadaljuj po korakih",
        description: "V naslednjih korakih dodaš datume, plačilo in postavke. Pred pošiljanjem aplikacija pokaže vse validacijske napake.",
        side: "top",
        align: "end",
      },
    },
  ],
};
