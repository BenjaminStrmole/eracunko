import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.BIZBOX_BASE_URL;
const TAX_ID_FROM = process.env.BIZBOX_TAX_ID_FROM;

function extractGuid(text: string) {
  const match = text.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
  );

  return match?.[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    if (!BASE_URL || !TAX_ID_FROM) {
      return NextResponse.json(
        { success: false, message: "Manjkajo backend nastavitve." },
        { status: 500 }
      );
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Vnesi uporabniško ime in geslo." },
        { status: 400 }
      );
    }

    const loginUrl =
      `${BASE_URL}/login?` +
      new URLSearchParams({
        username,
        password,
      });

    const response = await fetch(loginUrl, {
      method: "GET",
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "Prijava v bizBox ni uspela.", raw: text },
        { status: 401 }
      );
    }

    const guid = extractGuid(text);

    if (!guid) {
      return NextResponse.json(
        {
          success: false,
          message: "bizBox ni vrnil GUID seje.",
          raw: text,
        },
        { status: 401 }
      );
    }

    const result = NextResponse.json({
      success: true,
      message: "Prijava uspešna.",
    });

    result.cookies.set("bizbox_guid", guid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 30,
    });

    result.cookies.set("bizbox_username", username, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 30,
    });

    return result;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Napaka pri prijavi." },
      { status: 500 }
    );
  }
}