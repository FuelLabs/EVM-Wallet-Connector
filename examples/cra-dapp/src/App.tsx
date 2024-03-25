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
      {/* Top */}
      {/* <nav id="nav" className="flex items-center justify-center px-3 py-12">
        <img src="./logo_white.png" alt="Fuel Logo" className="w-[124px]" />
      </nav> */}

      {/* Main */}
      {/* <div className="flex h-full min-w-full "> */}
      <div id="container" className="mx-8 mb-24 w-full max-w-5xl">
        <nav
          id="nav"
          className="flex items-center justify-center py-6 md:pb-10 md:pt-0"
        >
          <img src="./logo_white.png" alt="Fuel Logo" className="w-[124px]" />
        </nav>

        <div className="rounded-xl border p-1.5 drop-shadow-xl dark:border-zinc-600/30 dark:bg-gradient-to-t dark:from-zinc-950 dark:to-zinc-900">
          <div
            id="grid"
            className="lg:grid lg:grid-cols-7 lg:grid-rows-1 lg:gap-12"
          >
            <div
              id="text"
              className="col-span-3 px-4 py-8 sm:px-8 sm:py-8 md:px-10 md:py-12"
            >
              <img src="./metamask.svg" alt="Metamask" className="w-16" />
              <h1 className="pb-1 pt-6 text-3xl font-medium">Metamask Demo</h1>
              <p>
                Fuel enables developers to build integrations with any wallet.
              </p>

              <ul className="list-inside list-disc pt-10">
                <li>Reduce friction for users</li>
                <li>Build using any signature scheme</li>
                <li>Use predicates, a new type of stateless smart contract</li>
              </ul>
              <a
                href="#"
                className="block pt-2 text-green-500/80 transition-colors hover:text-green-500"
              >
                Build your own wallet integration
              </a>
            </div>

            <div className="col-span-4 rounded-lg border drop-shadow-xl dark:border-zinc-600/50 dark:bg-gradient-to-t dark:from-zinc-900 dark:to-zinc-900/75">
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
      {/* </div> */}
    </main>
  );
}
