import { useAccounts, useConnectUI, useIsConnected } from '@fuel-wallet/react';
import { useEffect } from 'react';

import Counter from './components/counter';
import Account from './components/account';
import Balance from './components/balance';
import Transfer from './components/transfer';
import Button from './components/button';

export default function App() {
  const { connect, isConnecting } = useConnectUI();
  const { isConnected, refetch, isFetching } = useIsConnected();
  const { accounts } = useAccounts();

  useEffect(() => {
    refetch();
  }, [refetch, isConnected, isFetching]);

  return (
    <main
      data-theme="dark"
      className="flex items-center justify-center lg:h-screen dark:text-zinc-50/90"
    >
      <div id="container" className="mx-8 mb-32 w-full max-w-5xl lg:mb-0">
        <nav
          id="nav"
          className="flex items-center justify-center py-6 lg:pb-10 lg:pt-0"
        >
          <a href="https://fuel.network/" target="_blank">
            <img src="./logo_white.png" alt="Fuel Logo" className="w-[124px]" />
          </a>
        </nav>

        <div className="gradient-border rounded-xl">
          <div className="grain rounded-xl p-1.5 drop-shadow-xl">
            <div
              id="grid"
              className="lg:grid lg:grid-cols-7 lg:grid-rows-1 lg:gap-12"
            >
              <div
                id="text"
                className="col-span-3 px-4 py-8 sm:px-8 sm:py-8 md:px-10 md:py-12"
              >
                <img src="./metamask.svg" alt="Metamask" className="w-16" />
                <h1 className="pb-1 pt-6 text-3xl font-medium">
                  Metamask Demo
                </h1>
                <p>
                  Fuel enables developers to build integrations with any wallet.
                </p>

                <ul className="list-inside list-disc pt-8">
                  <li>Reduce friction for users</li>
                  <li>Build using any signature scheme</li>
                  <li>
                    Use predicates, a new type of stateless smart contract
                  </li>
                </ul>
                <a
                  href="https://github.com/FuelLabs/EVM-Wallet-Connector"
                  target="_blank"
                  className="block pt-4 text-green-500/80 transition-colors hover:text-green-500"
                >
                  Build your own wallet integration
                </a>
              </div>

              {/* rounded-lg border drop-shadow-xl dark:border-zinc-600/50 dark:bg-gradient-to-t dark:from-zinc-900 dark:to-zinc-900/75 */}
              <div className="col-span-4">
                <div className="gradient-border h-full rounded-lg bg-gradient-to-b from-zinc-900 to-zinc-950/70">
                  {!isConnected && (
                    <section className="flex h-full flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-8 md:px-10 md:py-12">
                      <Button
                        onClick={connect}
                        loading={isConnecting}
                        loadingText="Connecting"
                      >
                        Connect Metamask
                      </Button>
                    </section>
                  )}

                  {isConnected && (
                    <section className="flex h-full flex-col justify-center space-y-6 px-4 py-8 sm:px-8 sm:py-8 md:px-10 md:py-12">
                      <Account address={accounts[0]} />
                      <Balance address={accounts[0]} />
                      <Counter address={accounts[0]} />
                      <Transfer address={accounts[0]} />
                    </section>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
