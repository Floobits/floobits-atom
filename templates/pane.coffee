{$, View} = require 'atom-space-pen-views'

class PaneView extends View
  focus: -> @input.focus()
  initialize: (@pane) =>
    @pane.setView @
    this[0].appendChild(@pane.inner)

  detached: ->
    console.log "detached"
    @pane.onDetached?()

  @content: (params) ->
    @div 'style': "overflow: auto;", "class": "native-key-bindings"

class Pane
  constructor: (@title, @iconName, @inner, @onDetached) ->
  getViewClass: -> PaneView
  getView: -> @view
  setView: (@view) ->
  getTitle: () =>
    @title
  getIconName: () =>
    @iconName

module.exports = Pane
