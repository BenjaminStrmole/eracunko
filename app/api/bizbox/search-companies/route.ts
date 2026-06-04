import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.BIZBOX_BASE_URL;

export async function GET(request: NextRequest) {
  try {
    if (!BASE_URL) {
      return NextResponse.json(
        { success: false, message: "Manjkajo backend nastavitve." },
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

    const filter = request.nextUrl.searchParams.get("filter")?.trim();

    if (!filter || filter.length < 3) {
      return NextResponse.json({
        success: true,
        companies: [],
      });
    }

    const params = new URLSearchParams();
    params.set("guid", guid);
    params.set("filter", filter);

    const url = `${BASE_URL}/elocations/companies?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const text = await response.text();

    if (response.status === 204 || !text.trim()) {
      return NextResponse.json({
        success: true,
        companies: [],
      });
    }

    let raw: any = text;

    try {
      raw = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        message: "Iskanje po eImeniku ni uspelo.",
        raw,
        debugUrl: url.replace(guid, "***"),
      });
    }

    const companies = Array.isArray(raw?.company)
      ? raw.company.flatMap((company: any) => {
          const locations = Array.isArray(company.location)
            ? company.location
            : [];

          if (locations.length === 0) {
            return [
              {
                name: company.name || "",
                vatNumber: company.id || "",
                eLocation: company.elocation || "",
              },
            ];
          }

          return locations.map((location: any) => ({
            name: location.name || company.name || "",
            vatNumber: location.id || company.id || "",
            eLocation: location.elocation || company.elocation || "",
          }));
        })
      : [];

    return NextResponse.json({
      success: true,
      companies,
      raw,
      debugUrl: url.replace(guid, "***"),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Napaka pri iskanju podjetij.",
      },
      { status: 500 }
    );
  }
}