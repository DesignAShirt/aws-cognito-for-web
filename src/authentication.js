'use strict';

var util = require('util')
  , EventEmitter = require('events');

var AWS = require('aws-sdk');

var Session = require('./session.js');

function AuthenticationClient(config) {
  EventEmitter.call(this);
  if (!config) throw new Error('First arg should be options. Required: identityPoolId, authRoleArn');
  if (!config.identityPoolId || !config.authRoleArn) throw new Error('Requires both identityPoolId and authRoleArn');
  if (!config.providerEndpoint) throw new Error('Requires a providerEndpoint');
  if (config.session && !(config.session instanceof Session)) throw new Error('Session passed in config is not an instance of Authentication.Session');
  this.session = config.session || null;
  this.providerEndpoint = config.providerEndpoint;
  var logins = {};
  logins[this.providerEndpoint] = config.existingAuthToken || null;
  this.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: config.identityPoolId,
    RoleArn: config.authRoleArn,
    Logins: logins
  });
  AWS.config.region = config.identityPoolId.split(':')[0];
  AWS.config.update({
    credentials: this.credentials,
  });
  this.emitReadyEvent = config.emitReadyEvent || false;
  this.confirmedAuthEventsOnly = config.confirmedAuthEventsOnly || false;
  this._initialized = false;
  this._ready = false;
}

util.inherits(AuthenticationClient, EventEmitter);

AuthenticationClient.prototype._onAuth = function() {
  if (this.session) {
    this._persistTokensToSession();
  }
  this._onReady();
  if (this._initialized || !this.confirmedAuthEventsOnly) {
    setTimeout(this.emit.bind(this), 0, 'authenticated');
  }
};

AuthenticationClient.prototype._onDeauth = function(err) {
  if (this.session) {
    this.session.clear();
  }
  this._onReady();
  if (this._initialized || !this.confirmedAuthEventsOnly) {
    setTimeout(this.emit.bind(this), 0, 'deauthenticated', err);
  }
};

AuthenticationClient.prototype._onReady = function() {
  if (this._ready) return;
  this._ready = true;
  if (this.emitReadyEvent) {
    setTimeout(this.emit.bind(this), 0, 'ready');
  }
};

AuthenticationClient.prototype._authHandler = function(err) {
  var _this = this;
  if (err) {
    _this._onDeauth(err);
    return;
  }
  _this._onAuth();
};

AuthenticationClient.prototype._persistTokensToSession = function() {
  var credentials = this.credentials || {};
  this.session.authToken = this.getAuthToken();
  if (AuthenticationClient.validateAwsCredentials(credentials)) {
    this.session.aws = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      updatedAt: new Date().getTime(),
    };
  }
  else {
    this.session.aws = {};
  }
};

AuthenticationClient.prototype.setAuthToken = function(authToken) {
  this.credentials.params.Logins[this.providerEndpoint] = authToken;
};

AuthenticationClient.prototype.getAuthToken = function() {
  return this.credentials.params.Logins[this.providerEndpoint];
};

AuthenticationClient.prototype.init = function() {
  var _this = this;
  if (this.getAuthToken()) {
    if (this.session && AuthenticationClient.validateAwsCredentials(this.session.aws)) { // resume cached session
      this.credentials.accessKeyId = this.session.aws.accessKeyId;
      this.credentials.secretAccessKey = this.session.aws.secretAccessKey;
      this.credentials.sessionToken = this.session.aws.sessionToken;
      this._onAuth();
    }
    // get updated credentials either way
    this.credentials.get(function(err) {
      _this._initialized = true;
      _this._authHandler(err);
    });
  }
  else {
    this._initialized = true;
    this._onDeauth();
  }
};

AuthenticationClient.prototype.open = function(authToken) {
  this.setAuthToken(authToken);
  this.credentials.refresh(this._authHandler.bind(this));
};

AuthenticationClient.prototype.close = function() {
  this.setAuthToken(null);
  this.credentials.clearCachedId();
  this.credentials.refresh(this._authHandler.bind(this));
};

AuthenticationClient.prototype.isAuthenticated = function() {
  if (this.getAuthToken()) {
    return AuthenticationClient.validateAwsCredentials(this.credentials);
  }
  else {
    return false;
  }
};

AuthenticationClient.validateAwsCredentials = function(credentials) {
  credentials = credentials || {};
  return 'accessKeyId' in credentials && 'secretAccessKey' in credentials && 'sessionToken' in credentials;
}

// deprecated in favor of AuthenticationClient.resumeSession
AuthenticationClient.webFactory = function(config, storageKey) {
  storageKey = storageKey || 'authToken';
  config.existingAuthToken = config.existingAuthToken || AuthenticationClient.webFactory.readStorage(storageKey);
  var authClient = new AuthenticationClient(config);
  authClient.on('authenticated', function() {
    AuthenticationClient.webFactory.writeStorage(storageKey, authClient.getAuthToken());
  });
  authClient.on('deauthenticated', function() {
    AuthenticationClient.webFactory.writeStorage(storageKey, null);
  });
  return authClient;
};

AuthenticationClient.webFactory.readStorage = function(storageKey) {
  var token = null;
  try {
    token = JSON.parse(global.localStorage.getItem(storageKey) || 'null') || null;
  }
  catch (err) {
    token = null;
  }
  return token && typeof token === 'string' ? token : null;
};

AuthenticationClient.webFactory.writeStorage = function(storageKey, authToken) {
  if (authToken && typeof authToken === 'string') {
    global.localStorage.setItem(storageKey, JSON.stringify(authToken));
  }
  else {
    global.localStorage.removeItem(storageKey);
  }
};

AuthenticationClient.Session = Session;
AuthenticationClient.resumeSession = function(config) {
  config.session = config.session || Session.fromStorage();
  config.existingAuthToken = config.existingAuthToken || config.session.authToken;
  var authClient = new AuthenticationClient(config);
  return authClient;
};

module.exports = AuthenticationClient;
