'use strict';

const EventEmitter = require('events').EventEmitter;

module.exports = class FSM extends EventEmitter {
  constructor(options) {
    super();
    this.currentState = undefined; // String name of current state
    this.initialState = options.initialState; // Optional string name of initial state
    this.meta = Object.keys(options.states).reduce((meta, stateName) => {
      meta[stateName] = {
        defer: false,
        depth: undefined,
        queue: [],
      };
      return meta;
    }, {});
    this.priorState = undefined; // String name of previous state before last transition
    this.priorEvent = undefined; // String name of the previous named handle event
    this.states = options.states;
    this.transitionChain = Promise.resolve();
    // Bind any "unexpected" properties to the class for internal/external availability
    Object.keys(options).forEach((propertyName) => {
      if (propertyName !== 'initialState' && propertyName !== 'states') {
        this[propertyName] = options[propertyName];
      }
    });
    this._initalize();
  }

  // If an "initialState" was specified we'll transition to that
  // and execute its "_onEnter" function if one was defined
  _initalize() {
    if (this.states[this.initialState]) {
      this.transitionChain = this.transitionChain.then(() => {
        this.currentState = this.initialState;
        if (this.states[this.currentState]._onEnter) {
          this.emit('beforeEnter', this.initialState);
          try {
            this.states[this.currentState]._onEnter.call(this);
          } catch (exception) {
            this.emit('exception', this.currentState, '_onEnter', exception);
          }
        }
        this.emit('afterTransition', undefined, this.initialState);
      });
    }
  }

  // Pops and executes events after transitioning into another state
  // By default all events are processed in the order they were received
  // but if "setQueueDepth" was used, only up to the specified number of events
  // will be processed during this transition, the rest will remain in the
  // state's queue waiting to be handled after the _onEnter
  _drainQueue() {
    const depth = this.meta[this.currentState].depth || this.meta[this.currentState].queue.length;
    const eventQueue = this.meta[this.currentState].queue;
    const currentCycleEvents = eventQueue.slice(0, depth);
    if (currentCycleEvents.length > 0) {
      this.meta[this.currentState].queue = eventQueue.slice(depth);
      currentCycleEvents.forEach((queued) => {
        this.emit('beforeHandle', this.currentState, queued.event, true);
        try {
          this.states[this.currentState][queued.event].apply(this, queued.args);
        } catch (exception) {
          this.emit('exception', this.currentState, queued.event, exception);
        }
        this.priorEvent = queued.event;
      });
    }
  }

  // Attempt to move into the target state
  transition(targetState) {
    // NOTE: I'm unsure whether to silently ignore
    // transitions to undefined states or throw an error?
    if (!this.states[targetState]) {
      throw new Error(`Target state ${targetState} is undefined!`);
    }

    let transitionResult;

    // Add the target state to the transition state
    this.transitionChain = this.transitionChain.then(() => {
      // Call current state's onExit if it exists
      if (this.currentState && this.states[this.currentState]._onExit) {
        this.emit('beforeExit', this.currentState);
        try {
          this.states[this.currentState]._onExit.call(this);
        } catch (exception) {
          this.emit('exception', this.currentState, '_onExit', exception);
        }
      }

      this.priorState = this.currentState;
      this.currentState = targetState;
      // Reset the event queue deferral if present before calling target's onEnter
      this.meta[this.currentState].defer = false;
      // Reset the event queue depth
      this.meta[this.currentState].depth = undefined;

      // Call the target state's onEnter if it exsits
      // Will pass additional arguments to this.transition
      // through to the target state's _onEnter function
      if (this.states[this.currentState]._onEnter) {
        this.emit('beforeEnter', this.currentState);
        try {
          transitionResult = this.states[targetState]._onEnter.apply(
            this,
            Array.prototype.slice.call(arguments, 1)
          );
        } catch (exception) {
          this.emit('exception', this.targetState, '_onEnter', exception);
        }
      }
      this.emit('afterTransition', this.priorState, this.currentState);

      // Attempt to process any queued events for the state we just transitioned into
      this._drainQueue();

      return transitionResult;
    });
  }

  // Execute a function within a state
  handle() {
    let targetEvent;
    let targetEventArgs = [];
    let targetState = this.currentState;

    switch (arguments.length) {
      case 0: { throw new Error('Handle function requires at least one argument!'); }
      case 1: {
        targetEvent = arguments[0];
        break;
      }
      case 2: {
        // TODO: Broken for this.handle('event in same state', argument1)...
        targetState = arguments[0];
        targetEvent = arguments[1];
        break;
      }
      default: {
        targetState = arguments[0];
        targetEvent = arguments[1];
        targetEventArgs = Array.prototype.slice.call(arguments, 2);
      }
    }

    if (targetState === this.currentState) {
      if (this.meta[this.currentState].defer) {
        // Push event into the current state's queue
        this.meta[targetState].queue.push({
          args: targetEventArgs,
          event: targetEvent,
        });
      } else {
        // Execute event immediately without queueing
        this.emit('beforeHandle', this.currentState, targetEvent, false);
        try {
          this.states[this.currentState][targetEvent].apply(
            this,
            targetEventArgs
          );
          this.priorEvent = targetEvent;
        } catch (exception) {
          this.emit('exception', this.currentState, targetEvent, exception);
        }
      }
    } else {
      // Push event into the target state's event queue
      this.meta[targetState].queue.push({
        args: targetEventArgs,
        event: targetEvent,
      });
    }
  }

  // Future handle events will not be executed until we re-enter the current state
  deferEvents() {
    this.meta[this.currentState].defer = true;
    this.emit('afterDefer', this.currentState);
  }

  // Override's _drainQueue's depth value
  // TODO: Allow queue depth to be set from any state?
  setQueueDepth(depth) {
    this.meta[this.currentState].depth = depth;
    this.emit('aferDepth', this.currentState, depth);
  }

  // Syntactic sugar
  transitionAndHandle(targetState, targetEvent) {
    this.transition(targetState);
    if (arguments.length === 2) {
      this.handle(targetState, targetEvent);
    } else {
      this.handle.apply(this, arguments);
    }
  }
};
