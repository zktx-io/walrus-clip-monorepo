# @zktx.io/walrus-wallet

## Introduction

### Walrus Wallet – OpenID-based Non-Custodial Wallet

Walrus Wallet is a React library designed to reflect the latest Web3 UX trends, enabling developers to integrate it seamlessly within their dApps. This solution allows developers to leverage innovative Web3 technology while maintaining the familiar user experience of Web2.

Core Features & Technology Stack

1. Non-Custodial Wallet via zkLogin Social Login
   - Utilizing Sui’s core technology, **zkLogin**, Walrus Wallet enables the creation of non-custodial wallets through familiar social logins such as Google and Apple.
1. Sponsored Transactions with Enoki
   - Through Sui’s **Enoki**, Walrus Wallet supports transactions without burdening users with gas fees.
1. Compliance with Wallet Standard
   - Walrus Wallet adheres to Sui’s **Wallet Standard**, offering a consistent development experience across different wallets and ensuring smooth integration between dApps.
1. Differentiation from [Stashed Wallet](https://getstashed.com)
   - **Stashed Wallet** operates via an independent website,
   - whereas **Walrus Wallet** is provided as a React library that enables immediate transaction signing and execution within the dApp, without requiring a page transition.
   - Additionally, developers can freely customize the **wallet’s icon and name**, creating a user-friendly interface tailored to each dApp.

## Seamless UX via QR Code & WebRTC Communication

Walrus Wallet leverages **QR code** and **WebRTC** technologies to enable smooth connectivity and authentication between dApps. This allows users to experience boundary-free payments and verifications across all dApps that support Walrus Wallet using a single wallet.

1. QR Code-Based Payments (No Login Required)

   - After logging into the Walrus Wallet dApp once, users can complete payments on other sites simply by scanning a QR code—no additional login required.
   - Example: Scanning a QR code at a restaurant kiosk to process a quick payment.

1. QR Code-Based Authentication (Digital Certificate Verification)

   - Users can submit digital certificates received via Walrus Wallet through QR codes for verification by an authenticator.
   - Example: Instantly verifying the validity of a concert ticket through QR code scanning.

1. Automated Access Control

   - QR codes are scanned at entry points such as buildings, event venues, or clubs to verify access.
   - Example: Managing hotel check-ins, accessing secure areas, or controlling entry to co-working spaces.

1. Team & Enterprise Access (Shared Accounts and Membership Authentication)
   - In team accounts or enterprise SaaS services, QR codes are used to authenticate and manage access for members.
   - Example: Facilitating easy team member authentication for internal corporate tools or shared subscription services (e.g., enterprise versions of Spotify or Netflix).

## Conclusion

Walrus Wallet is a powerful Web3 wallet solution that leverages zkLogin, Enoki, and the Wallet Standard.

- **Seamless UX**: Users can sign and execute transactions within the dApp without page transitions, ensuring an exceptionally smooth experience.
- **Developer-Friendly**: Customization options and adherence to standards enable easy integration with a wide range of dApps.
- **Scalability**: By utilizing QR code and WebRTC-based technologies, it can be flexibly applied to various scenarios such as payments, authentication, access control, and team verification.

Through these features, Walrus Wallet lowers the entry barriers to Web3, offering an intuitive and scalable solution for both users and developers.

## Links

- [zkLogin](https://docs.sui.io/concepts/cryptography/zklogin)
- [Enoki](https://docs.enoki.mystenlabs.com/)
- [Wallet Standard](https://docs.sui.io/standards/wallet-standard)
- [Demo](https://clip.walrus.site/)

## Document

Get started with Walrus Wallet and learn by [Docs](https://docs.zktx.io/walrus-clip/)
