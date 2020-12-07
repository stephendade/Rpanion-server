import React from 'react';
import { BrowserRouter as Router, Route, Switch} from "react-router-dom";
import { Link } from 'react-router-dom'

import About from './about.js';
import Home from './home.js';
import NetworkConfig from './networkconfig.js';
import Video from './video.js';
import FCConfig from './flightcontroller.js';
import LogBrowser from './logBrowser.js'
import NetworkClients from './networkClients.js'

function AppRouter() {
  return (
    <Router>
            <div id="sidebar-wrapper" className="bg-light border-right">
                <div id="sidebarheading" className="sidebar-heading">Rpanion Web UI</div>
                <div id="sidebar-items" className="list-group list-group-flush">
                    <Link className='list-group-item list-group-item-action bg-light' to="/">Home</Link>
                    <Link className='list-group-item list-group-item-action bg-light' to="/flightlogs">Flight Logs</Link>
                    <Link className='list-group-item list-group-item-action bg-light' to="/controller">Flight Controller</Link>
                    <Link className='list-group-item list-group-item-action bg-light' to="/network">Network Config</Link>
                    <Link className='list-group-item list-group-item-action bg-light' to="/apclients">Access Point Clients</Link>
                    <Link className='list-group-item list-group-item-action bg-light' to="/video">Video Streaming</Link>
                    <Link className='list-group-item list-group-item-action bg-light' to="/about">About</Link>
                </div>
            </div>

        <div className="page-content-wrapper" style={{ "width": "100%" }}>
          <div className="container-fluid">
            <Switch>
                <Route exact path="/" component={Home} />
                <Route exact path="/controller" component={FCConfig} />
                <Route exact path="/network" component={NetworkConfig} />
                <Route exact path="/about" component={About} />
                <Route exact path="/video" component={Video} />
                <Route exact path="/flightlogs" component={LogBrowser} />
                <Route exact path="/apclients" component={NetworkClients} />
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
