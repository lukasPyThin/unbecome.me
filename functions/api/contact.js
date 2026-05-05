/**
 * Cloudflare Pages Function: POST /api/contact
 *
 * Receives form submission from unbecome.me contact form,
 * sends an email via Resend API to lukasz@unbecome.me.
 *
 * Env var required: RESEND_API_KEY (set in CF Pages dashboard → Settings → Environment Variables)
 */

const RECIPIENT = "lukasz@unbecome.me";
const SENDER = "unbecome.me <kontakt@unbecome.me>";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export async function onRequestPost({ request, env }) {
  try {
    // Parse form data (handles multipart/form-data and application/x-www-form-urlencoded)
    let formData;
    try {
      formData = await request.formData();
    } catch (err) {
      return jsonResponse({ error: "Nieprawidłowy format danych" }, 400);
    }

    const name = (formData.get("name") || "").toString().trim();
    const email = (formData.get("email") || "").toString().trim();
    const message = (formData.get("message") || "").toString().trim();
    const honeypot = (formData.get("_gotcha") || "").toString();

    // Spam honeypot - silent success (bots think it worked, real users never see this field)
    if (honeypot) {
      return jsonResponse({ ok: true });
    }

    // Validation
    if (!email || !message) {
      return jsonResponse({ error: "Email i wiadomość są wymagane." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Email wygląda nieprawidłowo." }, 400);
    }
    if (message.length > 10000) {
      return jsonResponse({ error: "Wiadomość zbyt długa." }, 400);
    }

    if (!env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY env var missing");
      return jsonResponse({ error: "Serwer nie jest skonfigurowany." }, 500);
    }

    const subject = `[unbecome.me] ${name ? "wiadomość od " + name : "nowa wiadomość"}`;

    const textBody =
      `Imię: ${name || "(nie podano)"}\n` +
      `Email: ${email}\n` +
      `\n` +
      `Wiadomość:\n${message}\n`;

    const htmlBody =
      `<div style="font-family:system-ui,sans-serif;max-width:560px">` +
      `<p><strong>Imię:</strong> ${escapeHtml(name || "(nie podano)")}</p>` +
      `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>` +
      `<hr style="border:none;border-top:1px solid #ccc;margin:16px 0">` +
      `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` +
      `</div>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SENDER,
        to: [RECIPIENT],
        reply_to: email,
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errText);
      return jsonResponse(
        { error: "Wysyłka nie powiodła się. Spróbuj ponownie lub napisz bezpośrednio na lukasz@unbecome.me." },
        502
      );
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("Contact function error:", err && err.stack ? err.stack : err);
    return jsonResponse(
      { error: "Coś nie zadziałało. Napisz bezpośrednio na lukasz@unbecome.me." },
      500
    );
  }
}

// Optional: simple GET handler for sanity-check (visit /api/contact in browser)
export function onRequestGet() {
  return jsonResponse({ ok: true, method: "use POST" });
}
