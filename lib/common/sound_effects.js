"use strict";

var _ = require("lodash");
var utils = require("../utils");

var semitone, root, majorScale, minorScale, chromatic,
  harmonicMinor, tempo, duration, analyseCurrentWait;

window.AudioContext = window.AudioContext || window.webkitAudioContext;
window.PannerNode = window.PannerNode || window.webkitAudioPannerNode;

const prefs = require("./userPref_model");

semitone = 1.0594545454545454;
root = 440;
majorScale = [0, 2, 4, 5, 7, 9, 11, 12];
minorScale = [0, 2, 3, 5, 7, 8, 10, 12];
harmonicMinor = [0, 2, 3, 5, 7, 9, 11, 12];
chromatic = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
tempo = 0.1;
duration = {
  whole: tempo * 4,
  half: tempo * 2,
  quarter: tempo,
  eighth: tempo / 2
};

/**
 * A mechanism to reduce CPU usage while draining audio buffer data.
 * @type {number}
 */
analyseCurrentWait = 0;


function SoundEffects () {
  // var toggle = $("#toggle_sound_effects a");
  if (!window.AudioContext) {
    return;
  }
  /**
   * Audio context to manipulate audio with.
   * @type {window.AudioContext}
   */
  try {
    this.context = new window.AudioContext();
  } catch (e) {
    console.error("Unable to create AudioContext for sound effects. :( Exception:", e);
    return;
  }

  try {
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 0.2;
    this.gainNode.connect(this.context.destination);
  } catch (e) {
    console.log("Your browser can't createGain(). Things might be loud. :( Exception:", e);
    this.gainNode = this.context.destination;
  }

  try {
    this.panner = this.context.createPanner();
    this.panner.panningModel = window.PannerNode.HRTF;
    this.panner.setPosition(0, 1, 1);
    this.panner.connect(this.gainNode);
  } catch (e) {
    console.log("Your browser can't createPanner(). Things might sound weird. :( Exception:", e);
    this.panner = this.gainNode;
  }

  this.waveform = "square";
  this.scale = this.makeScale(harmonicMinor, 220, 15);
  console.log("sound effects initialized");
}

/**
 * @param {string} type
 * @param {number} frequency
 * @param {number} duration
 * @param {number} offset
 */
SoundEffects.prototype.playNote = function (type, frequency, duration, offset) {
  var osc;
  if (!this.context) {
    return;
  }
  if (!prefs.sound) {
    console.debug("sound disabled. not playing", frequency, "for", duration);
    return;
  }
  console.debug("playing", frequency, "for", duration);
  osc = this.context.createOscillator();
  offset = offset || 0;

  osc.type = type;
  osc.frequency.value = frequency;

  osc.connect(this.panner);
  osc.start(this.context.currentTime + offset);
  osc.stop(this.context.currentTime + offset + duration);
};

/**
 * Used to track audio analysis.
 * @type {object}
 */
SoundEffects.prototype.audioAnalyseTracker = {};

/**
 * @param {Array.<number>} scale
 * @param {number} root
 * @param {number} len
 */
SoundEffects.prototype.makeScale = function (scale, root, len) {
  var s, current, position;
  s = [];
  current = root;
  for (position = 0; s.length < len; position++) {
    if (_.contains(scale, position % 12)) {
      s.push(current);
    }
    current = current * semitone;
  }
  return s;
};

/**
 * @param {string} username
 */
SoundEffects.prototype.join = function (username) {
  var i, note;
  i = _.reduce(utils.md5(username), function (memo, c) {
    return memo + c.charCodeAt(0);
  }, 0);
  note = this.scale[i % _.size(this.scale)];
  this.playNote(this.waveform, this.scale[0], duration.quarter, 0);
  this.playNote(this.waveform, note, duration.quarter, duration.quarter);
};

/**
 * @param {string} username
 */
SoundEffects.prototype.leave = function (username) {
  var i, note;
  i = _.reduce(utils.md5(username), function (memo, c) {
    return memo + c.charCodeAt(0);
  }, 0);
  note = this.scale[i % _.size(this.scale)];
  this.playNote(this.waveform, note, duration.quarter, 0);
  this.playNote(this.waveform, this.scale[0], duration.quarter, duration.quarter);
};
module.exports = new SoundEffects();
