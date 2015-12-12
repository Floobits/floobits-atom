/** @jsx React.DOM */
/*global fl */
"use strict";

const React = require('react-atom-fork');
const utils = require("../utils");
const floop = require("../common/floop");
const flux = require("flukes");

function prettyTime (t) {
  const d = utils.formatDate(new Date(t));
  return `${d.hour}:${d.minute} ${d.meridian}`;
}
module.exports = React.createClass({
  mixins: [flux.createAutoBinder(['msgs'])],
  handleMessage_: function (event) {
    event.preventDefault();
    const input = this.refs.newMessage.getDOMNode();
    const txt = input.value;
    input.value = "";
    const ret = floop.send_msg({data: txt});
    if (ret) {
      console.error(ret);
      return;
    }
    this.props.msgs.push({username: this.props.username, time: Date.now(), data: txt});
  },
  componentDidMount: function () {
    this.focus();
  },
  focus: function () {
    this.refs.newMessage.getDOMNode().focus();
  },
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
      <div className="native-key-bindings floobits-messages-container" style={
        {overflow: "auto", border: 0, padding: 10, left: 0, top: 0, margin: 0, width: "100%", height: "100%"}}
        onMouseUp={this.focus}
        >
        <div className="chat-input-container">
          <form onSubmit={this.handleMessage_}>
            <input type="text" ref="newMessage" defaultValue="" className="chat-input" placeholder="type here to chat"/>
          </form>
        </div>
        <div className="messages-list">
          {msgs}
        </div>
      </div>
    );
  }
});
