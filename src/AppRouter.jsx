import { Route, Routes, Link, useLocation } from 'react-router-dom'
import React from 'react'

import About from './about.jsx'
import Home from './home.jsx'
import NetworkConfig from './networkconfig.jsx'
import VideoPage from './video.jsx'
import FCConfig from './flightcontroller.jsx'
import LogBrowser from './logBrowser.jsx'
import NetworkClients from './networkClients.jsx'
import NTRIPPage from './ntripcontroller.jsx'
import AdhocConfig from './adhocwifi.jsx'
import CloudConfig from './cloud.jsx'
import VPN from './vpnconfig.jsx'
import Logout from './logout.jsx'
import UserManagement from './userManagement.jsx'

function AppRouter () {

  return (
    <div id="wrapper" className="d-flex">
      <div id="sidebar-wrapper" className="bg-light border-right">
      <div id="sidebarheading" className="sidebar-heading">Rpanion Web UI</div>
        <div id="sidebar-items" className="list-group list-group-flush">
          <Link className='list-group-item list-group-item-action bg-light' to="/">Home</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/flightlogs">Flight Logs</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/controller">Flight Controller</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/ntrip">NTRIP Config</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/network">Network Config</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/adhoc">Adhoc Wifi Config</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/apclients">Access Point Clients</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/video">Video Streaming</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/cloud">Cloud Upload</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/vpn">VPN Config</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/about">About</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/users">User Management</Link>
          <Link className='list-group-item list-group-item-action bg-light' to="/logoutconfirm">Logout</Link>
        </div>
      </div>

      <div className="page-content-wrapper" style={{ width: '100%' }}>
        <div className="container-fluid">
          <Routes>
            <Route exact path="/" element={<Home />} />
            <Route exact path="/controller" element={<FCConfig />} />
            <Route exact path="/network" element={<NetworkConfig />} />
            <Route exact path="/about" element={<About />} />
            <Route exact path="/video" element={<VideoPage />} />
            <Route exact path="/flightlogs" element={<LogBrowser />} />
            <Route exact path="/apclients" element={<NetworkClients />} />
            <Route exact path="/ntrip" element={<NTRIPPage />} />
            <Route exact path="/adhoc" element={<AdhocConfig />} />
            <Route exact path="/cloud" element={<CloudConfig />} />
            <Route exact path="/vpn" element={<VPN/>} />
            <Route exact path="/logoutconfirm" element={<Logout/>} />
            <Route exact path="/users" element={<UserManagement/>} />
            <Route path="*" element={<NoMatch />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function NoMatch () {
  const location = useLocation();
  return (
    <div>
    <h1>404 - Page Not Found</h1>
    <p>The URL <code>{location.pathname}</code> does not exist.</p>
  </div>
  )
}

export default AppRouter
