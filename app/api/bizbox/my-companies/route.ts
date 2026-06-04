import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.BIZBOX_BASE_URL;

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

    let raw: any = text;

    try {
      raw = JSON.parse(text);
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
      raw?.company?.flatMap((company: any) => {
        const locations = Array.isArray(company.location)
          ? company.location
          : [];

        return locations.map((location: any) => {
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
            address: "",
            canSendInvoices: location.role?.some((role: any) =>
              ["SUP_INV_ADM", "SUP_INV_USR", "P", "U"].includes(role.id)
            ),
          };
        });
      }) || [];

    return NextResponse.json({
      success: true,
      companies,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Napaka pri pridobivanju podjetij.",
      },
      { status: 500 }
    );
  }
}