import { FuelProvider } from '@fuel-wallet/react';
import { Provider } from 'fuels';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { EVMWalletConnector } from '@fuels/wallet-connector-evm';

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const createRoot = async () => {
  const fuelProvider = await Provider.create('https://beta-4.fuel.network/graphql');
  if (!fuelProvider) {
    throw new Error('Provider not found');
  }

  // @ts-expect-error
  const ethProvider = window.ethereum;
  if (!ethProvider) {
    throw new Error('Ethereum provider not found');
  }

  const connector = new EVMWalletConnector(ethProvider, fuelProvider);

  return (
    <React.StrictMode>
      <FuelProvider
        fuelConfig={{
          devMode: true,
          connectors: [connector],
        }}
      >
         <App />
      </FuelProvider>
    </React.StrictMode>
  );
};

(async () => {
  const content = await createRoot();
  root.render(content);
})();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();