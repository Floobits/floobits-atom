/** @jsx React.DOM */

"use strict";
const React = require('react-atom-fork');
const _ = require("lodash");
const flux = require('flukes');
const modal = require("../modal");
const $ = require('atom-space-pen-views').$;
const perms = require("../common/permission_model");
const editorAction = require("../common/editor_action");
const utils = require("../utils");
const constants = require("../common/constants");
const floorc = require("../common/floorc");
const api = require("../common/api");
const message_action = require("../common/message_action");


// const ANONYMOUS_PNG = "/static/images/anonymous.png";
const ANONYMOUS_PNG = "atom://floobits/resources/anonymous.png";
const that = this;

const Mixin = {
  valueForRef: function (refName) {
    return this.refs[refName].getDOMNode().value.trim();
  }
};

const LoginForm = React.createClass({
  getInitialState: function () {
    return {
      error: null
    };
  },
  mixins: [Mixin],
  onSubmit_: function (event) {
    event.preventDefault();
    const username = this.valueForRef("username");
    const password = this.valueForRef("password1");
    const host = constants.HOST;
    const that = this;
    api.get_credentials(host, username, password, function (err, res, body) {
      if (res.statusCode === 401) {
        that.setState({
          error: "Invalid username or password",
        });
        return;
      }
      if (res.statusCode === 429) {
        that.setState({
          error: err,
        });
        return;
      }
      if (err) {
        console.error(err);
        return message_action.error(err);
      }
      if (!_.has(floorc, "auth")) {
        floorc.auth = {};
      }
      if (!_.has(floorc.auth, host)) {
        floorc.auth[host] = {};
      }
      const auth = floorc.auth[host];
      if (auth.username && auth.username !== username) {
        console.error("username changed?", auth.username, username);
      }
      auth.username = username;
      auth.api_key = res.api_key;
      auth.secret = res.secret;
      auth.updated_at = res.updated_at;
      auth.created_at = res.created_at;
      auth.auto_created = res.auto_created;
      try {
        floorc.__write();
      } catch (e) {
        return message_action.error(err);
      }
    });
  },
  componentDidMount: function () {
    const node = this.refs.username.getDOMNode();
    node.focus();
  },
  render: function () {
    return <form className="signup-form" onSubmit={this.onSubmit_}>
      <span className="signup-title">Login</span>
      { this.state.error &&  
        <div className="signup-input-container" style={{color: "#d00303", padding: 20}}>
          {this.state.error}
        </div>
      }
      <div className="signup-input-container">
        <div>
          <span className="signup-username-icon signup-icon">&nbsp;</span>
          <input ref="username" className="signup-input native-key-bindings" type="text" placeholder="Username" tabIndex="1" />
        </div>
      </div>
      <div className="signup-input-container">
        <div style={{marginBottom: 30}}>
          <span className="signup-password-icon signup-icon">&nbsp;</span>
          <input className="signup-input native-key-bindings" type="password" ref="password1" placeholder="Password" tabIndex="3" />
        </div>
      </div>
      <input type="submit" className="signup-btn native-key-bindings" tabIndex="5" value="Sign In" />
    </form>
  }
});

const CreateAccountForm = React.createClass({
  mixins: [Mixin],
  errorForRef: function (ref, error) {

  },
  onSubmit_: function (event) {
    event.preventDefault();
    const username = this.valueForRef("username");
    const email = this.valueForRef("email");
    const password1 = this.valueForRef("password1");
    const password2 = this.valueForRef("password2");
    this.props.create_account(username, password1, email);
  },
  componentDidMount: function () {
    const node = this.refs.username.getDOMNode();
    node.focus();
  },
  render: function () {
    return <form className="signup-form" onSubmit={this.onSubmit_}>
      <span className="signup-title">Let’s Start!</span>
      <div className="signup-input-container">
        <div>
          <span className="signup-username-icon signup-icon">&nbsp;</span>
          <input ref="username" className="signup-input native-key-bindings" type="text" placeholder="Username" tabIndex="1" />
        </div>
      </div>
      <div className="signup-input-container">
        <div>
          <span className="signup-email-icon signup-icon">&nbsp;</span>
          <input className="signup-input native-key-bindings" type="text" ref="email" placeholder="Email" tabIndex="2" />
        </div>
      </div>
      <div className="signup-input-container">
        <div>
          <span className="signup-password-icon signup-icon">&nbsp;</span>
          <input className="signup-input native-key-bindings" type="password" ref="password1" placeholder="Password" tabIndex="3" />
        </div>
      </div>
      <div className="signup-input-container">
        <div>
          <span className="signup-password-conf-icon signup-icon">&nbsp;</span>
          <input className="signup-input native-key-bindings" type="password" ref="password2" tabIndex="4" placeholder="Password confirmation" />
        </div>
      </div>
      <input type="submit" className="signup-btn native-key-bindings" tabIndex="5" value="Sign Up" />
    </form>
  }
});

const Welcome = React.createClass({
  getInitialState: function () {
    return {
      create: true,
    };
  },
  toggle_: function () {
    this.setState({create: !this.state.create});
  },
  render: function () {
    return (
      <div id="floo-welcome-wrapper">
        <div id="floo-main">
          <div className="floo-home-slider" style={{}}>
            <div className="container">
              <div className="row">
                <div className="col-md-6">
                  <div className="hero">
                    <h1>Floobits</h1>
                    <h2>Write code together, anywhere.</h2>
                  </div>
                  <div className="hero-info">
                    <ul>
                      <li>collaborative real-time editing</li>
                      <li>video chating</li>
                      <li>shared terminals, and more</li>
                    </ul>
                  </div>
                </div>
                <div className="col-md-6 signup-form-container">
                  {this.state.create ? <CreateAccountForm create_account={this.props.create_account} /> : <LoginForm /> }
                  <div className="signup-form">
                    <div className="signup-github">
                      <a href="" onClick={this.toggle_}>
                        {this.state.create ? "Already have an account?" : "Need to make an account?" }
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

module.exports = Welcome;