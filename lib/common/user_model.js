/* @flow weak */
/*global self, _, React */
"use strict";

var Connection, Connections,
  flux = require("flukes"),
  utils = require("../utils"),
  context = self.AudioContext && new self.AudioContext(),
  visualizer = flux.createActions({
    visualize: function (width) {return width;}
  });


/**
 * @param {Object} data
 * @constructor
 */
Connection = flux.createModel({
  modelName: "Connection",
  fieldTypes: {
    id: flux.FieldTypes.number,
    path: flux.FieldTypes.string,
    bufId: flux.FieldTypes.number,
    client: flux.FieldTypes.string,
    platform: flux.FieldTypes.string,
    version: flux.FieldTypes.string,
    connected: flux.FieldTypes.bool,
    isMe: flux.FieldTypes.bool,
    // B&W thumbnail
    image: flux.FieldTypes.object.defaults(null),
    // Video or audio stream if chatting
    streamURL: flux.FieldTypes.string,
    audioOnly: flux.FieldTypes.bool,
    inVideoChat: flux.FieldTypes.bool,
    screenStreamURL: flux.FieldTypes.string
  },
  init: function () {
    this.visualizer = new visualizer();
  },
  visualizer: null,
  jsProcessor: null,
  onSoundEvent: function (analyser, event) {
    var data = new Uint8Array(analyser.frequencyBinCount),
      max = 0;
    analyser.getByteFrequencyData(data);
    if (!data.length) {
      return;
    }
    _.each(data, function (frame) {
      max = Math.max(max, frame);
    });
    max = max / 2.55;
    this.visualizer.visualize(Math.min(max, 100));
  },
  stopStream: function () {
    if (this.jsProcessor) {
      this.jsProcessor.disconnect();
    }
    this.jsProcessor = null;
  },
  processStream: function (stream) {
    var analyser, audioSource, jsProcessor;
    if (!self.AudioContext) {
      return;
    }
    if (!context || !context.createAnalyser || !context.createScriptProcessor) {
      console.log("Browser has no audio analyser.");
      return;
    }
    console.log("begin audio thing");
    audioSource = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser();
    analyser.fftSize = 32;
    analyser.smoothingTimeConstant = 0.5;
    jsProcessor = context.createScriptProcessor(1024, 1, 1);
    jsProcessor.onaudioprocess = this.onSoundEvent.bind(this, analyser);
    audioSource.connect(analyser);
    analyser.connect(jsProcessor);
    jsProcessor.connect(context.destination);
    this.stopStream();
    this.jsProcessor = jsProcessor;
  },
  handleUserImage: function (image) {
    var imageData,
      i,
      offset, clampedArray;

    if (!image) {
      this.image = null;
      return;
    }

    if (!self.document) {
      // We're in a web worker
      return;
    }
    var canvas = document.createElement("canvas");
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      return;
    }
    var ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    imageData = ctx.createImageData(image.width, image.height);
    if (utils.Uint8ClampedArray) {
      clampedArray = new utils.Uint8ClampedArray(image.data);
    } else {
      clampedArray = image.data;
    }
    for (i = 0; i < image.data.length; i++) {
      offset = i * 4;
      imageData.data[offset] = clampedArray[i];
      imageData.data[offset + 1] = clampedArray[i];
      imageData.data[offset + 2] = clampedArray[i];
      imageData.data[offset + 3] = 255; // Alpha channel.
    }
    this.image = imageData;
  }
});

/**
 * @param {Object} data
 * @constructor
 */
Connections = flux.createCollection({
  modelName: "Connections",
  model: Connection,
  sort: function (a, b) {
    // Web clients (ones with video chat) at the top, otherwise highest conn id wins
    var aIsWeb = a.client === "web",
      bIsWeb = b.client === "web";

    if (a.image && !b.image) {
      return -1;
    }
    if (b.image && !a.image) {
      return 1;
    }
    if (aIsWeb && !bIsWeb) {
      return -1;
    }
    if (bIsWeb && !aIsWeb) {
      return 1;
    }
    if (a.id > b.id) {
      return -1;
    }
    return 1;
  }
});

function User () {
  User.super_.apply(this, arguments);
}


flux.inherit(User, flux.createModel({
  modelName: "User",
  fieldTypes: {
    connections: Connections,
    id: flux.FieldTypes.string,
    permissions: flux.FieldTypes.list,
    isMe: flux.FieldTypes.bool,
    client: flux.FieldTypes.string,
    platform: flux.FieldTypes.string,
    isAnon: flux.FieldTypes.bool,
    version: flux.FieldTypes.string,
    gravatar: flux.FieldTypes.string,
  },
  getDefaultFields: function () {
    return {
      isAnon: true,
      permissions: new flux.List(),
      connections: new Connections()
    };
  }
}));

Object.defineProperty(User.prototype, "color", {
  get: function id() {
    if (this.color_) {
      return this.color_;
    }
    this.color_ = utils.userColor(this.id);
    return this.color_;
  }
});

Object.defineProperty(User.prototype, "isAdmin", {
  get: function isAdmin () {
    return this.permissions.indexOf("kick") !== -1;
  }
});

Object.defineProperty(User.prototype, "username", {
  get: function getUsername() {
    return this.id;
  }
});

/**
 * @returns {number}
 */
User.prototype.getConnectionID = function () {
  var conn = this.connections.valueOf()[0];
  return conn && conn.id;
};

/**
 * @param {number} connectionId
 * @param {string} client
 * @param {string} platform
 * @param {string} version
 * @returns {{id: (number), path: string, bufId: number, client: string, platform: string, version: string, connected: boolean}}
 */
User.prototype.createConnection = function (connectionId, client, platform, version, isMe) {
  this.connections.add(new Connection({
    id: connectionId,
    path: "",
    bufId: 0,
    client: client,
    platform: platform,
    version: version,
    connected: true,
    isMe: isMe,
    inVideoChat: false,
  }));
};

User.prototype.getMyConnection = function () {
  var conn = _.find(this.connections.valueOf(), function (conn) {
    return conn.isMe;
  });
  return conn && this.connections.get(conn.id);
};

/**
 * @param {Object} data
 * @extends {flux.DataModel}
 * @constructor
 *
 */
function Users (data) {
  Users.super_.apply(this, arguments);
}

flux.inherit(Users, flux.createCollection({
  modelName: "Users",
  model: User,
}));

/**
 * @param {number} connectionId
 * @return {User}
 */
Users.prototype.getByConnectionID = function (connectionId) {
  return _.find(this.data.collection, function (user) {
    return user.connections.get(connectionId);
  });
};

Users.prototype.getConnectionByConnectionID = function (connectionId) {
  var user = this.getByConnectionID(connectionId);
  return user && user.connections.get(connectionId);
};

module.exports = {
  User: User,
  Users: Users
};
