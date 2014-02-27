{View} = require 'atom'

module.exports =
class FloobitsView extends View
  @content: ->
    @div class: 'floobits overlay from-top', =>
      @div "The Floobits package is Alive! It's ALIVE!2", class: "message"

  initialize: (serializeState) ->
    atom.workspaceView.command "floobits:toggle", => @toggle()

  # Returns an object that can be retrieved when package is activated
  serialize: ->

  # Tear down any state and detach
  destroy: ->
    @detach()

  toggle: ->
    console.log "FloobitsView was toggled!"
    if @hasParent()
      @detach()
    else
      atom.workspaceView.append(this)
