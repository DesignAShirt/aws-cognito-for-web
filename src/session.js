'use strict';

function Session(authToken, profile, store, aws) {
  var privates = {
    authToken: authToken || null,
    profile: profile || {},
    store: store || {},
    aws: aws || {},
  };
  Object.defineProperties(this, {
    setItem: {
      value: function(k, v) {
        privates.store[k] = v;
        this.save();
      },
    },
    getItem: {
      value: function(k) {
        return privates.store[k];
      },
    },

    store: {
      set: function(store) {
        // sync to private store obj
        // delete missing
        for (var k in privates.store) {
          if (!(k in store)) {
            delete privates.store[k];
          }
        }
        // add new
        for (var k in store) {
          privates.store[k] = store[k];
        }
        this.save();
      },

      get: function() {
        return Session.cloneUtility(privates.store);
      },
    },

    profile: {
      get: function() {
        return privates.profile;
      },
      set: function(profile) {
        Object.freeze(profile);
        privates.profile = profile;
        this.save();
      },
    },

    authToken: {
      get: function() {
        return privates.authToken;
      },
      set: function(authToken) {
        privates.authToken = authToken;
        this.save();
      },
    },

    aws: {
      get: function() {
        return privates.aws;
      },
      set: function(aws) {
        privates.aws = aws;
        this.save();
      },
    },
  });
  Object.seal(this);
}

Session.prototype.save = function() {
  Session.storage.setItem(Session.SERIALIZED_TOKEN, JSON.stringify(this));
};

Session.prototype.clear = function() {
  this.authToken = null;
  this.profile = {};
  this.store = {};
  this.aws = {};
};

Session.prototype.toJSON = function() {
  return {
    authToken: this.authToken,
    profile: this.profile,
    store: this.store,
    aws: this.aws,
  };
};

Session.SERIALIZED_TOKEN = 'session';
Session.storage = global.localStorage;

// hacky clone that is good enough for this class
Session.cloneUtility = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};

Session.fromStorage = function() {
  var unserialized = null;
  try {
    unserialized = JSON.parse(Session.storage.getItem(Session.SERIALIZED_TOKEN) || 'null');
  }
  catch(err) {
    console.error(err);
  }
  unserialized = unserialized || {};
  return new Session(unserialized.authToken || null, unserialized.profile || {}, unserialized.store || {}, unserialized.aws || {});
};

module.exports = Session;
