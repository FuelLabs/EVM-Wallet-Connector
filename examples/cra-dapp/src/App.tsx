/* eslint-disable no-console */
import { useEffect, useState } from 'react';
import {
  useAccounts,
  useDisconnect,
  useConnectUI,
  useWallet,
  useBalance,
  useIsConnected,
  useFuel
} from '@fuel-wallet/react';
import './App.css';
import { CounterContractAbi__factory } from './contracts';
import { bn, Address, BaseAssetId } from 'fuels';

const COUNTER_CONTRACT_ID =
  '0x0a46aafb83b387155222893b52ed12e5a4b9d6cd06770786f2b5e4307a63b65c';
const DEFAULT_ADDRESS = Address.fromRandom().toString();
const DEFAULT_AMOUNT = bn.parseUnits('0.001');

function AccountItem({ address }: { address: string }) {
  const [isLoading, setLoading] = useState(false);
  const [isLoadingCall, setLoadingCall] = useState(false);
  const { balance, refetch } = useBalance({
    address
  });
  const { wallet } = useWallet(address);
  const hasBalance = balance && balance.gte(DEFAULT_AMOUNT);

  useEffect(() => {
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  async function handleTransfer() {
    setLoading(true);
    try {
      const receiverAddress = prompt('Receiver address', DEFAULT_ADDRESS);
      const receiver = Address.fromString(receiverAddress || DEFAULT_ADDRESS);
      const resp = await wallet?.transfer(
        receiver,
        DEFAULT_AMOUNT,
        BaseAssetId,
        {
          gasPrice: 1,
          gasLimit: 10_000
        }
      );
      const result = await resp?.waitForResult();
      console.log(result?.status);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function increment() {
    if (wallet) {
      setLoadingCall(true);
      const contract = CounterContractAbi__factory.connect(
        COUNTER_CONTRACT_ID,
        wallet
      );
      try {
        await contract.functions
          .increment()
          .txParams({ gasPrice: 1, gasLimit: 100_000 })
          .call();
      } catch (err) {
        console.log('error sending transaction...', err);
      } finally {
        setLoadingCall(false);
      }
    }
  }

  return (
    <div className="AccountItem">
      <div className="AccountColumns">
        <span>
          <b>Account:</b> {address}{' '}
        </span>
        <span>
          <b>Balance:</b> {balance?.format() || '0'} ETH
        </span>
      </div>
      <div className="accountActions">
        {!hasBalance && (
          <a
            href={`https://faucet-beta-5.fuel.network/?address=${address}`}
            target="_blank"
          >
            <button>Get some coins</button>
          </a>
        )}
        <button
          onClick={() => increment()}
          disabled={isLoadingCall || !hasBalance}
        >
          {isLoadingCall
            ? 'Incrementing...'
            : 'Increment the counter on a contract'}
        </button>
        <button
          onClick={() => handleTransfer()}
          disabled={isLoading || !hasBalance}
        >
          {isLoading
            ? 'Transferring...'
            : `Transfer ${DEFAULT_AMOUNT.format()} ETH`}
        </button>
      </div>
    </div>
  );
}

function LogEvents() {
  const { fuel } = useFuel();
  useEffect(() => {
    const log = (prefix: string) => (data: any) => {
      console.log(prefix, data);
    };
    const logAccounts = log('accounts');
    const logConnection = log('connection');
    const logCurrentAccount = log('currentAccount');

    fuel.on(fuel.events.accounts, logAccounts);
    fuel.on(fuel.events.connection, logConnection);
    fuel.on(fuel.events.currentAccount, logCurrentAccount);
    return () => {
      fuel.off(fuel.events.accounts, logAccounts);
      fuel.off(fuel.events.connection, logConnection);
      fuel.off(fuel.events.currentAccount, logCurrentAccount);
    };
  }, [fuel]);

  return null;
}

function ContractCounter() {
  const { wallet } = useWallet();
  const { balance } = useBalance({
    address: wallet?.address.toString()
  });
  const [counter, setCounter] = useState(0);
  const shouldShowCounter = wallet && balance?.gt(0);

  useEffect(() => {
    if (!shouldShowCounter) return;
    getCount();
    const interval = setInterval(() => getCount(), 5000);
    return () => clearInterval(interval);
  }, [shouldShowCounter]);

  const getCount = async () => {
    const counterContract = CounterContractAbi__factory.connect(
      COUNTER_CONTRACT_ID,
      wallet!
    );
    try {
      const { value } = await counterContract.functions
        .count()
        .txParams({
          gasPrice: 1,
          gasLimit: 100_000
        })
        .simulate();
      setCounter(value.toNumber());
    } catch (error) {
      console.error(error);
    }
  };

  if (!shouldShowCounter) return null;

  return (
    <div className="Counter">
      <h3>Counter: {counter}</h3>
    </div>
  );
}

function App() {
  const { connect, error, isError, theme, setTheme, isConnecting } =
    useConnectUI();
  const { disconnect } = useDisconnect();
  const { isConnected, refetch } = useIsConnected();
  const { accounts } = useAccounts();
  const lightTheme = theme === 'light';

  useEffect(() => {
    const interval = setInterval(() => refetch(), 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <div className="App" data-theme={theme}>
      <LogEvents />
      <div className="Actions">
        <button
          onClick={() => {
            console.log('connect');
            connect();
          }}
        >
          {isConnecting ? 'Connecting' : 'Connect'}
        </button>
        {isConnected && (
          <button onClick={() => disconnect()}>Disconnect</button>
        )}
        <button onClick={() => setTheme(lightTheme ? 'dark' : 'light')}>
          {lightTheme ? '🌙' : '☀️'}
        </button>
      </div>
      <div className="Info">
        {isConnected && (
          <>
            <p>
              The connected accounts below are the predicate accounts on Fuel
              for each of the connected EVM wallet accounts.
            </p>
            <p>
              You can use an EVM wallet account to send transactions from its
              corresponding predicate account.
            </p>
            <p>
              Additional accounts can be connected via the EVM wallet extension.
            </p>
          </>
        )}
      </div>
      {isError && <p className="Error">{error?.message}</p>}
      {isConnected && (
        <div className="Accounts">
          <h3>Connected accounts</h3>
          {accounts?.map((account) => (
            <AccountItem key={account} address={account} />
          ))}
        </div>
      )}
      <ContractCounter />
      <div className="BottomInfo">
        {isConnected && (
          <>
            <p>
              The counter contract is deployed to the address below:{' '}
              <b>{COUNTER_CONTRACT_ID}</b>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
