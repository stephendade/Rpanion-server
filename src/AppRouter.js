import React from 'react';
import { BrowserRouter as Router, Route, Switch} from "react-router-dom";

import About from './about.js';
import Home from './home.js';
import SerialPorts from './serialports.js';
import NetworkConfig from './networkconfig.js';
import OldApp from './old.js';
import Analog from './analog.js';
import Video from './video.js';
import FCConfig from './flightcontroller.js';

function AppRouter() {
  return (
    <Router>
            <div id="sidebar-wrapper" className="bg-light border-right">
                <div id="sidebarheading" className="sidebar-heading">Rpanion Web UI</div>
                <div id="sidebar-items" className="list-group list-group-flush">
                    <a className='list-group-item list-group-item-action bg-light' href="/">Home</a>
                    <a className='list-group-item list-group-item-action bg-light' href="/old">Old App</a>
                    <a className='list-group-item list-group-item-action bg-light' href="/serial">Serial Port Routing</a>
                    <a className='list-group-item list-group-item-action bg-light' href="/controller">Flight Controller</a>
                    <a className='list-group-item list-group-item-action bg-light' href="/network">Network Config</a>
                    <a className='list-group-item list-group-item-action bg-light' href="/analog">Analog Ports</a>
                    <a className='list-group-item list-group-item-action bg-light' href="/video">Video Streaming</a>
                    <a className='list-group-item list-group-item-action bg-light' href="/about">About</a>
                </div>
            </div>

        <div className="page-content-wrapper">
          <div className="container-fluid">
            <Switch>
                <Route exact path="/old" component={OldApp} />
                <Route exact path="/" component={Home} />
                <Route exact path="/serial" component={SerialPorts} />
                <Route exact path="/controller" component={FCConfig} />
                <Route exact path="/network" component={NetworkConfig} />
                <Route exact path="/about" component={About} />
                <Route exact path="/video" component={Video} />
                <Route exact path="/analog" component={Analog} />
                <Route component={NoMatch} />
            </Switch>
          </div>
        </div>
    </Router>
  );
}

function NoMatch({ location }) {
  return (
    <div>
      <h3>
        No match for <code>{location.pathname}</code>
      </h3>
    </div>
  );
}

export default AppRouter;
