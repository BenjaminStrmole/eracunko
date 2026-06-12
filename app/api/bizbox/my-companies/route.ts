import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.BIZBOX_BASE_URL;

type BizBoxRole = {
  id?: string;
};

type BizBoxLocation = {
  id?: string;
  name?: string;
  elocation?: string;
  ehramba?: Array<{ accountName?: string }>;
  role?: BizBoxRole[];
};

type BizBoxCompany = {
  id?: string;
  name?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  location?: BizBoxLocation[];
};

type BizBoxRolesResponse = {
  company?: BizBoxCompany[];
};

export async function GET(request: NextRequest) {
  try {
    if (!BASE_URL) {
      return NextResponse.json(
        { success: false, message: "Manjka BIZBOX_BASE_URL." },
        { status: 500 }
      );
    }

    const guid = request.cookies.get("bizbox_guid")?.value;

    if (!guid) {
      return NextResponse.json(
        { success: false, message: "Uporabnik ni prijavljen." },
        { status: 401 }
      );
    }

    const url = `${BASE_URL}/roles/my?guid=${encodeURIComponent(guid)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json; charset=utf-8",
      },
      cache: "no-store",
    });

    const text = await response.text();

    let raw: BizBoxRolesResponse | string = text;

    try {
      raw = JSON.parse(text) as BizBoxRolesResponse;
    } catch {}

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Pridobivanje podjetij ni uspelo.",
          raw,
        },
        { status: 400 }
      );
    }

    const companies =
      typeof raw === "object" && raw.company
        ? raw.company.flatMap((company) => {
        const locations = Array.isArray(company.location)
          ? company.location
          : [];

        return locations.map((location) => {
          const locationId = location.id || "HQ";
          const ehrambaAccount = location.ehramba?.[0]?.accountName;

          return {
            name: company.name || "",
            taxId: company.id || "",
            locationName: location.name || locationId,
            locationId,
            eLocation:
              location.elocation ||
              (locationId === "HQ"
                ? `C:${company.id}`
                : `L:${company.id}|${locationId}`),
            eAddress: ehrambaAccount || `${company.id}.${locationId}`,
            address: company.address || "",
            postCode: company.postCode || "",
            city: company.city || "",
            country: company.country || "",
            canSendInvoices: location.role?.some((role) =>
              ["SUP_INV_ADM", "SUP_INV_USR", "P", "U"].includes(role.id || "")
            ),
          };
        });
      })
        : [];

    return NextResponse.json({
      success: true,
      companies,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Napaka pri pridobivanju podjetij.",
      },
      { status: 500 }
    );
  }
}
