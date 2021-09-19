var assert = require('assert')
var appRoot = require('app-root-path')
const settings = require('settings-store')
const ntrip = require('./ntrip')

describe('NTRIP Functions', function () {
  it('#ntripinit()', function () {
    var ntripClient = new ntrip(settings)

    // check initial status
    assert.equal(ntripClient.options.active, false)
  })

  it('#ntriptryconnect()', function () {
    // Getting starting client with bad details
    var ntripClient = new ntrip(settings)


    //ntripClient.setSettings ("auscors.ga.gov.au", 2101, "MNT", "name", "pwd", true)

    // check initial status
    assert.equal(ntripClient.conStatusStr(), 'Not active')

    //ntripClient.client.xyz = [5000, 5000, 0]
    //ntripClient.status = 3

    //assert.equal(ntripClient.conStatusStr(), 'No RTCM server connection')

    ntripClient.setSettings ("auscors.ga.gov.au", 2101, "MNT", "name", "pwd", false)

    assert.equal(ntripClient.conStatusStr(), 'Not active')

  })
})
