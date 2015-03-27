const ReactUnwrapper = {
  destroy: function (e) {
    if (e) {
      e.preventDefault();
    }
    if (!this.isMounted()) {
      return;
    }
    this.getDOMNode().parentNode.destroy();
  }
};

const $ = require('atom-space-pen-views').$;

const FormMixin = {
  componentDidMount: function () {
    const that = this;
    $(this.getDOMNode()).keydown(function (k) {
      switch (k.keyCode) {
        case 27:  // escape
          that.destroy(k);
          return;
        case 13:  // enter
          that.onSubmit(k);
          return;
        default:
          break;
      }
    });
  },
  componentWillUnmount: function () {
    $(this.getDOMNode()).off("keydown");
  },
};

module.exports = {
  ReactUnwrapper: ReactUnwrapper,
  FormMixin: FormMixin,
};