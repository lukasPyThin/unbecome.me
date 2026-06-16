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
    const phone = (formData.get("phone") || "").toString().trim();
    const event = (formData.get("event") || "").toString().trim();
    const consent = (formData.get("zgoda") || "").toString().trim();
    const honeypot = (formData.get("_gotcha") || "").toString();

    // Spam honeypot - silent success (bots think it worked, real users never see this field)
    if (honeypot) {
      return jsonResponse({ ok: true });
    }

    // Email always required + format check
    if (!email) {
      return jsonResponse({ error: "Email jest wymagany." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Email wygląda nieprawidłowo." }, 400);
    }

    // RODO: consent is required AND recorded for EVERY submission (all forms have
    // <input name="zgoda" required>). Enforce server-side too, so no submission is
    // processed without proof of consent.
    if (!consent) {
      return jsonResponse({ error: "Zgoda na przetwarzanie danych jest wymagana." }, 400);
    }

    // Two submission types share this endpoint:
    //  - LIST SIGNUP (krąg / circle): email + consent only, NO message field.
    //  - CONTACT / EVENT (index, en/index, przezcialo): carries a message.
    // Discriminator = message presence (only the waitlist forms omit it).
    const isSignup = message.length === 0;
    if (!isSignup && message.length > 10000) {
      return jsonResponse({ error: "Wiadomość zbyt długa." }, 400);
    }

    if (!env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY env var missing");
      return jsonResponse({ error: "Serwer nie jest skonfigurowany." }, 500);
    }

    // RODO proof of consent: timestamp + source IP + which form. The exact consent
    // clause text per form is versioned in the HTML (git history); this records WHO
    // consented, WHEN, and via WHICH form.
    const ts = new Date().toISOString();
    const ip = request.headers.get("CF-Connecting-IP") || "(brak IP)";
    const consentLine = `Zgoda RODO: TAK | ${ts} | IP ${ip}${event ? " | formularz " + event : ""}`;

    let subject;
    let textBody;
    let htmlBody;

    if (isSignup) {
      const label = event || "krąg";
      subject = `[unbecome.me] nowy zapis: ${label}`;
      textBody =
        `Nowy zapis do społeczności.\n` +
        `Email: ${email}\n` +
        `Formularz: ${event || "(brak)"}\n` +
        (name ? `Imię: ${name}\n` : "") +
        (phone ? `Telefon: ${phone}\n` : "") +
        `\n${consentLine}\n`;
      htmlBody =
        `<div style="font-family:system-ui,sans-serif;max-width:560px">` +
        `<p><strong>Nowy zapis do społeczności.</strong></p>` +
        `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>` +
        `<p><strong>Formularz:</strong> ${escapeHtml(event || "(brak)")}</p>` +
        (name ? `<p><strong>Imię:</strong> ${escapeHtml(name)}</p>` : "") +
        (phone ? `<p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>` : "") +
        `<hr style="border:none;border-top:1px solid #ccc;margin:16px 0">` +
        `<p style="color:#555;font-size:13px">${escapeHtml(consentLine)}</p>` +
        `</div>`;
    } else {
      subject = `[unbecome.me] ${event ? event + " - " : ""}${name ? "wiadomość od " + name : "nowa wiadomość"}`;
      textBody =
        `Imię: ${name || "(nie podano)"}\n` +
        `Email: ${email}\n` +
        (phone ? `Telefon: ${phone}\n` : "") +
        (event ? `Formularz: ${event}\n` : "") +
        `\nWiadomość:\n${message}\n` +
        `\n${consentLine}\n`;
      htmlBody =
        `<div style="font-family:system-ui,sans-serif;max-width:560px">` +
        `<p><strong>Imię:</strong> ${escapeHtml(name || "(nie podano)")}</p>` +
        `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>` +
        (phone ? `<p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>` : "") +
        (event ? `<p><strong>Formularz:</strong> ${escapeHtml(event)}</p>` : "") +
        `<hr style="border:none;border-top:1px solid #ccc;margin:16px 0">` +
        `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` +
        `<hr style="border:none;border-top:1px solid #ccc;margin:16px 0">` +
        `<p style="color:#555;font-size:13px">${escapeHtml(consentLine)}</p>` +
        `</div>`;
    }

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
