# Meta Pixel (public marketing pages only)

Set `VITE_META_PIXEL_ID` to the numeric Dataset/Pixel ID in the **build environment**, then rebuild. This ID is public configuration; never put an access token in the browser. With no valid ID, neither the consent prompt nor Meta requests are active.

The Pixel loads only after explicit marketing consent, on anonymous public marketing pages and the public `/auth` page. `PageView` is limited to `/`, `/xpresspro`, `/xpress-consulting`, `/xpress-clean`, `/rencontre`, `/calculateur`, `/diagnostic`, and `/rentabilite`. It sends `Lead` after a successful diagnostic/calculator lead save, `CompleteRegistration` after successful account registration, and `Contact` when a FIPP WhatsApp link is clicked. These events carry no form fields, order/customer IDs, payment details, or purchase values. A WhatsApp click is not a completed booking.

Marketing consent is stored in local storage and can be refused or withdrawn through the `Cookies marketing` control on public pages. Withdrawing stops future Meta events and invokes Meta's consent revoke; previously set third-party cookies may need clearing through the browser. Navigation to any private route unloads the marketing script by full page navigation before private content is mounted. Existing Umami analytics are separate and unchanged.

Before production activation: update `VITE_META_PIXEL_ID` on the deployment, review the legal policy with the business owner, verify accept/refuse/withdraw flows and events in Meta Events Manager's Test Events on a staging site, and verify there are **no** Meta network requests on private routes. Do not treat a green build as live deployment verification.
