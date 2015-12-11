/** @jsx React.DOM */
/*global fl */
"use strict";

const _ = require("lodash");
const path = require("path");
const React = require('react-atom-fork');
const floop = require("../common/floop");
const fs = require("fs");
const $ = require('atom-space-pen-views').$;
const utils = require("../utils");
const flux = require("flukes");

function prettyTime (t) {
  const d = utils.formatDate(new Date(t));
  return `${d.hour}:${d.minute} ${d.meridian}`;
}
module.exports = React.createClass({
  mixins: [flux.createAutoBinder(['msgs'])],
  render: function () {
    const msgs = this.props.msgs.map(function (msg) {
      const userColor = utils.user_color(msg.username);
      return (
        <div className="message">
          <div className="message-content">
            <div className="message-timestamp">{prettyTime(msg.time)}</div>
            <div className="message-text">
              <span className="message-username">
                <span className="user-color-square" style={{backgroundColor: userColor}}></span>
                {msg.username}:&nbsp;
              </span>
              {msg.data}
            </div>
          </div>
        </div>
      );
    });
    return (
      <div className="native-key-bindings floobits-messages-container" style={{overflow: "auto", border: 0, padding: 10, left: 0, top: 0, margin: 0, width: "100%", height: "100%"}} >
        <div className="messages-list">
          {msgs}
        </div>
      </div>
    );
  }
});
