import { FuelProvider } from '@fuel-wallet/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { EVMWalletConnector } from '@fuels/wallet-connector-evm';

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <FuelProvider
      // devMode is used to show Connectors that are focused on development versions
      // like Fuel Wallet Development
      fuelConfig={{
        devMode: true,
        connectors: [new EVMWalletConnector()]
      }}
    >
      <App />
    </FuelProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
