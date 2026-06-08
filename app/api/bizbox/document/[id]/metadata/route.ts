import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = process.env.BIZBOX_BASE_URL;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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
        { success: false, message: "Uporabnik ni prijavljen v bizBox." },
        { status: 401 }
      );
    }

    const url = `${BASE_URL}/documents/${id}/metaData?guid=${encodeURIComponent(
      guid
    )}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json, text/plain, */*",
      },
      cache: "no-store",
    });

    if (response.status === 204) {
      return NextResponse.json({
        success: true,
        metadata: null,
      });
    }

    const text = await response.text();

    let metadata: any = text;

    try {
      metadata = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Pridobivanje metadata ni uspelo.",
          raw: metadata,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      metadata,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Napaka pri pridobivanju metadata.",
      },
      { status: 500 }
    );
  }
}