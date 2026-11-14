// The client: draws a reading, computes nothing about the project.
import './ui/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { App } from './app/App.tsx';
import { chooseSource } from './app/source.ts';

// Zod's probe for code generation would trip the page's Content-Security-Policy, served or exported.
z.config({ jitless: true });

// Chosen before the router starts: a live launch's token is taken from the hash first.
const source = chooseSource();
const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root to draw the reading in.');
createRoot(root).render(
  <StrictMode>
    <App source={source} />
  </StrictMode>,
);
