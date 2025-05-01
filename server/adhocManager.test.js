/* eslint-disable no-undef */
const assert = require('assert')
const settings = require('settings-store')
const AdhocManager = require('./adhocManager')

describe('Adhoc Manager Functions', function () {
  describe('#getAdapters()', function () {
    it('should get adapter info', function (done) {
      settings.clear()
      const addhoc = new AdhocManager(settings)
      addhoc.getAdapters((err, netDeviceList, netDeviceSelected, settings) => {
        assert.notEqual(netDeviceList, null)
        // assert.equal(netDeviceSelected, null)
        assert.notEqual(settings, null)
        assert.equal(err, null)
        done()
      })
    })
  })
})
