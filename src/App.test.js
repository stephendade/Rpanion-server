import React from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';

import About from './about.js';
import Home from './home.js';
import NetworkConfig from './networkconfig.js';
import Video from './video.js';
import FCConfig from './flightcontroller.js';
import LogBrowser from './logBrowser.js';
import NTRIPPage from './ntripcontroller.js';
import AdhocConfig from './adhocwifi.js';
import CloudConfig from './cloud.js';

it('homepage renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<Home />);
  root.unmount();
});

it('about page renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<About />);
  root.unmount();
});

it('networkconfig page renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<NetworkConfig />);
  root.unmount();
});

it('video page renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<Video />);
  root.unmount();
});

it('flightcontroller page renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<FCConfig />);
  root.unmount();
});

it('logging page renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<LogBrowser />);
  root.unmount();
});

it('ntrip page renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<NTRIPPage />);
  root.unmount();
});

it('adhoc page renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<AdhocConfig />);
  root.unmount();
});

it('cloud page renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<CloudConfig />);
  root.unmount();
});