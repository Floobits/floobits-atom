"use strict";

const _ = require("lodash");
const flux = require("flukes");

const floop = require("./floop");
const utils = require("./utils");
const editorAction = require("./editor_action");

let context = null;
try {
  context = window.AudioContext && new window.AudioContext();
} catch (e) {
  console.log("Unable to create context.", e);
}
const Visualizer = flux.createActions({
  visualize: function (width) { return width; }
});


const Connection = flux.createModel({
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
    this.visualizer = new Visualizer();
  },
  visualizer: null,
  jsProcessor: null,
  stream: null,
  screenStream: null,
  isWeb: function () {
    return _.includes(utils.BROWSER_CLIENTS, this.client);
  },
  onSoundEvent: function (analyser) {
    var data = new Uint8Array(analyser.frequencyBinCount),
      max = 0;
    analyser.getByteFrequencyData(data);
    if (!data.length) {
      return;
    }
    _.each(data, function (frame) {
      max = Math.max(max, frame);
    });
    max = max / 7.96875; // 255 / 32
    this.visualizer.visualize(Math.min(max, 32));
  },
  stopStream: function () {
    if (this.jsProcessor) {
      this.jsProcessor.disconnect();
    }
    this.jsProcessor = null;
  },
  processStream: function (stream) {
    if (!context || !context.createAnalyser || !context.createScriptProcessor) {
      console.log("Browser has no audio analyser.");
      return;
    }
    console.log("begin audio thing");
    let audioSource = null;
    try {
      audioSource = context.createMediaStreamSource(stream);
    } catch (e) {
      console.log("Unable to create media stream source.", e);
      return;
    }
    const analyser = context.createAnalyser();
    analyser.fftSize = 32;
    analyser.smoothingTimeConstant = 0.3;
    const jsProcessor = context.createScriptProcessor(2048, 1, 1); // buffer size, input channels, output channels
    jsProcessor.onaudioprocess = this.onSoundEvent.bind(this, analyser);
    audioSource.connect(analyser);
    analyser.connect(jsProcessor);
    jsProcessor.connect(context.destination);
    this.stopStream();
    this.jsProcessor = jsProcessor;
  }
});

const Connections = flux.createCollection({
  modelName: "Connections",
  model: Connection,
  sort: function (a, b) {
    // Web clients (ones with video chat) at the top, otherwise highest conn id wins
    var aIsWeb = a.isWeb(),
      bIsWeb = b.isWeb();

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
    can_contract: flux.FieldTypes.bool,
    rate: flux.FieldTypes.number,
    gravatar: flux.FieldTypes.string,
  },
  init: function (args) {
    if (args && args.color_) {
      this.color_ = args.color_;
    }
  },
  color_: null,
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
    this.color_ = utils.user_color(this.id);
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

User.prototype.getConnectionID = function () {
  var conn = this.connections.valueOf()[0];
  return conn && conn.id;
};

User.prototype.createConnection = function (connectionId, client, platform, version, isMe) {
  var conn = new Connection({
    id: connectionId,
    path: "",
    bufId: 0,
    client: client,
    platform: platform,
    version: version,
    connected: true,
    isMe: isMe,
    inVideoChat: false,
  });
  this.connections.add(conn);
  return conn;
};

User.prototype.kick = function () {
  this.connections.forEach(function (conn) {
    console.log("kicking", conn);
    editorAction.kick(conn.id);
  });
};

User.prototype.getMyConnection = function () {
  var conn = _.find(this.connections.valueOf(), function (c) {
    return c.isMe;
  });
  return conn && this.connections.get(conn.id);
};

function Users () {
  Users.super_.apply(this, arguments);
  floop.onDATAMSG(function (msg) {
    if (msg.data.name === "user_image") {
      const user = this.getByConnectionID(msg.user_id);
      if (!user) {
        return;
      }
      user.connections.get(msg.user_id).image = msg.data.image;
    }
  }, this);
}

flux.inherit(Users, flux.createCollection({
  modelName: "Users",
  model: User
}));

Users.prototype.getByConnectionID = function (connectionId) {
  return _.find(this.data.collection, function (user) {
    return user.connections.get(connectionId);
  });
};

Users.prototype.getConnectionByConnectionID = function (connectionId) {
  var user = this.getByConnectionID(connectionId);
  return user && user.connections.get(connectionId);
};

Users.prototype.broadcast_data_message_for_perm = function (datamsg, perm) {
  const ids = [];
  this.forEach(function (user) {
    user.connections.forEach(function (conn) {
      if (!conn.isMe && _.includes(utils.BROWSER_CLIENTS, conn.client) && user.permissions.indexOf(perm) > -1) {
        ids.push(conn.id);
      }
    });
  });

  if (!ids.length) {
    return;
  }

  floop.emitDataMessage(datamsg, ids);
};

module.exports = {
  User,
  Users,
};
