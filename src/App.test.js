import React from 'react';
import ReactDOM from 'react-dom';

import About from './about.js';
import Home from './home.js';
import NetworkConfig from './networkconfig.js';
import Video from './video.js';
import FCConfig from './flightcontroller.js';
import LogBrowser from './logBrowser.js'


it('homepage renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<Home />, div);
  ReactDOM.unmountComponentAtNode(div);
});

it('about page renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<About />, div);
  ReactDOM.unmountComponentAtNode(div);
});

it('networkconfig page renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<NetworkConfig />, div);
  ReactDOM.unmountComponentAtNode(div);
});

it('video page renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<Video />, div);
  ReactDOM.unmountComponentAtNode(div);
});

it('flightcontroller page renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<FCConfig />, div);
  ReactDOM.unmountComponentAtNode(div);
});

it('logging page renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<LogBrowser />, div);
  ReactDOM.unmountComponentAtNode(div);
});
