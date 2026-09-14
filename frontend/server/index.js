const privacyHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Toolnew Privacy Policy</title>
    <style>
      body {
        margin: 0;
        background: #f8fafc;
        color: #0f172a;
        font-family: Arial, sans-serif;
      }
      main {
        max-width: 760px;
        margin: 40px auto;
        padding: 32px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        line-height: 1.65;
      }
      h1 { margin: 0 0 8px; font-size: 32px; }
      h2 { margin-top: 28px; font-size: 20px; }
      p { color: #334155; }
      a { color: #0f766e; }
      .brand { color: #0f766e; font-weight: 700; }
      .date { color: #64748b; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <p class="brand">Toolnew</p>
      <h1>Privacy Policy</h1>
      <p class="date">Last updated: September 3, 2026</p>
      <p>
        Toolnew is a social media scheduling tool for managing posts across connected
        Facebook Pages and TikTok accounts. This policy explains what information we collect,
        how we use it, and how users can request deletion.
      </p>
      <h2>Information We Collect</h2>
      <p>
        When a user connects a social account, Toolnew may store account identifiers, Page
        identifiers, Page names, profile metadata, access tokens, refresh tokens, scheduled
        post content, publishing status, and publishing logs. Toolnew does not collect or store
        Facebook or TikTok passwords.
      </p>
      <h2>How We Use Information</h2>
      <p>
        We use connected account data to display available channels, schedule posts, publish
        approved content to the selected channel, refresh authorized access tokens, and show
        publishing history inside the application.
      </p>
      <h2>Sharing</h2>
      <p>
        We do not sell personal information. We only send post content and required account
        identifiers to platform APIs, such as Meta Graph API or TikTok Content Posting API, when
        the user chooses to publish or schedule content for a connected channel.
      </p>
      <h2>Data Retention</h2>
      <p>
        Toolnew keeps connected-channel data and scheduled content while the user uses the
        service. Users can disconnect a channel or request removal of stored data.
      </p>
      <h2>Data Deletion</h2>
      <p>
        To request data deletion, contact the Toolnew administrator and include the customer,
        Page, or social account that should be removed. After verification, connected tokens,
        account metadata, scheduled posts, and publishing logs related to that account will be
        deleted where legally and technically possible.
      </p>
      <h2>Contact</h2>
      <p>
        For privacy requests, contact the Toolnew administrator at
        <a href="mailto:admin@example.com">admin@example.com</a>.
      </p>
    </main>
  </body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/privacy" || url.pathname === "/privacy/") {
      return new Response(privacyHtml, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
