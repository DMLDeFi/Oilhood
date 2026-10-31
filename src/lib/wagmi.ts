import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { robinhood } from "viem/chains";
import { site } from "@/config/site";

export { robinhood };

export const wagmiConfig = createConfig({
  chains: [robinhood],
  connectors: [
    // Desktop extensions and wallet in-app browsers (MetaMask, Trust, Coinbase, Rabby...).
    injected(),
    ...(site.walletConnectProjectId
      ? [
          // Phone browsers: opens a picker that hands the request to the wallet app (MetaMask, Trust, etc.).
          walletConnect({
            projectId: site.walletConnectProjectId,
            showQrModal: true,
            metadata: { name: "OilHood", description: "The OilHood Terminal", url: site.url, icons: [`${site.url}/icon.svg`] },
          }),
        ]
      : []),
  ],
  transports: { [robinhood.id]: http() },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
