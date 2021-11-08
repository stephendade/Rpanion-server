/* eslint-disable no-undef */
var assert = require('assert')
const adhocManager = require('./adhocManager')

describe('Adhoc Manager Functions', function () {
  describe('#getAdapters()', function () {
    it('should get adapter info', function (done) {
      adhocManager.getAdapters((err, netDeviceList, netDeviceSelected, settings) => {
        assert.notEqual(netDeviceList, null)
        assert.equal(netDeviceSelected, null)
        assert.notEqual(settings, null)
        assert.equal(err, null)
        done()
      })
    })
  })
})
