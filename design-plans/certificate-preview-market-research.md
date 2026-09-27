# Certificate preview builders: source memo

**Research date:** 2026-09-24

**Scope:** First-party help/documentation from LMS and credential platforms, W3C and 1EdTech standards, and one relevant developer issue. This is a source memo, not a product specification.

## Findings at a glance

- **Issuer profile gating:** The standards require issuer identity in a verifiable credential, but the reviewed standards do not prescribe a template-editor or preview gate. The reviewed platform docs describe issuer settings and design workflows separately; none explicitly says an issuer profile must be complete before editing or previewing a certificate. Thinkific does ask users to save certificate/course details before entering design customization, which is a narrower workflow dependency.
- **Preview data:** Platforms document both literal merge-field placeholders and generated/test certificates. Where a course or issuer context is known, several platforms bind certificate fields to that real context. LearnWorlds explicitly calls an admin-generated certificate a dummy used for testing or preview. Thinkific's legacy experience instead shows curly-brace variables and even displays an expiry date in preview when it will be omitted from issuance.
- **Overflow:** Sertifier recommends either shrink-to-fit or wrapping for recipient names, and explicitly recommends checking a long sample name for collisions. Thinkific separately documents a 255-character course-name limit; that is a data limit, not a guarantee that text fits visually.
- **Preview variants:** Thinkific, Teachable, Moodle Workplace, and Instructure document a single primary certificate preview action in the editor/template workflow. The evidence supports one canonical preview surface; varying its data is a separate need from multiplying preview modes.

## Observed facts

### 1. Issuer profile completion and editor access

The W3C Verifiable Credentials Data Model says a verifiable credential **must** have an `issuer` property. 1EdTech's Open Badges profile model says issuers are represented as Profiles, while also stating that anyone can create and host an issuer file to start issuing Open Badges. These are requirements for credential identity and issuance data; neither specifies that a human-facing organization profile form must be complete before a visual template can be edited or previewed. ([W3C VC Data Model 2.0](https://www.w3.org/TR/vc-data-model/); [1EdTech Open Badges TrustEd Credential Profile](https://standards.1edtech.org/open-badges/specifications/standards/ob-trustedcredential/v1p0))

Sertifier's design guide starts with **Components → Credential Designs → Create New Design** and describes adding issuer, recipient, and course attributes. Its issuer-profile guide places profile configuration under **Settings → Organization Settings**; its design guide says the issuer-name attribute reads the institution name from **Settings → Branding**. Those docs describe separate surfaces and data wiring, not a profile-completion gate. ([Sertifier design guide](https://help.sertifier.com/credential-design-complete-guide); [Sertifier issuer profile](https://help.sertifier.com/issuer-profile))

Thinkific's newer designer does impose a documented sequence: save certification details, including its linked course, before customizing the design. That is a gate on credential/course context, not a stated issuer-profile prerequisite. Credly's issuer help says some organization-profile fields are required to save the public organization profile, but does not connect that requirement to certificate-template editing. ([Thinkific Certificate Designer](https://support.thinkific.com/hc/en-us/articles/41803314085783-Designing-Your-Certificate-with-the-Certificate-Designer); [Credly organization profile](https://credlyissuer.zendesk.com/hc/en-us/articles/360057996911-Customizing-your-organization-s-profile))

### 2. Real data, placeholders, and sample learners

- Thinkific's newer designer shows a learner-facing preview and says learner name, course name, completion date, optional expiry date, and certificate ID are populated from course and learner data. Template changes affect future issued certificates. ([Thinkific Certificate Designer](https://support.thinkific.com/hc/en-us/articles/41803314085783-Designing-Your-Certificate-with-the-Certificate-Designer))
- Thinkific's legacy editor visibly uses curly-brace variables such as `{{Student name}}` and `{{Course name}}` in its sample certificate. It documents that these are populated on issuance; the course-name value is limited to 255 characters. It also says an expiry date can appear in preview even when no expiry is configured and will not appear on the issued certificate. ([Thinkific certificate content](https://support.thinkific.com/hc/en-us/articles/360042099494-Customize-Your-Certificate-Content))
- Sertifier documents source mapping: recipient name comes from the uploaded recipient list, course name from Credential Details, issue date from the send date, and issuer name from account branding/settings. ([Sertifier design guide](https://help.sertifier.com/credential-design-complete-guide))
- LearnWorlds says an administrator-submitted certificate is a **dummy certificate** used solely for testing or preview; learner name and other personal fields are separately collected for the learner's certificate. ([LearnWorlds certificate of completion](https://support.learnworlds.com/support/solutions/articles/12000087212-how-to-create-a-certificate-of-completion))
- Teachable documents one Preview action to see the certificate as students will see it and exposes Liquid values for course, school, student, issue date, and serial number in custom templates. ([Teachable certificates](https://support.teachable.com/en/articles/11682466-certificates-of-completion))

### 3. Long values and overflow handling

Sertifier identifies recipient-name overflow as a known layout concern. Its documented choices are **Shrink & Fit to Box** or **Wrap**; for wrapping, it recommends testing with a long sample name to catch overlap and leaving enough height for a second line. ([Sertifier recipient-name guidance](https://help.sertifier.com/how-to-add-recipient-name-to-certificate-design))

Thinkific's 255-character maximum applies to course-name data. It does not say that 255 characters will fit a certificate at a given font, width, or size. The Sertifier guidance makes the visual distinction explicit: fit depends on the text box and fitting behavior. ([Thinkific certificate content](https://support.thinkific.com/hc/en-us/articles/360042099494-Customize-Your-Certificate-Content); [Sertifier recipient-name guidance](https://help.sertifier.com/how-to-add-recipient-name-to-certificate-design))

One adjacent developer report illustrates why preview fidelity matters: a Documenso issue describes prefilled text overflowing in the browser signing preview while fitting in the final PDF, attributing the discrepancy to how the preview sized text relative to its container. This is one reported bug in a document-signing product, not evidence of a general LMS pattern. ([Documenso issue #2669](https://github.com/documenso/documenso/issues/2669))

### 4. How platforms scope preview actions

Thinkific describes one design-tab preview that updates immediately when a template is selected, with separate field visibility controls. Teachable describes one Preview button for the student-facing view. Moodle Workplace lists Preview as one action on each template, alongside issue, duplicate, and delete. Instructure's Canvas Catalog help likewise describes a single Preview icon for a custom certificate. The docs do not establish a universal number of modes, but these examples keep preview attached to the certificate/template being edited. ([Thinkific Certificate Designer](https://support.thinkific.com/hc/en-us/articles/41803314085783-Designing-Your-Certificate-with-the-Certificate-Designer); [Teachable certificates](https://support.teachable.com/en/articles/11682466-certificates-of-completion); [Moodle Workplace certificate templates](https://docs.moodle.org/405/en/Certificate_templates); [Canvas Catalog custom certificate](https://community.instructure.com/en/kb/articles/660424-how-do-i-create-a-custom-template-for-a-certificate-of-completion-for-a-catalog-course-or-program))

## Inferences for preview design

1. **Do not treat profile completeness as a standard-mandated preview gate.** The standards make issuer identity important for the issued credential. The reviewed vendor docs do not establish a general rule that incomplete optional/public branding should prevent visual editing. A narrower gate can be justified where a missing value makes the preview materially misleading or where required issuance data cannot yet be represented.
2. **Bind known context; use clearly marked synthetic sample data for the rest.** When the certificate is already scoped to a course and organization, showing their actual course and issuer values most closely reflects issuance. If no learner is in scope, use a conspicuously synthetic sample learner rather than requiring a real learner or leaving every field as raw tokens. Keep actual learner data out of a general template preview unless a specific learner preview is requested. This is an inference from the documented source mappings and dummy/test-certificate workflows, not a platform-wide rule.
3. **Use one primary preview and vary the data fixture.** A single rendered certificate can show the normal case; a long-name/long-course sample can serve as an explicit fit check. This collapses redundant “preview modes” while preserving a separate way to exercise worst-case text. Keep an obvious boundary between preview samples and issued credentials. The sources support the single-preview pattern and the long-value check, but do not prescribe this exact control design.
4. **Validate the same layout behavior at preview and export.** The developer issue is a reminder that a browser preview can diverge from final PDF rendering. Long-value checks should exercise the renderer used for issued output, or compare preview and generated output when those renderers differ.

## Hub source audit

**Audited surface:** Admin → Curso → Certificado template editor, as of commit `6b50e31b`. This is the editable HTML canvas, not the public PNG preview for an already-issued certificate.

- `CertificateTemplateForm` shows issuer-profile and course-signatory notices, and disables publishing when either prerequisite is missing. The live canvas and its field-move/resize controls remain active. The existing editor test for an incomplete issuer profile also expects the short-data preview to remain visible.
- `CertificateTemplatePreview` has two fixed fixture sets. Both issuer name and CNPJ are hardcoded; course title is also sample data. Course workload and per-course signer name/role are passed from the current Course, but empty signer values fall back to fictional samples. Learner name, dates, and validation code are sample values. The QR uses the reserved `.example.test` host, so it does not resolve as a real certificate.
- The course page passes only a boolean from `hasCertificateIssuerProfile()` to the editor. That helper checks whether a global row exists; Admin Settings separately computes readiness from legal name, display name, and valid CNPJ. A preview gate should consume one canonical completeness result and the actual profile values, rather than treating row existence as proof of a valid profile.
- `CERTIFICATE_REQUIRED_FIELDS` are student name, validation code, and QR; their visibility is a template/layout requirement. Blocking the canvas when these are missing would block the very interactions used to add or position those fields. Keep these as preview-editable diagnostics and publication blockers; use the readiness gate only for upstream credential data such as the global issuer profile and the Course signatory.
- The live canvas is browser/DOM-rendered while final certificates use the PDF rendering pipeline. Preview overflow warnings currently measure the selected sample in the browser. A single long fixture improves the normal layout check but should not be treated as proof that every possible string matches PDF output.

**Project-specific recommendation:** if the product chooses the stricter preview gate, replace only the editable preview region with a clear readiness state when the global issuer profile is incomplete or the Course signatory is missing. List the exact missing saved values and link to the authorized settings surfaces. Keep draft save and non-preview authoring available; keep required-field visibility, overlap, bounds, and overflow feedback in the canvas so those issues remain fixable. Once ready, populate issuer legal/display name, CNPJ, Course title/workload, and Course signatory from saved data. Keep a deterministic, visibly synthetic long sample for the learner and per-issuance values (name, dates, validation ID/QR); never use a real learner's identity in a generic editor preview. Remove the short/long UI toggle, but retain long-content and renderer-parity regression tests.

This is a project recommendation, not an industry mandate. The credential standards establish issuer and subject data in issued credentials; they do not specify whether an editor must block visual preview until an issuer profile is complete. In the Hub, requiring company legal name, brand, valid CNPJ, and Course signatory is a product/business rule for publication and issuance, not a rule imposed by W3C or 1EdTech.

## Sources

1. [W3C, Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model/)
2. [1EdTech, Open Badges 3.0 TrustEd Credential Profile](https://standards.1edtech.org/open-badges/specifications/standards/ob-trustedcredential/v1p0)
3. [Thinkific, Designing Your Certificate with the Certificate Designer](https://support.thinkific.com/hc/en-us/articles/41803314085783-Designing-Your-Certificate-with-the-Certificate-Designer)
4. [Thinkific, Customize Your Certificate Content](https://support.thinkific.com/hc/en-us/articles/360042099494-Customize-Your-Certificate-Content)
5. [Sertifier, Credential Design Complete Guide](https://help.sertifier.com/credential-design-complete-guide)
6. [Sertifier, How to Add Recipient Name to Certificate Design](https://help.sertifier.com/how-to-add-recipient-name-to-certificate-design)
7. [Sertifier, Issuer Profile](https://help.sertifier.com/issuer-profile)
8. [Credly, Customizing Your Organization's Profile](https://credlyissuer.zendesk.com/hc/en-us/articles/360057996911-Customizing-your-organization-s-profile)
9. [LearnWorlds, How to Create a Certificate of Completion](https://support.learnworlds.com/support/solutions/articles/12000087212-how-to-create-a-certificate-of-completion)
10. [Teachable, Certificates of Completion](https://support.teachable.com/en/articles/11682466-certificates-of-completion)
11. [Moodle Workplace, Certificate Templates](https://docs.moodle.org/405/en/Certificate_templates)
12. [Instructure Canvas Catalog, Create a Custom Certificate Template](https://community.instructure.com/en/kb/articles/660424-how-do-i-create-a-custom-template-for-a-certificate-of-completion-for-a-catalog-course-or-program)
13. [Documenso GitHub issue #2669, Prefilled text overflows in signing preview](https://github.com/documenso/documenso/issues/2669)
