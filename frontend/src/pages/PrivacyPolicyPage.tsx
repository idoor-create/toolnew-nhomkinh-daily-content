export function PrivacyPolicyPage() {
  return (
    <main className="min-h-svh bg-slate-50 px-4 py-10 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-teal-700">Toolnew</p>
        <h1 className="mt-2 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: September 3, 2026</p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            Toolnew is a social media scheduling tool for managing posts across connected
            Facebook Pages and TikTok accounts. This policy explains what information we collect,
            how we use it, and how users can request deletion.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-slate-900">Information We Collect</h2>
          <p>
            When a user connects a social account, Toolnew may store account identifiers, Page
            identifiers, Page names, profile metadata, access tokens, refresh tokens, scheduled
            post content, publishing status, and publishing logs. Toolnew does not collect or store
            Facebook or TikTok passwords.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-slate-900">How We Use Information</h2>
          <p>
            We use connected account data to display available channels, schedule posts, publish
            approved content to the selected channel, refresh authorized access tokens, and show
            publishing history inside the application.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-slate-900">Sharing</h2>
          <p>
            We do not sell personal information. We only send post content and required account
            identifiers to platform APIs, such as Meta Graph API or TikTok Content Posting API, when
            the user chooses to publish or schedule content for a connected channel.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-slate-900">Data Retention</h2>
          <p>
            Toolnew keeps connected-channel data and scheduled content while the user uses the
            service. Users can disconnect a channel or request removal of stored data.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-slate-900">Data Deletion</h2>
          <p>
            To request data deletion, contact the Toolnew administrator and include the customer,
            Page, or social account that should be removed. After verification, connected tokens,
            account metadata, scheduled posts, and publishing logs related to that account will be
            deleted where legally and technically possible.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-slate-900">Contact</h2>
          <p>
            For privacy requests, contact the Toolnew administrator at{" "}
            <a className="font-medium text-teal-700 hover:text-teal-800" href="mailto:admin@example.com">
              admin@example.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
