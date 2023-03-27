const assert = require('assert')
const settings = require('settings-store')
const Ntrip = require('./ntrip')
const winston = require('./winstonconfig')(module)

describe('NTRIP Functions', function () {
  it('#ntripinit()', function () {
    settings.clear()
    const ntripClient = new Ntrip(settings, winston)

    // check initial status
    assert.equal(ntripClient.options.active, false)
  })

  it('#ntriptryconnect()', function () {
    // Getting starting client with bad details
    settings.clear()
    const ntripClient = new Ntrip(settings, winston)

    // ntripClient.setSettings ("auscors.ga.gov.au", 2101, "MNT", "name", "pwd", true)

    // check initial status
    assert.equal(ntripClient.conStatusStr(), 'Not active')

    // ntripClient.client.xyz = [5000, 5000, 0]
    // ntripClient.status = 3

    // assert.equal(ntripClient.conStatusStr(), 'No RTCM server connection')

    ntripClient.setSettings('auscors.ga.gov.au', 2101, 'MNT', 'name', 'pwd', false)

    assert.equal(ntripClient.conStatusStr(), 'Not active')
  })
})
