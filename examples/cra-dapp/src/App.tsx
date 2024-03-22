import { useAccounts, useConnectUI, useIsConnected } from '@fuel-wallet/react';
import { useEffect } from 'react';

import Counter, { COUNTER_CONTRACT_ID } from './components/counter';
import Account from './components/account';
import Balance from './components/balance';
import Transfer from './components/transfer';

export default function App() {
  const { connect, isConnecting } = useConnectUI();
  const { isConnected, refetch, isFetching } = useIsConnected();
  const { accounts } = useAccounts();

  useEffect(() => {
    refetch();
  }, [refetch, isConnected, isFetching]);

  return (
    <main data-theme="dark" className="flex h-screen flex-col dark:bg-black">
      {/* Top */}
      <nav id="nav" className="flex items-center justify-center p-3">
        <img src="./logo_white.png" alt="Fuel Logo" className="w-32" />
      </nav>

      {/* Main */}
      <div className="flex h-full min-w-full items-center justify-center dark:text-zinc-50/90">
        <div
          id="container"
          className="texture mb-16 w-full max-w-5xl rounded-xl border p-1.5 drop-shadow-xl dark:border-zinc-600/40 dark:bg-gradient-to-t dark:from-zinc-950 dark:to-zinc-900"
        >
          <div id="grid" className="grid grid-cols-7 grid-rows-1 gap-12">
            <div id="text" className="col-span-3 px-10 py-12">
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
                className="block pt-2 text-emerald-500 hover:underline"
              >
                Build your own wallet integration
              </a>
            </div>

            <div className="col-span-4 rounded-lg border drop-shadow-xl dark:border-zinc-600/60 dark:bg-gradient-to-t dark:from-zinc-950 dark:to-zinc-900">
              {!isConnected && (
                <section className="flex h-full flex-col items-center justify-center px-10 py-16">
                  <button className="btn btn-primary" onClick={connect}>
                    {isConnecting ? 'Connecting' : 'Connect Metamask'}
                  </button>
                </section>
              )}

              {isConnected && (
                <section className="flex h-full flex-col justify-center space-y-3 px-10 py-16">
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
    </main>
  );
}

{
  /* <div className="mt-10 text-center text-xs dark:text-zinc-400">
            {isConnected && (
              <p>
                The counter contract is deployed to the address below:
                <br />
                <code>{COUNTER_CONTRACT_ID}</code>.
              </p>
            )}
          </div> */
}
