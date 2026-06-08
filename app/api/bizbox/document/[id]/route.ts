import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = process.env.BIZBOX_BASE_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const url = `${BASE_URL}/documents/${params.id}?guid=${encodeURIComponent(
      guid
    )}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/octet-stream, application/base64, */*",
      },
      cache: "no-store",
    });

    const buffer = await response.arrayBuffer();

    if (!response.ok) {
      const text = Buffer.from(buffer).toString("utf-8");

      return NextResponse.json(
        {
          success: false,
          message: "Prenos dokumenta iz bizBox ni uspel.",
          raw: text,
        },
        { status: response.status }
      );
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="bizbox-document-${params.id}.zip"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Napaka pri prenosu dokumenta.",
      },
      { status: 500 }
    );
  }
}