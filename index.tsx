
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  console.error("Critical Render Error:", e);
  rootElement.innerHTML = `<div style="padding:20px; color: red;"><h1>Failed to load app</h1><pre>${e instanceof Error ? e.message : 'Unknown error'}</pre></div>`;
}
