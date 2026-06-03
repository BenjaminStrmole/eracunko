export type InvoiceLine = {
  id: number;
  description: string;
  quantity: number;
  price: number;
  vatRate: number;
};

export type Invoice = {
  number: string;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  currency: "EUR";
  buyer: {
    name: string;
    vat: string;
    address: string;
    eLocation: string;
  };
  lines: InvoiceLine[];
  totals: {
    net: number;
    vat: number;
    gross: number;
  };
};