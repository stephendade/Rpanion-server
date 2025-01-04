const assert = require('assert')
// Import dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const app = require('./index')

// Configure chai
chai.use(chaiHttp)
chai.should()

describe('Express server', function () {
  // Test the GET / endpoint
  describe('GET /', function () {
    it('should return a 200 status code', function (done) {
      chai.request(app)
        .get('/')
        .set('Accept', 'application/json')
        .end(function (err, res) {
          assert.equal(res.status, 200)
          assert.equal(err, null)
          done()
        })
    })
  })

  // Test that unauthorized users cannot access the /users endpoint
  describe('GET /users nonauth', function () {
    it('should return a 401 status code', function (done) {
      chai.request(app)
        .get('/users')
        .set('Accept', 'application/json')
        .end(function (err, res) {
          assert.equal(res.status, 401)
          assert.equal(err, null)
          done()
        })
    })
  })

  // Test that login works
  describe('POST /login', function () {
    it('should return a 200 status code', function (done) {
      chai.request(app)
        .post('/login')
        .send({ username: 'admin', password: 'admin' })
        .set('Accept', 'application/json')
        .end(function (err, res) {
          assert.equal(res.status, 200)
          assert.equal(err, null)
          done()
        })
    })
  })

})
