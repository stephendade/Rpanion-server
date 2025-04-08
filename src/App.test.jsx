// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client'
import React from 'react'
import { describe, test } from 'vitest'

import About from './about.jsx'
import Home from './home.jsx'
import NetworkConfig from './networkconfig.jsx'
import Video from './video.jsx'
import FCConfig from './flightcontroller.jsx'
import LogBrowser from './logBrowser.jsx'
import NTRIPPage from './ntripcontroller.jsx'
import AdhocConfig from './adhocwifi.jsx'
import CloudConfig from './cloud.jsx'
import UserManagement from './userManagement.jsx'

describe('#apptest()', function () {
  test('homepage renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<Home />)
    root.unmount()
  })

  test('about page renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<About />)
    root.unmount()
  })

  test('networkconfig page renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<NetworkConfig />)
    root.unmount()
  })

  test('video page renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<Video />)
    root.unmount()
  })

  test('flightcontroller page renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<FCConfig />)
    root.unmount()
  })

  test('logging page renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<LogBrowser />)
    root.unmount()
  })

  test('ntrip page renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<NTRIPPage />)
    root.unmount()
  })

  test('adhoc page renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<AdhocConfig />)
    root.unmount()
  })

  test('cloud page renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<CloudConfig />)
    root.unmount()
  })

  test('user page renders without crashing', function () {
    const div = document.createElement('div')
    const root = createRoot(div)
    root.render(<UserManagement />)
    root.unmount()
  })
})