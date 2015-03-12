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
const Welcome = React.createClass({
  componentDidMount: function () {
    const node = this.refs.username.getDOMNode();
    node.focus();
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
                      <li>real time, collaborative editing</li>
                      <li>video chating</li>
                      <li>shared terminals, and more</li>
                    </ul>
                  </div>
                </div>
                <div className="col-md-6 signup-form-container">
                  <form className="signup-form" action="/signup" method="post">
                    <span className="signup-title">Let’s Start!</span>
                    <div className="signup-input-container">
                      <div>
                        <span className="signup-username-icon signup-icon">&nbsp;</span>
                        <input ref="username" className="signup-input" type="text" name="signup-username" placeholder="Username" tabIndex="1" />
                      </div>
                    </div>
                    <div className="signup-input-container">
                      <div>
                        <span className="signup-email-icon signup-icon">&nbsp;</span>
                        <input className="signup-input" type="text" name="signup-email" placeholder="Email" tabIndex="2" />
                      </div>
                    </div>
                    <div className="signup-input-container">
                      <div>
                        <span className="signup-password-icon signup-icon">&nbsp;</span>
                        <input className="signup-input" type="password" name="signup-password1" placeholder="Password" tabIndex="3" />
                      </div>
                    </div>
                    <div className="signup-input-container">
                      <div>
                        <span className="signup-password-conf-icon signup-icon">&nbsp;</span>
                        <input className="signup-input" type="password" name="signup-password2" tabIndex="4" placeholder="Password confirmation" />
                      </div>
                    </div>
                    <button className="signup-btn" tabIndex="5">Sign up</button>
                  </form>
                  <div className="signup-form">
                    <div className="signup-github">Or
                      <a href="/login/github">Sign up with GitHub</a>
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