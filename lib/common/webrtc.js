/*global URL, navigator */
"use strict";

const _ = require("lodash");

const getUserMedia = require("./extern/webrtc/get_user_media");
const webrtcsupport = require("./extern/webrtc/webrtc_support");
const PeerConnection = require("./extern/webrtc/peer_connection");
const ExtMessaging = require("./ext_messaging");
const SoundEffects = require("./sound_effects");

const Socket = require("./floop");
// TODO: replace Modal
const Modal = require("../modal");
// const handlerAction = require("./editor/handler_action");
const messageAction = require("./message_action");
const webrtcAction = require("./webrtc_action");
const perms = require("./permission_model");
const prefs = require("./userPref_model");

// ExtMessaging.init();

const mediaConstraints = {
  video: {
    audio: {
      optional: [],
    },
    video: { optional: [
      { facingMode: "user" },
      { maxWidth: 228 },
      { maxHeight: 228 },
    ]}
  },
  audio: {
    audio: {
      optional: [],
    },
    optional: [{chromeRenderToAssociatedSink: true}],
  },
  screen: {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: null,
        // TODO: allow bigger screen sharing? some desktops are 2560x1440
        maxWidth: 1920,
        maxHeight: 1080,
      },
      optional: [
        // Don't waste bandwidth/CPU sending screen updates. Our users aren't playing CounterStrike.
        { maxFrameRate: 10 }
      ]
    }
  }
};

const connConfig = {
  debug: false,
  iceServers: [
    { url: "stun:stun.l.google.com:19302" },
    { url: "turns:turn.floobits.com:5349",
      username: "floobits",
      credential: "stiboolf",
    },
  ],
  limits: {
    audio: 128,
    video: 256
  },
  sdpHack: true
};

const connConstraints = {
  optional: [
    { DtlsSrtpKeyAgreement: true },
    { RtpDataChannels: true }
  ]
};

function WebRTC (users, me, isChat) {
  const self = this;
  this.users = users;
  this.me = me;
  this.isChat = isChat;
  this.down_peers_ = {};
  this.up_peers_ = {};
  this.commStream = null;
  this.screenStream = null;
  this.partedUsers = {};
  this.hasAudio = false;
  this.hasVideo = false;

  function enableMedia(sources) {
    sources.forEach(function (source) {
      if (source.kind.indexOf("audio") !== -1) {
        self.hasAudio = true;
      }
      if (source.kind.indexOf("video") !== -1) {
        self.hasVideo = true;
      }
    });
    console.log("has audio:", self.hasAudio);
    console.log("has video:", self.hasVideo);
  }
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices().then(enableMedia);
  } else if (window.MediaStreamTrack && MediaStreamTrack.getSources) {
    MediaStreamTrack.getSources(enableMedia);
  } else {
    this.hasAudio = true;
    this.hasVideo = true;
  }

  this.soundEffects = true;

  Socket.onWEBRTC(_.bind(this.handleMsg_, this));
  Socket.onPART(_.bind(this.handlePart_, this));

  webrtcAction.onSTART_VIDEO_CHAT(this.startVideo, this);
  webrtcAction.onSTOP_VIDEO_CHAT(this.stopVideo, this);

  webrtcAction.onSTART_AUDIO_CHAT(this.startAudio, this);
  webrtcAction.onSTOP_AUDIO_CHAT(this.stopAudio, this);

  webrtcAction.onSTART_SCREEN(this.startScreen, this);
  webrtcAction.onSTOP_SCREEN(this.stopScreen, this);

  prefs.on(() => {
    if (!prefs.dnd) {
      return;
    }
    if (this.commStream || this.screenStream) {
      messageAction.info("Stopping video chat because you enabled Do Not Disturb.");
    }
    this.stopUserMedia();
  });

  Socket.onROOM_INFO((roomInfo) => {
    // Mute initial join sounds for those who can't send their own video
    if (_.includes(roomInfo.perms, "patch")) {
      return;
    }
    this.soundEffects = false;
    setTimeout(() => {
      this.soundEffects = true;
    }, 4000);
  });

  Socket.onJOIN((connectionInfo) => {
    if (!this.commStream && !this.screenStream) {
      return;
    }
    Socket.send_webrtc({
      action: "marco",
      data: this.myStreams(),
      to: [connectionInfo.user_id],
    });
  });
}

WebRTC.prototype.gotUserMedia_ = function (type, users, err, stream) {
  var err_msg,
    myConnId = this.myConnId_();

  if (_.isArray(users)) {
    users = _.filter(users, function (u) {
      return u !== myConnId;
    });
  }

  if (err) {
    console.error("WebRTC error!", err);
    if (err.name) {
      err = err.name;
    }
    if (type === "screen") {
      err_msg = "Please read our <a href=\"/help/webrtc#screenshare\" target=\"_blank\">guide to setting up WebRTC screen sharing</a>.";
    } else {
      if (err === "DevicesNotFoundError") {
        err_msg = "Could not detect camera or microphone.";
      } else {
        err_msg = "Please read our <a href=\"/help/webrtc\" target=\"_blank\">guide to setting up WebRTC</a>.";
      }
    }
    Modal.showWithUnsafeHTML("Error activating WebRTC: " + err + "\n<br />" + err_msg);
    return;
  }
  if (type === "screen") {
    this.screenStream = stream;
  } else if (type === "video" || type === "audio") {
    this.commStream = stream;
  }
  stream._streamType = type;
  if (users) {
    Socket.send_webrtc({
      action: "start",
      data: this.myStreams(),
      to: users,
    });
  }
  // NOTE: this goes to some of the people above
  Socket.send_webrtc({
    action: "marco",
    data: this.myStreams(),
    to: [],
  });
  stream.onended = _.bind(this.stopStream, this, stream, type);
  // me = fl.ed.room_info.users[myConnId];
  this.addStream_(this.me.getMyConnection(), stream, type);
};

WebRTC.prototype.myConnId_ = function () {
  return this.me.getMyConnection().id;
};

WebRTC.prototype.log_ = function (otherConnId, msg) {
  var otherUser;
  otherUser = this.users.getByConnectionID(otherConnId);
  if (!otherUser) {
    return;
  }
  msg = otherUser.id + msg;
  messageAction.info(msg, true);
};

WebRTC.prototype.handlePolo_ = function (otherConnId, streams) {
  var self = this, otherUser;
  if (!self.commStream && !self.screenStream) {
    return;
  }
  console.log("Handling webrtc polo from", otherConnId);
  otherUser = this.users.getByConnectionID(otherConnId);
  if (!otherUser) {
    console.log("No user for conn id", otherConnId);
    return;
  }
  _.each(streams, function (type) {
    delete self.partedUsers[otherConnId + "_" + type];
    self.createNewOffer_(otherConnId, type);
  });
};

WebRTC.prototype.myStreams = function () {
  var streams = [];
  if (this.commStream) {
    streams.push(this.commStream._streamType);
  }
  if (this.screenStream) {
    streams.push(this.screenStream._streamType);
  }
  return streams;
};

WebRTC.prototype.sendReject = function (username, otherUserId) {
  var reason;
  if (prefs.dnd) {
    messageAction.info(`Rejected ${username}’s video chat because you enabled Do Not Disturb.`, true);
    reason = "Do Not Disturb on";
  } else if (!webrtcsupport.PeerConnection) {
    messageAction.info(`Rejected ${username}’s video chat because your browser doesn’t support WebRTC.`, true);
    reason = "Peer's browser doesn't support WebRTC.";
  } else if (perms.indexOf("patch") === -1) {
    messageAction.info(`Rejected ${username}’s video chat because you don’t have edit permission.`, true);
    reason = "User does not have edit permission.";
  }
  Socket.send_webrtc({
    action: "reject",
    data: reason,
    to: [otherUserId],
  });
};

WebRTC.prototype.handleMarco_ = function (otherUserId, streams) {
  var self = this, username;

  if (prefs.dnd || !webrtcsupport.PeerConnection) {
    username = this.users.getByConnectionID(otherUserId).id;
    this.sendReject(username, otherUserId);
    return;
  }

  if (this.isChat && _.size(this.myStreams()) === 0) {
    return;
  }

  Socket.send_webrtc({
    action: "polo",
    data: this.myStreams(),
    to: [otherUserId],
  });
  _.each(streams, function (type) {
    // XXX: not sure if we should be delete this
    delete self.partedUsers[otherUserId + "_" + type];
    self.createNewOffer_(otherUserId, type);
  });
};

WebRTC.prototype.createNewOffer_ = function (connId, type) {
  var pc;
  pc = this.setupPeer_(this.down_peers_, connId, type);
  if (pc.sent_offer) {
    console.log("PeerConnection offer for user", connId, type, "has already been sent");
    return;
  }
  this.log_(connId, " is connecting to your video chat.");
  pc.on("close", _.bind(this.handleClosedConnection_, this, connId, type));
  // TODO: kill sent_offer? probably not
  pc.sent_offer = true;

  pc.offer(function (err, sdp) {
    if (err) {
      console.error("sessionDescription error", err.toString());
      return;
    }
    Socket.send_webrtc({
      action: "offer_sdp",
      data: sdp,
      stream_type: type,
      to: [connId],
    });
  });
};

WebRTC.prototype.setupPeer_ = function (peers, connId, type) {
  var pc,
    pcKey,
    config = _.cloneDeep(connConfig),
    ice_name;

  if (peers === this.up_peers_) {
    ice_name = "ice_down";
  } else if (peers === this.down_peers_) {
    ice_name = "ice_up";
  } else {
    throw new Error("setupPeer_ got weird peers list that is neither up nor down!");
  }

  // If screen sharing, do not apply sdp hack.
  config.sdpHack = type !== "screen";
  console.log("setting sdp hack?", config.sdpHack);
  pcKey = connId + "_" + type;
  if (_.has(peers, pcKey)) {
    console.log("setupPeer:", pcKey, "already exists. not doing anything");
    return peers[pcKey];
  }
  pc = new PeerConnection(config, connConstraints);
  peers[pcKey] = pc;
  pc.on("iceConnectionStateChange", function (event) {
    var peer = peers[pcKey];
    console.log("iceConnectionStateChange", event);
    if (connId >= this.me.getMyConnection().id) {
      return;
    }
    if (_.has(this.partedUsers, pcKey)) {
      console.log(pcKey, "in partedUsers. Bailing.");
      return;
    }
    if (pc.iceConnectionState !== "disconnected") {
      return;
    }
    if (!peer) {
      console.log("No peerConnection. Reconnecting to", pcKey);
      this.createNewOffer_(connId, type);
      return;
    }
    console.log("Reconnecting to", pcKey);
    delete peers[pcKey];
    peer.once("close", function () {
      console.debug("closed", pcKey);
      this.createNewOffer_(connId, type);
    }.bind(this));
    peer.close();
  }.bind(this));
  pc.on("removeStream", function (event) {
    console.debug("removeStream", event);
  });
  pc.on("ice", function (event) {
    Socket.send_webrtc({
      action: ice_name,
      data: event,
      stream_type: type,
      to: [connId],
    });
  });

  pc.on("addStream", function (evt) {
    console.debug("addStream", evt);
    if (this.soundEffects) {
      SoundEffects.join(this.users.getByConnectionID(connId).id);
    }
    this.addStream_(this.users.getConnectionByConnectionID(connId), evt.stream, type);
  }.bind(this));
  pc.on("error", console.log);
  return pc;
};

WebRTC.prototype.handleClosedConnection_ = function (connId, type) {
  var conn = this.users.getConnectionByConnectionID(connId);

  conn.stopStream();
  if (type === "screen") {
    conn.screenStream = null;
    conn.screenStreamURL = null;
  } else {
    conn.stream = null;
    conn.streamURL = null;
  }
  console.debug("Like *poof*.", connId);
  this.log_(connId, " has disconnected from your video chat.");
  if (this.soundEffects) {
    SoundEffects.leave(this.users.getByConnectionID(connId).id);
  }
  this.stopVideoIfAlone();
};

WebRTC.prototype.stopVideoIfAlone = function () {
  var otherStreams,
    me = this.myConnId_();

  otherStreams = _.find(this.users.valueOf(), function (u) {
    return _.find(u.connections.valueOf(), function (c) {
      return (c.streamURL || c.screenStreamURL) && c.id !== me;
    });
  });
  if (!otherStreams) {
    this.stopUserMedia();
  }
};

WebRTC.prototype.addStream_ = function (connection, stream, type) {
  if (type === "screen") {
    connection.screenStream = stream;
    connection.screenStreamURL = URL.createObjectURL(stream);
    return;
  }
  connection.stream = stream;
  connection.processStream(stream);
  connection.set({
    streamURL: URL.createObjectURL(stream),
    audioOnly: type === "audio",
  });
};

WebRTC.prototype.handleMsg_ = function (msg) {
  var down_pc, up_pc, pcKey, supportedMessages, data, user, conn, rejectMsg;
  console.log("Webrtc got a data message", msg);

  supportedMessages = [
    "answer_sdp",
    "ice_down",
    "ice_up",
    "marco",
    "mute",
    "offer_sdp",
    "polo",
    "quit",
    "reject",
    "start",
    "stop",
    "unmute",
  ];

  if (!_.includes(supportedMessages, msg.action)) {
    console.error("Unknown webrtc message action", msg.action);
    return;
  }

  data = msg.data;
  conn = this.users.getConnectionByConnectionID(msg.user_id);

  pcKey = msg.user_id + "_" + msg.stream_type;
  down_pc = this.down_peers_[pcKey];
  up_pc = this.up_peers_[pcKey];

  let chatType;
  switch (msg.action) {
    case "mute":
      console.log("muting user", data.mute);
      this.mute(data.mute, true);
      break;
    case "unmute":
      console.log("unmuting user", data.unmute);
      this.mute(data.unmute, false);
      break;
    case "reject":
      user = this.users.getByConnectionID(msg.user_id);
      rejectMsg = `${user.id} rejected your video chat request.`;
      if (data) {
        rejectMsg += ` Reason: ${data}`;
      }
      messageAction.log(rejectMsg);
      break;
    case "quit":
      conn.inVideoChat = false;
      this.partedUsers[pcKey] = true;
      this.closePeer_(msg.user_id, msg.stream_type);
      break;
    case "ice_down":
      if (down_pc) {
        console.log("Processing downstream PC ICE", data);
        down_pc.processIce(data);
      } else {
        console.log("No PC for downstream ICE", data);
      }
      break;
    case "ice_up":
      if (up_pc) {
        console.log("Processing upstream PC ICE", data);
        up_pc.processIce(data);
      } else {
        console.log("No PC for upstream ICE", data);
      }
      break;
    case "offer_sdp":
      this.processOfferSDP_(msg.user_id, msg.stream_type, data);
      break;
    case "answer_sdp":
      if (down_pc) {
        down_pc.handleAnswer(data);
      } else {
        console.log("No PC for downstream SDP", data);
      }
      break;
    case "marco":
      conn.inVideoChat = true;
      this.handleMarco_(msg.user_id, data);
      break;
    case "polo":
      this.handlePolo_(msg.user_id, data);
      break;
    case "start":
      if (perms.indexOf("patch") === -1 || prefs.dnd || !webrtcsupport.PeerConnection) {
        user = this.users.getByConnectionID(msg.user_id);
        this.sendReject(user.id, msg.user_id);
        break;
      }
      chatType = prefs.audioOnly ? "audio" : "video";
      messageAction.notify(`You are joining ${chatType} chat.`);
      if (this.commStream) {
        Socket.send_webrtc({
          action: "marco",
          data: this.myStreams(),
          to: [msg.user_id],
        });
      } else {
        this.startUserMedia(chatType);
      }
      break;
    case "stop":
      if (_.includes(data, "video")) {
        this.stopUserMedia(this.commStream, "video");
      }
      if (_.includes(data, "audio")) {
        this.stopUserMedia(this.commStream, "audio");
      }
      if (_.includes(data, "screen")) {
        this.stopUserMedia(this.screenStream, "screen");
      }
      break;
    default:
      console.error("Unknown webrtc event action", data);
      break;
  }
};

WebRTC.prototype.processOfferSDP_ = function (userId, type, offer) {
  if (!this.screenStream && !this.commStream) {
     //Not sure in what state this happens but it happens and results in JavaScript errors when we try to add null streams.
    console.log("No stream, do not create peer connection.");
    return;
  }
  const pc = this.setupPeer_(this.up_peers_, userId, type);

  if (!pc || !pc.pc) {
    console.log("no pc.pc for", userId, type);
    return;
  }
  pc.answer(offer, function (err, answer) {
    if (err) {
      console.log("Got answer error", err.toString());
      return;
    }
    Socket.send_webrtc({
      action: "answer_sdp",
      data: answer,
      stream_type: type,
      to: [userId],
    });
  });

  if (type === "screen") {
    pc.addStream(this.screenStream);
  } else {
    pc.addStream(this.commStream);
  }
};

WebRTC.prototype.handlePart_ = function (data) {
  var self = this;
  _.each(["audio", "video", "screen"], function (type) {
    self.partedUsers[data.user_id + "_" + type] = true;
    console.log("closing peer " + data.user_id + "_" + type);
    self.closePeer_(data.user_id, type);
  });
  self.stopVideoIfAlone();
};

WebRTC.prototype.closePeer_ = function (connId, type, opt_silent) {
  var self = this,
    key = connId + "_" + type,
    conn,
    down_pc;

  down_pc = this.down_peers_[key];
  if (down_pc && opt_silent === false) {
    this.log_(connId, " has quit video chat.");
  }

  conn = self.users.getConnectionByConnectionID(connId);
  if (conn) {
    conn.stopStream();
  }

  try {
    down_pc.close();
  } catch (unused) {
    // Ignore
  }
  delete this.down_peers_[key];

  // XXXXX: really horrible, but fixes a bug where switching to audio chat disconnected us
  setTimeout(function () {
    var still_connected = _.some(["video", "audio", "screen"], function (t) {
      return !!self.down_peers_[connId + "_" + t];
    });

    if (still_connected) {
      return;
    }

    _.each(["video", "audio", "screen"], function (t) {
      var pcKey = connId + "_" + t,
        pc = self.up_peers_[pcKey];
      delete self.up_peers_[pcKey];
      try {
        pc.close();
      } catch (unused) {
        // Ignore
      }
    });
  }, 2000);
};

WebRTC.prototype.startAudio = function (connId) {
  if (this.commStream) {
    Socket.send_webrtc({
      action: "start",
      data: this.myStreams(),
      to: [connId],
    });
  } else {
    this.startUserMedia("audio", [connId]);
  }
};

WebRTC.prototype.stopAudio = function (connId) {
  if (this.myConnId_() === connId) {
    this.stopUserMedia(this.commStream, "audio");
  } else {
    Socket.send_webrtc({
      action: "stop",
      data: ["audio"],
      to: [connId],
    });
  }
};

WebRTC.prototype.reloadShareScreen = function () {
  window.location.reload(true);
};

WebRTC.prototype.startScreen = function () {
  var self = this, downPeers;
  downPeers = _.map(this.down_peers_, function (peer, key) {
    return parseInt(key.split("_")[0], 10);
  });
  if (this.screenStream) {
    Socket.send_webrtc({
      action: "start",
      data: this.myStreams(),
      to: downPeers,
    });
    return;
  }

  if (navigator.userAgent.toLowerCase().indexOf("chrome") === -1) {
    Modal.showWithUnsafeHTML("Sorry, only Chrome supports WebRTC screen sharing. Please read our <a href=\"/help/webrtc#screenshare\" target=\"_blank\">guide to setting up WebRTC screen sharing</a>.");
    return;
  }

  console.log("setting up content script in webpage");
  ExtMessaging.getSharedScreenId(function (id) {
    if (!id) {
      console.log("no idea. bailing");
      return;
    }
    console.log("media source id is", id);
    mediaConstraints.screen.video.mandatory.chromeMediaSourceId = id;
    self.startUserMedia("screen", downPeers);
  });
};

WebRTC.prototype.stopScreen = function (connId) {
  if (this.myConnId_() === connId) {
    this.stopUserMedia(this.screenStream, "screen");
  } else {
    Socket.send_webrtc({
      action: "stop",
      data: ["screen"],
      to: [connId],
    });
  }
};

WebRTC.prototype.startVideo = function (connId) {
  if (this.commStream) {
    Socket.send_webrtc({
      action: "start",
      data: this.myStreams(),
      to: [connId],
    });
  } else {
    this.startUserMedia("video", [connId]);
  }
};

WebRTC.prototype.stopVideo = function (connId) {
  if (this.myConnId_() === connId) {
    this.stopUserMedia(this.commStream, "video");
  } else {
    Socket.send_webrtc({
      action: "stop",
      data: ["video"],
      to: [connId],
    });
  }
};

WebRTC.prototype.startUserMedia = function (type, users) {
  if (type === "video" && !this.hasVideo) {
    messageAction.notify("No video capabilities detected. Using audio-only.", true);
    type = "audio";
  }
  if (type === "audio" && !this.hasAudio) {
    messageAction.notify("No video or audio capabilities detected.", true);
    return;
  }

  const mcs = _.cloneDeep(mediaConstraints[type]);
  if (!mcs) {
    console.error("No constraints for type", type);
    return;
  }
  if (type === "screen" && this.screenStream) {
    console.log("Screen share already open");
    return;
  }
  if ((type === "video" || type === "audio") && this.commStream) {
    console.log("Comm stream already open.");
    this.stopStream(this.commStream);
  }
  if (type !== "screen") {
    if (mcs.audio && prefs.source_audio_id) {
      mcs.audio.optional.push({ sourceId: prefs.source_audio_id });
    }

    if (mcs.video) {
      if (prefs.source_video_id) {
        mcs.video.optional.push({ sourceId: prefs.source_video_id });
      } else {
        mcs.video.optional.push({ facingMode: "user" });
      }
    }
  }

  console.log("Media constraints:", mcs);
  getUserMedia(mcs, _.bind(this.gotUserMedia_, this, type, users));
};

WebRTC.prototype.getStreamType = function (stream) {
  var type;
  if (stream === this.commStream) {
    type = stream.getVideoTracks().length > 0 ? "video" : "audio";
  } else if (stream === this.screenStream) {
    type = "screen";
  } else {
    throw new Error("Unknown type for stream", stream);
  }
  return type;
};

WebRTC.prototype.stopStream = function (stream, type) {
  var conn;
  if (!stream) {
    return;
  }
  if (!type) {
    type = this.getStreamType(stream);
  }
  if (stream._____stopped) {
    return;
  }
  stream._____stopped = true;
  WebRTC.stopStream(stream);

  conn = this.users.getConnectionByConnectionID(this.myConnId_());
  if (conn) {
    if (type === "screen") {
      this.screenStream = null;
      conn.screenStream = null;
      conn.screenStreamURL = null;
    } else {
      this.commStream = null;
      conn.stream = null;
      conn.streamURL = null;
    }
    conn.stopStream();
  }

  // TODO: on reconnect, we emit a false quit message
  Socket.send_webrtc({
    action: "quit",
    stream_type: type,
    data: {},
    to: [],
  });
  _.each(this.up_peers_, (pc, pcKey) => {
    if (pcKey.split("_")[1] !== type) {
      return;
    }
    delete this.up_peers_[pcKey];
    try {
      pc.close();
    } catch (unused) {
      // Ignore
    }
  });
};

WebRTC.prototype.stopUserMedia = function (stream, type) {
  var self = this;

  if (!this.commStream && !this.screenStream) {
    return;
  }

  if (type) {
    console.log("Stopping video for stream.", stream, type);
    this.stopStream(stream, type);
  } else {
    if (this.commStream) {
      type = this.getStreamType(this.commStream);
      this.stopStream(this.commStream);
    }
    if (this.screenStream) {
      type = "screen";
      this.stopStream(this.screenStream, type);
    }
  }

  if (this.commStream || this.screenStream) {
    return;
  }

  function closePeers (peers) {
    var openPeers = [];
    _.each(peers, function (peer, k) {
      var userId = k.split("_")[0],
        t = k.split("_")[1];
      openPeers.push(k);
      peer.once("close", function () {
        openPeers = _.without(openPeers, k);
        if (_.isEmpty(openPeers)) {
          console.log("all done closing");
        }
      });
      try {
        self.closePeer_(userId, t, true);
      } catch (e) {
        console.debug(e);
      }
    });
    webrtcAction.closedStreams();
  }

  closePeers(this.up_peers_);
  closePeers(this.down_peers_);

  self.hideVideoChat();
};

WebRTC.prototype.hideVideoChat = function () {
  this.partedUsers = {};
};

WebRTC.stopStream = function (stream) {
  try {
    stream.getTracks().forEach(function (track) {
      track.stop();
      stream.removeTrack(track);
    });
  } catch (e) {
    console.log("Stopping stream track is not supported in this browser.");
  }
};

module.exports = WebRTC;
