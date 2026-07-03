export type PolicySection = {
  title: string;
  body?: string[];
  bullets?: string[];
};

export type PolicyPageContent = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  sections: PolicySection[];
};

export const policies = {
  legal: {
    slug: "legal",
    title: "Terms of Service",
    eyebrow: "Legal",
    description:
      "The terms that govern your use of the SHY mobile app, website, and related services.",
    sections: [
      {
        title: "Welcome to SHY",
        body: [
          'These Terms of Service ("Terms") are a binding agreement between you and SHY, governing your use of the SHY mobile application, website, and related services (together, the "Service"). By creating an account, streaming a track, uploading music, or otherwise using SHY, you agree to these Terms. If you do not agree, please do not use the Service.',
          "These Terms are governed by the laws of the Republic of Zambia, including but not limited to the Copyright and Performance Rights Act (Chapter 406 of the Laws of Zambia, as amended), the Data Protection Act No. 3 of 2021, the Electronic Communications and Transactions Act No. 4 of 2021, and the Cyber Security Act, 2025.",
        ],
      },
      {
        title: "1.1 Who Can Use SHY",
        body: [
          "You must be at least 13 years old to create an account. If you are under 18, you confirm you have a parent or guardian's permission to use SHY. Artists uploading music must be at least 18, or have a parent/guardian or legal guardian co-sign the artist agreement, since uploading content involves entering into a licensing arrangement.",
        ],
      },
      {
        title: "1.2 Your Account",
        body: [
          "You are responsible for keeping your login details secure and for everything that happens under your account. Tell us immediately at support@shy.app if you think someone else has accessed your account without permission. We reserve the right to suspend accounts used for fraud, impersonation, or in breach of these Terms.",
        ],
      },
      {
        title: "1.3 Artist Content: Ownership Stays With You",
        body: [
          "This is the part artists care about most, so we are saying it plainly: uploading music to SHY does not transfer ownership of your copyright to us. You remain the owner, or where you are not the sole owner, you confirm you have the rights and clearances needed to upload, of every track, cover image, and piece of metadata you upload.",
          "By uploading content, you grant SHY a non-exclusive, worldwide, royalty-bearing licence to host, stream, reproduce, and publicly perform your content on the Service, solely for the purpose of operating SHY and paying you according to our royalty/payment terms. This licence:",
        ],
        bullets: [
          "Does not stop you from distributing the same music anywhere else, including other DSPs, your own site, or physical releases.",
          "Ends for a given track when you remove it from SHY, subject to a reasonable technical wind-down period and any listener downloads or playlists already made before removal.",
          "Does not include the right for SHY to sell, sub-license for unrelated commercial use, or use your music in advertising for third parties without your separate written consent.",
          "You are responsible for ensuring you hold the necessary rights, including composition, master, sample clearances, collaborator agreements, and mechanical rights where applicable, before uploading.",
          "Where a track involves other rights holders, you confirm you have the authority to license their contribution to SHY, or that appropriate agreements exist between you and them directly. SHY is not a party to, and does not adjudicate, disputes between collaborators.",
        ],
      },
      {
        title: "1.4 Royalties and Payments",
        body: [
          'Where SHY operates a paid, ad-supported, or "Motivation"/tipping-based revenue model, payment terms, royalty rates, payout thresholds, payout schedule, and payment methods are set out in the separate Artist Payment Terms, which form part of this agreement. We will give artists at least 30 days\' notice of material changes to royalty rates.',
        ],
      },
      {
        title: "1.5 Content You Are Not Allowed to Upload",
        bullets: [
          "Content that infringes someone else's copyright, trademark, or other intellectual property rights.",
          "Content that contains hate speech, incitement to violence, or content that would breach the Zambian Penal Code, the Cyber Security Act, 2025, or any other applicable law.",
          "Content that sexualizes or otherwise endangers minors, in any form.",
          "Content that is defamatory, or violates another person's right to privacy.",
          "Content you do not have the legal right to distribute.",
        ],
      },
      {
        title: "1.6 Copyright Complaints and Takedowns",
        body: [
          "If you believe content on SHY infringes your copyright, send a written notice to copyright@shy.app including: identification of the work claimed to be infringed, identification of the material you claim is infringing and its location on SHY, your contact details, and a statement that you have a good-faith belief the use is unauthorized, made under penalty of perjury/affirmation.",
          "On receipt of a valid notice, we will act expeditiously to remove or disable access to the material, consistent with the intermediary/host provisions of the Electronic Communications and Transactions Act, 2021, and will notify the uploading artist, who may submit a counter-notice if they believe the takedown was made in error. Repeat infringers will have their accounts terminated.",
        ],
      },
      {
        title: "1.7 SHY's Role as a Host, Not a Publisher",
        body: [
          "SHY provides hosting and streaming infrastructure for content uploaded by independent artists. We do not pre-screen every upload before it goes live, and we act as an intermediary/host service provider as contemplated under the Electronic Communications and Transactions Act, 2021.",
        ],
        bullets: [
          "We are not liable for user-uploaded content we did not create, select, or modify, provided we act promptly on valid takedown notices and do not have actual knowledge of the infringing or unlawful nature of the content at the time of upload.",
          "We reserve the right, but do not take on an obligation, to review, moderate, or remove content that violates these Terms, without prior notice, particularly where required to comply with a lawful order or to prevent harm.",
        ],
      },
      {
        title: "1.8 Prohibited Conduct",
        body: [
          'You agree not to reverse-engineer or scrape the Service; use bots to inflate streams, likes, or "Motivation" payments; attempt to access other users\' accounts; upload malware; interfere with the Service\'s operation; or use SHY for any unlawful purpose under Zambian law.',
        ],
      },
      {
        title: "1.9 Third-Party Services",
        body: [
          "SHY may integrate third-party services, for example audio recognition providers, payment processors, or analytics tools, to operate features like song identification or payments. Your use of those integrated features is also subject to the relevant third party's terms, and we will flag that clearly wherever such a feature is offered.",
        ],
      },
      {
        title: "1.10 Disclaimers",
        body: [
          'SHY is provided "as is." We do our best to keep the Service available, accurate, and secure, but we do not guarantee uninterrupted access, that content will be error-free, or that the Service will meet every expectation. To the maximum extent permitted under Zambian law, SHY disclaims all implied warranties.',
        ],
      },
      {
        title: "1.11 Limitation of Liability",
        body: [
          "To the fullest extent permitted by the laws of Zambia, SHY, its directors, employees, and affiliates will not be liable for indirect, incidental, special, or consequential damages arising from your use of the Service, including loss of revenue, streams, or data, except where such liability cannot lawfully be excluded, for example liability arising from our own fraud, gross negligence, or wilful misconduct, which we do not exclude or limit. Our total liability for any claim arising from these Terms is limited to the amount you paid us, if any, in the 12 months before the claim arose.",
        ],
      },
      {
        title: "1.12 Indemnity",
        body: [
          "You agree to indemnify and hold SHY harmless from claims, damages, and reasonable legal costs arising from content you upload, your breach of these Terms, or your violation of a third party's rights, including copyright and privacy rights. This clause exists specifically so that if an artist uploads music they did not have the rights to, responsibility sits with the artist who made that representation to us, not with the platform that relied on it in good faith.",
        ],
      },
      {
        title: "1.13 Termination",
        body: [
          "You may delete your account at any time. We may suspend or terminate accounts that breach these Terms, subject to notice where practicable, except in cases of fraud, illegal content, or risk to other users, where we may act immediately.",
        ],
      },
      {
        title: "1.14 Changes to These Terms",
        body: [
          "We will notify users of material changes at least 14 days before they take effect, via the app or email. Continued use after that point means you accept the updated Terms.",
        ],
      },
      {
        title: "1.15 Governing Law and Disputes",
        body: [
          "These Terms are governed by the laws of the Republic of Zambia. Any dispute will first go through good-faith informal resolution; failing that, the courts of Zambia have exclusive jurisdiction.",
        ],
      },
      {
        title: "1.16 Contact",
        bullets: ["Legal notices: legal@shy.app", "Copyright notices: copyright@shy.app"],
      },
    ],
  },
  safetyPrivacy: {
    slug: "safety-privacy",
    title: "Safety & Privacy Center",
    eyebrow: "Safety",
    description:
      "A plain-language hub for how SHY keeps your account, data, and community experience safer.",
    sections: [
      {
        title: "Your Safety and Your Data, in Plain Language",
        body: [
          "This page is your one-stop hub for how SHY keeps you and your account safe, and how to reach us if something goes wrong. It sits alongside, and does not replace, our full Privacy Policy and Terms of Service.",
        ],
      },
      {
        title: "2.1 Account Security",
        bullets: [
          "We encourage strong, unique passwords and, where available, two-factor authentication.",
          'We never ask for your password by email, SMS, or DM. If someone claiming to be "SHY Support" asks you for your password, it is a scam. Report it to safety@shy.app.',
          "We monitor for suspicious login activity and will notify you of logins from new or unusual devices, where technically feasible.",
        ],
      },
      {
        title: "2.2 Reporting Content or Behaviour",
        body: [
          "You can report a track, comment, profile, or message directly from the app. Reports go to our moderation queue and are reviewed by a human, not just an algorithm, for anything flagged as harmful, exploitative, or abusive. We aim to review safety-critical reports, including harassment, hate speech, and child safety concerns, within 24-48 hours.",
        ],
      },
      {
        title: "2.3 Protecting Minors",
        body: [
          "SHY is not intended for children under 13. Where we become aware an account belongs to a child under this age, we will disable it. We do not knowingly collect more personal data from minors than is necessary to operate the Service, in line with our obligations around processing of vulnerable persons' data under the Data Protection Act, 2021. Any content sexualizing or endangering minors will be removed immediately and reported to the Zambia Police Service where required by law.",
        ],
      },
      {
        title: "2.4 Artist-Specific Safety",
        bullets: [
          "Your payment details, ID verification documents, and bank/mobile money details are never shown publicly and are stored separately from your public profile data.",
          "If someone impersonates you as an artist or uploads your music without permission, use the copyright takedown process in our Terms, or contact safety@shy.app directly for expedited review.",
        ],
      },
      {
        title: "2.5 Data Rights at a Glance",
        body: [
          "Under Zambia's Data Protection Act, 2021, you have the right to access, correct, delete, or export your personal data, and to object to or withdraw consent for certain processing. See the full Privacy Policy for how to exercise these rights.",
        ],
      },
      {
        title: "2.6 Reporting a Security Vulnerability",
        body: [
          "If you are a developer or researcher who has found a security issue, please report it responsibly to security@shy.app before disclosing it publicly. We commit to acknowledging reports within 5 business days.",
        ],
      },
      {
        title: "2.7 Contact",
        bullets: [
          "General safety concerns: safety@shy.app",
          'Urgent/child-safety concerns: safety@shy.app, marked "URGENT"',
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    eyebrow: "Privacy",
    description:
      "How SHY collects, uses, stores, protects, and shares personal data.",
    sections: [
      {
        title: "Last Updated",
        body: [
          "Last updated: July 3, 2026",
          "Data Controller: SHY, Lusaka, Zambia",
          'This Privacy Policy explains how SHY collects, uses, stores, and protects your personal data, in accordance with the Data Protection Act No. 3 of 2021 ("the DPA") and, where applicable, the Electronic Communications and Transactions Act, 2021.',
        ],
      },
      {
        title: "3.1 What We Collect",
        bullets: [
          "Account data: name, email, phone number, date of birth, password (hashed), profile photo.",
          "Usage data: songs played, playlists created, likes, follows, search history, device type, IP address, approximate location for regional charts and licensing compliance.",
          "Artist data: uploaded audio files, cover art, royalty/payout details, identity verification documents for payout compliance.",
          "Payment data: processed by our third-party payment processor; SHY does not store full card numbers.",
          "Communications: messages you send our support team.",
        ],
      },
      {
        title: "3.2 Why We Collect It (Legal Basis)",
        body: [
          "Under section 15 of the DPA, we process your data based on one or more of the following: your consent, for example marketing communications given at sign-up and withdrawable at any time; performance of our contract with you, for example delivering the streaming service and paying artist royalties; our legitimate interests, for example fraud prevention and service improvement, balanced against your rights; and compliance with a legal obligation, for example tax and payment reporting.",
        ],
      },
      {
        title: "3.3 Your Rights as a Data Subject",
        bullets: [
          "Access the personal data we hold about you.",
          "Rectify inaccurate or incomplete data.",
          'Erase your data, also known as the "right to be forgotten", subject to limited legal retention exceptions, for example financial records we must keep for tax purposes.',
          "Object to processing carried out on the basis of legitimate interest.",
          "Withdraw consent at any time, where processing is based on consent.",
          "Data portability: receive your data in a structured, commonly used format.",
          "Lodge a complaint with the Office of the Data Protection Commissioner if you believe we have mishandled your data.",
          "To exercise any of these rights, email privacy@shy.app. We will respond within the timeframe required by the DPA once implementing regulations prescribe it, and in any event within 30 days as good practice.",
        ],
      },
      {
        title: "3.4 How Long We Keep Your Data",
        body: [
          "We keep account data for as long as your account is active, and for a limited period after deletion to comply with legal, tax, and dispute-resolution obligations. Artist royalty and payment records are retained per Zambian tax record-keeping requirements.",
        ],
      },
      {
        title: "3.5 Sharing Your Data",
        body: [
          "We share data with payment processors, cloud hosting providers, analytics providers, and, where you use a song-identification feature, an audio-fingerprinting provider such as ShazamKit or ACRCloud to match audio clips. We do not sell your personal data to third parties for their own marketing purposes.",
        ],
      },
      {
        title: "3.6 Cross-Border Data Transfers",
        body: [
          "Where your data is processed or stored outside Zambia, for example by a cloud provider with servers abroad, we ensure the receiving country or organization maintains data protection standards at least equivalent to Zambia's, and, where required under Part X of the DPA, we will seek your consent and any necessary approval from the Data Protection Commissioner before doing so.",
        ],
      },
      {
        title: "3.7 Security",
        body: [
          "We use industry-standard measures, including encryption in transit, access controls, and regular security review, to protect your data. In the event of a data breach likely to affect your rights, we will notify the Data Protection Commissioner within 24 hours of becoming aware of it, as required under the DPA, and notify affected users without undue delay.",
        ],
      },
      {
        title: "3.8 Children's Data",
        body: [
          "We do not knowingly collect personal data from children under 13. Where a parent or guardian believes their child has provided data to us, contact privacy@shy.app to request deletion.",
        ],
      },
      {
        title: "3.9 Data Protection Contact",
        bullets: [
          "For any privacy question or to exercise your rights: privacy@shy.app",
          "Office of the Data Protection Commissioner (Zambia): for complaints that remain unresolved after contacting us directly.",
        ],
      },
    ],
  },
  cookies: {
    slug: "cookies",
    title: "Cookies Policy",
    eyebrow: "Cookies",
    description:
      "How SHY uses cookies, local storage, SDK identifiers, and related technologies.",
    sections: [
      {
        title: "4.1 What Cookies Are",
        body: [
          "Cookies are small text files placed on your device when you use SHY's website or app, including similar technologies like local storage and SDK identifiers on mobile. They help the Service function, remember your preferences, and understand how SHY is used.",
        ],
      },
      {
        title: "4.2 Types of Cookies We Use",
        bullets: [
          "Essential cookies: required for login, session security, and core playback functionality. These cannot be turned off, because the Service will not work without them.",
          "Functional cookies: remember preferences like volume, theme, or recently played.",
          "Analytics cookies: help us understand aggregate usage patterns, for example which features are used most, so we can improve SHY.",
          "Advertising cookies, only where SHY runs an ad-supported tier: used to personalize the ads you see and measure their performance. See our About Ads page for full detail.",
        ],
      },
      {
        title: "4.3 Managing Cookies",
        body: [
          "You can manage or delete cookies through your browser settings, and on mobile, through your device's ad/tracking permission settings. Turning off non-essential cookies will not stop you from using SHY, but may make some personalization features less accurate.",
        ],
      },
      {
        title: "4.4 Third-Party Cookies",
        body: [
          "Some cookies are set by third parties we work with, for example analytics or payment providers. We do not control these providers' cookies directly; their own privacy/cookie policies apply to their data collection.",
        ],
      },
    ],
  },
  aboutAds: {
    slug: "about-ads",
    title: "About Ads",
    eyebrow: "Ads",
    description:
      "How ads may work on SHY if a free, ad-supported listening tier is active.",
    sections: [
      {
        title: "5.1 If SHY Shows You Ads",
        body: [
          "Where SHY operates a free, ad-supported listening tier, we may show ads between tracks or within the app interface to keep that tier free for listeners while still paying artists fairly.",
        ],
      },
      {
        title: "5.2 How Ads Are Personalized",
        body: [
          "We may use limited data, such as the genre of music you listen to, your general region, and device type, to show ads more relevant to you. We do not share your personal contact details, including name, email, and phone number, with advertisers, and advertisers do not get direct access to your SHY account or listening history.",
        ],
      },
      {
        title: "5.3 Your Choices",
        body: [
          'You can limit ad personalization through your device\'s ad-tracking settings, for example "Limit Ad Tracking" on iOS or "Opt out of Ads Personalization" on Android, or by adjusting your preferences in SHY\'s settings menu, where available. Opting out of personalized ads means you will still see ads on the free tier, just less tailored ones.',
        ],
      },
      {
        title: "5.4 No Sale of Personal Data",
        body: [
          "Consistent with our Privacy Policy, SHY does not sell your personal data to advertisers or data brokers.",
        ],
      },
    ],
  },
  accessibility: {
    slug: "accessibility",
    title: "Accessibility",
    eyebrow: "Access",
    description:
      "SHY's commitment to building a music platform that more people can use.",
    sections: [
      {
        title: "6.1 Our Commitment",
        body: [
          "SHY is built to be usable by as many people as possible, including people with visual, auditory, motor, or cognitive disabilities. We are working towards conformance with the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA, as an ongoing standard we design and test against.",
        ],
      },
      {
        title: "6.2 What We Are Doing",
        bullets: [
          "Ensuring sufficient color contrast, including within SHY's purple/dark theme, so text and controls remain readable.",
          "Supporting screen readers on key flows, including playback, search, and account settings.",
          "Providing captions/transcripts for spoken-word content where feasible.",
          "Designing tap targets and controls to be usable without fine motor precision.",
        ],
      },
      {
        title: "6.3 Known Limitations",
        body: [
          "Accessibility is an ongoing effort, not a finished project. Some parts of SHY may not yet fully meet these goals. We track and prioritize accessibility fixes as part of our regular product roadmap.",
        ],
      },
      {
        title: "6.4 Feedback",
        body: [
          "If you hit an accessibility barrier using SHY, we want to know. Contact accessibility@shy.app with what you were trying to do and what happened. This feedback directly shapes what we fix next.",
        ],
      },
    ],
  },
} satisfies Record<string, PolicyPageContent>;

export const policyNav = [
  policies.legal,
  policies.safetyPrivacy,
  policies.privacy,
  policies.cookies,
  policies.aboutAds,
  policies.accessibility,
];
