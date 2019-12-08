import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom'

import 'bootstrap/dist/css/bootstrap.css';
import '../node_modules/startbootstrap-simple-sidebar/css/simple-sidebar.css';

import AppRouter from './AppRouter';
import * as serviceWorker from './serviceWorker';


ReactDOM.render(
  <BrowserRouter>
    <AppRouter />
  </BrowserRouter>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
