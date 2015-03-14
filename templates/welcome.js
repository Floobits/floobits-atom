/** @jsx React.DOM */

"use strict";
const React = require('react-atom-fork');
const flux = require('flukes');
const modal = require("../modal");
const $ = require('atom-space-pen-views').$;
const perms = require("../common/permission_model");
const editorAction = require("../common/editor_action");
const utils = require("../utils");

// const ANONYMOUS_PNG = "/static/images/anonymous.png";
const ANONYMOUS_PNG = "atom://floobits/resources/anonymous.png";
const that = this;

const LoginForm = React.createClass({
  componentDidMount: function () {
    const node = this.refs.username.getDOMNode();
    node.focus();
  },
  render: function () {
    return <form className="signup-form" onSubmit={this.onSubmit_}>
      <span className="signup-title">Login</span>
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
  errorForRef: function (ref, error) {

  },
  valueForRef: function (refName) {
    return this.refs[refName].getDOMNode().value.trim();
  },
  onSubmit_: function (event) {
    event.preventDefault();
    const username = this.valueForRef("username");
    const email = this.valueForRef("email");
    const password1 = this.valueForRef("password1");
    const password2 = this.valueForRef("password2");
    this.props.create_account(username, password1, email);
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
                  {this.state.create ? <CreateAccountForm /> : <LoginForm /> }
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