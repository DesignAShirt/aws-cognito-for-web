'use strict';

require('dotenv').load();

// load required mocks
var mocks = require('./support/mocks.js');

var AWS = require('aws-sdk');

var assert = require('assert');
var Authentication = require('../src/authentication.js');

// cognito pool specifically for these tests
var TEST_COGNITO_POOL = process.env.TEST_COGNITO_POOL;
var TEST_COGNITO_POOL_REGION = process.env.TEST_COGNITO_POOL_REGION;
var TEST_COGNITO_ACCOUNT = process.env.TEST_COGNITO_ACCOUNT;
var TEST_COGNITO_ROLE = process.env.TEST_COGNITO_ROLE;

var ASYNC_DELAY = 50;

var handlerThatThrows = function() {
  throw new Error('Handler should not have been called');
};

describe('Authentication', function() {

  describe('#ctor', function() {
    it('should require options', function() {
      assert.throws(function() {
        var auth = new Authentication();
      });
      assert.throws(function() {
        var auth = new Authentication({
          identityPoolId: 'not real identity pool',
        });
      });
      assert.throws(function() {
        var auth = new Authentication({
          authRoleArn: 'not real role arn',
        });
      });
      assert.throws(function() {
        var auth = new Authentication({
          identityPoolId: 'not real identity pool',
          authRoleArn: 'not real role arn',
        });
      });
      assert.doesNotThrow(function() {
        var auth = new Authentication({
          identityPoolId: 'not real identity pool',
          authRoleArn: 'not real role arn',
          providerEndpoint: 'not a real provider',
        });
      });
    });

    it('should accept the auth token as an option', function() {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
        existingAuthToken: fakeToken,
      });
      assert.strictEqual(auth.credentials.params.Logins[fakeEndpoint], fakeToken);
    });

    it('should parse the region from the identityPoolId', function() {
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: TEST_COGNITO_POOL,
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
      });
      assert.strictEqual(AWS.config.region, TEST_COGNITO_POOL_REGION);
    });

    // it('should parse the account id from the auth role arn', function() {
    //   var auth = new Authentication({
    //     identityPoolId: 'not real identity pool',
    //     authRoleArn: TEST_COGNITO_ROLE,
    //   });
    //   assert.strictEqual(auth.credentials.params.AccountId, TEST_COGNITO_ACCOUNT);
    // });

    it('should set the AWS credentials', function() {
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
      });
      assert.strictEqual(auth.credentials, AWS.config.credentials);
    });

    it('should not emit non-ready events until initialized even if token included in instantiation', function(done) {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
        existingAuthToken: fakeToken,
      });
      var mock = mocks.mock(auth.credentials, 'get', function(callback) {
        setTimeout(function() {
          callback();
        }, ASYNC_DELAY);
      });
      var before = function(handler) {
        return function() {
          mock.cleanup();
          handler();
        };
      };
      // overwrite emit to catch calls
      auth.emit = before(handlerThatThrows);
      // give events time to fire
      setTimeout(function() {
        auth.emit = before(done);
        auth.init();
      }, 10);
    });

    it('should not emit until initialized', function(done) {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
      });
      var mock = mocks.mock(auth.credentials, 'get', function(callback) {
        setTimeout(function() {
          callback();
        }, ASYNC_DELAY);
      });
      var before = function(handler) {
        return function() {
          mock.cleanup();
          handler();
        };
      };
      // overwrite emit to catch calls
      auth.emit = before(handlerThatThrows);
      // give events time to fire
      setTimeout(function() {
        auth.emit = before(done);
        auth.init();
      }, 10);
    });

    it('should accept a session in config', function() {
      var session = new Authentication.Session();
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
        session: session,
      });
      assert.strictEqual(auth.session, session);
    });

    it('should only accept correct type of session', function() {
      assert.throws(function() {
        var auth = new Authentication({
          identityPoolId: 'not real identity pool',
          authRoleArn: 'not real role arn',
          providerEndpoint: 'not a real provider',
          session: {},
        });
      });
    });

    it('should have a confirmedAuthEventsOnly flag', function(done) {
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
        confirmedAuthEventsOnly: true,
      });
      auth.on('authenticated', handlerThatThrows);
      auth.on('deauthenticated', handlerThatThrows);
      auth.on('ready', handlerThatThrows);
      auth._onAuth();
      auth._onDeauth();
      auth.removeAllListeners();
      auth.on('deauthenticated', done);
      auth._initialized = true;
      auth._ready = true;
      auth._onDeauth();
    });

    it('should optionally emit ready event', function(done) {
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
        emitReadyEvent: false,
      });
      auth.on('ready', handlerThatThrows);
      auth._authHandler();
      var auth2 = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
        emitReadyEvent: true,
      });
      auth2.on('ready', done);
      auth2._authHandler();
    });
  });

  describe('#_onAuth', function() {
    it('should emit authenticated event', function(done) {
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
      });
      auth.on('authenticated', done);
      auth.on('deauthenticated', handlerThatThrows);
      auth._onAuth();
    });

    it('should propagate the authToken to the session if it exists');
  });

  describe('#_onDeauth', function() {
    it('should emit deauthenticated event', function(done) {
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
      });
      auth.on('authenticated', handlerThatThrows);
      auth.on('deauthenticated', done);
      auth._onDeauth();
    });

    it('should pass through error', function(done) {
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
      });
      auth.on('authenticated', handlerThatThrows);
      auth.once('deauthenticated', function(err) {
        assert.ifError(err);
        auth.once('deauthenticated', function(err) {
          console.log(err);
          assert.strictEqual(true, err instanceof Error);
          done();
        });
        auth._onDeauth(new Error());
      });
      auth._onDeauth();
    });

    it('should clear the session on deauth if it exists');
  });

  describe('#_authHandler', function() {
    it('should emit authenticated when no error is received', function(done) {
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        providerEndpoint: 'not a real provider',
        authRoleArn: 'not real role arn',
      });
      auth.on('authenticated', done);
      auth.on('deauthenticated', handlerThatThrows);
      auth._authHandler();
    });
    it('should emit deauthenticated when an error is received', function(done) {
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
      });
      auth.on('authenticated', handlerThatThrows);
      auth.on('deauthenticated', function(err) {
        assert.strictEqual(true, err instanceof Error);
        done();
      });
      auth._authHandler(new Error());
    });
  });

  describe('#setAuthToken', function() {
    it('should store the token in the provider', function() {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
      });
      auth.setAuthToken(fakeToken);
      assert.strictEqual(auth.credentials.params.Logins[fakeEndpoint], fakeToken);
    });
  });

  describe('#getAuthToken', function() {
    it('should get the token from the provider', function() {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
      });
      auth.setAuthToken(fakeToken);
      assert.strictEqual(auth.getAuthToken(), fakeToken);
      auth.providerEndpoint = 'cause.getAuthToken.to.return.undefined';
      assert.strictEqual(auth.getAuthToken(), void 0);
    });
  });

  describe('#init', function() {
    it('should deauthenticated if init and no auth token', function(done) {
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: 'not a real provider',
      });
      var mock = mocks.mock(auth.credentials, 'get', function(callback) {
        setTimeout(function() {
          callback();
        }, ASYNC_DELAY);
      });
      var before = function(handler) {
        return function() {
          mock.cleanup();
          handler();
        };
      };
      auth.on('authenticated', before(handlerThatThrows));
      auth.on('deauthenticated', before(done));
      auth.init();
    });

    it('should authenticate with cognito', function(done) {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
        existingAuthToken: fakeToken,
      });
      var mock = mocks.mock(auth.credentials, 'get', function(callback) {
        setTimeout(function() {
          auth.setAuthToken()
          callback();
        }, ASYNC_DELAY);
      });
      var before = function(handler) {
        return function() {
          mock.cleanup();
          handler();
        };
      };
      auth.on('authenticated', before(done));
      auth.on('deauthenticated', before(handlerThatThrows));
      auth.init();
    });

    it('should deauthenticate with cognito', function(done) {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
        existingAuthToken: fakeToken,
      });
      var mock = mocks.mock(auth.credentials, 'get', function(callback) {
        // aws is async
        setTimeout(function() {
          callback(new Error()); // simulates cognito timeout or whatever
        }, ASYNC_DELAY);
      });
      var before = function(handler) {
        return function() {
          mock.cleanup();
          handler();
        };
      };
      auth.on('authenticated', before(handlerThatThrows));
      auth.on('deauthenticated', before(done));
      auth.init();
    });

    it('should allow auth after a deauth', function(done) {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
      });
      var mock = mocks.mock(auth.credentials, 'refresh', function(callback) {
        // aws is async
        setTimeout(function() {
          callback();
        }, ASYNC_DELAY);
      });
      var before = function(handler) {
        return function() {
          mock.cleanup();
          handler();
        };
      };
      auth.on('authenticated', before(function() {
        assert.strictEqual(auth.credentials.params.Logins[fakeEndpoint], fakeToken);
        done();
      }));
      auth.on('deauthenticated', function() {
        auth.open(fakeToken);
      });
      auth.init();
    });
  });

  describe('#open', function() {
    it('should take an authToken and refresh cognito', function(done) {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
      });
      var mock = mocks.mock(auth.credentials, 'refresh', function(callback) {
        setTimeout(function() {
          callback();
        }, ASYNC_DELAY);
      });
      var before = function(handler) {
        return function() {
          mock.cleanup();
          handler();
        };
      };
      auth.on('authenticated', before(done));
      auth.on('deauthenticated', before(handlerThatThrows));
      auth.open(fakeToken);
      assert.strictEqual(auth.credentials.params.Logins[fakeEndpoint], fakeToken);
    });
    it('should fail when refreshing cognito', function(done) {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
      });
      var mock = mocks.mock(auth.credentials, 'refresh', function(callback) {
        setTimeout(function() {
          callback(new Error());
        }, ASYNC_DELAY);
      });
      var before = function(handler) {
        return function() {
          mock.cleanup();
          handler();
        };
      };
      auth.on('authenticated', before(handlerThatThrows));
      auth.on('deauthenticated', before(done));
      auth.open(fakeToken);
      assert.strictEqual(auth.credentials.params.Logins[fakeEndpoint], fakeToken);
    });
  });

  describe('#close', function() {
    it('should clear the authToken and refresh cognito', function(done) {
      var fakeToken = 'fake123';
      var fakeEndpoint = 'not.real.example';
      var auth = new Authentication({
        identityPoolId: 'not real identity pool',
        authRoleArn: 'not real role arn',
        providerEndpoint: fakeEndpoint,
      });
      var mock = mocks.mock(auth.credentials, 'refresh', function(callback) {
        setTimeout(function() {
          callback(new Error()); // fake cognito error response
        }, ASYNC_DELAY);
      });
      var before = function(handler) {
        return function() {
          mock.cleanup();
          handler();
        };
      };
      auth.on('authenticated', before(handlerThatThrows));
      auth.on('deauthenticated', before(done));
      auth.setAuthToken(fakeToken);
      assert.strictEqual(auth.credentials.params.Logins[fakeEndpoint], fakeToken);
      auth.close();
      assert.strictEqual(auth.credentials.params.Logins[fakeEndpoint], null);
    });
  });

});
